import { Router } from 'express';
import { db } from '../db/index.js';
import * as conceptSessionRepository from '../db/repositories/conceptSessionRepository.js';
import { ErrorCodes } from '../errors/codes.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createSessionSchema,
  finalizeSessionSchema,
  sessionMessageSchema,
  updateSessionSchema,
} from '../schemas/conceptSession.js';
import { generateComponentDescription } from '../services/imageGeneration/descriptionService.js';
import * as imageGeneration from '../services/imageGeneration/index.js';
import { sanitizeForPrompt } from '../services/promptCompiler/index.js';
import type { ComponentType, ConceptArtSessionStatus } from '../types/models.js';
import { authUserIdOf, projectIdOf } from './componentHelpers.js';
import {
  assertComponentInProject,
  COMPONENT_LABELS,
  COMPONENT_TABLES,
} from './componentLookup.js';

// Mounted at /projects/:projectId/concept-sessions.
export const conceptSessionsRouter = Router({ mergeParams: true });

conceptSessionsRouter.use(authenticate, requireProjectAccess);

async function loadSession(req: {
  project?: { id: string };
  params: unknown;
}): Promise<conceptSessionRepository.SessionRecord> {
  const { sessionId } = req.params as { sessionId: string };
  const session = await conceptSessionRepository.findById(
    projectIdOf(req as { project?: never }),
    sessionId
  );
  if (!session) throw new NotFoundError('Concept art session', sessionId);
  return session;
}

function assertActive(
  session: conceptSessionRepository.SessionRecord
): void {
  if (session.status !== 'ACTIVE') {
    throw new ConflictError(
      ErrorCodes.RES_CONFLICT,
      `Session is ${session.status}; only ACTIVE sessions accept this operation`
    );
  }
}

conceptSessionsRouter.get('/', async (req, res) => {
  res.json({
    data: await conceptSessionRepository.findByProject(projectIdOf(req)),
  });
});

conceptSessionsRouter.post('/', validate(createSessionSchema), async (req, res) => {
  const { componentType, componentId } = req.body as {
    componentType: ComponentType;
    componentId: string;
  };
  await assertComponentInProject(projectIdOf(req), componentType, componentId);

  const session = await conceptSessionRepository.create(
    projectIdOf(req),
    componentType,
    componentId
  );
  res.status(201).json({ ...session, messages: [] });
});

conceptSessionsRouter.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params as { sessionId: string };
  const detail = await conceptSessionRepository.findDetail(
    projectIdOf(req),
    sessionId
  );
  if (!detail) throw new NotFoundError('Concept art session', sessionId);
  res.json(detail);
});

// User message → image generation (with component context folded into the
// prompt) → assistant message carrying the generated image.
conceptSessionsRouter.post(
  '/:sessionId/messages',
  validate(sessionMessageSchema),
  async (req, res) => {
    const session = await loadSession(req);
    assertActive(session);

    const { content } = req.body as { content: string };
    const userMessage = await conceptSessionRepository.addMessage(
      session.id,
      'user',
      content
    );

    // Fold the component's existing description into the prompt so iteration
    // stays anchored to the component being designed.
    const component = await db(COMPONENT_TABLES[session.componentType])
      .where({ id: session.componentId })
      .first();
    const componentContext =
      component?.ai_description || component?.description || component?.name;

    const promptParts = [
      `Concept art for a ${COMPONENT_LABELS[session.componentType]}`,
      componentContext ? sanitizeForPrompt(String(componentContext)) : null,
      sanitizeForPrompt(content),
    ].filter(Boolean);

    const result = await imageGeneration.generateFromPrompt(
      authUserIdOf(req),
      projectIdOf(req),
      promptParts.join('. ')
    );

    const assistantMessage = await conceptSessionRepository.addMessage(
      session.id,
      'assistant',
      `Here's an updated concept based on: "${content}"`,
      result.id
    );

    res.json({
      userMessage,
      assistantMessage: { ...assistantMessage, imageUrl: result.url },
    });
  }
);

conceptSessionsRouter.patch(
  '/:sessionId',
  validate(updateSessionSchema),
  async (req, res) => {
    const session = await loadSession(req);
    assertActive(session);

    const { status } = req.body as { status: ConceptArtSessionStatus };
    await conceptSessionRepository.updateStatus(session.id, status);
    res.json({ id: session.id, status });
  }
);

// Finalize: mark COMPLETED and write an AI description for the component,
// derived from the selected image's generation prompt + the component fields.
conceptSessionsRouter.post(
  '/:sessionId/finalize',
  validate(finalizeSessionSchema),
  async (req, res) => {
    const session = await loadSession(req);
    assertActive(session);

    const { selectedImageId } = req.body as { selectedImageId: string };
    if (
      !(await conceptSessionRepository.imageBelongsToSession(
        session.id,
        selectedImageId
      ))
    ) {
      throw new ValidationError('selectedImageId was not generated in this session', {
        fields: [{ field: 'selectedImageId', message: 'Unknown image' }],
      });
    }

    const image = await db('generated_images')
      .where({ id: selectedImageId })
      .select('prompt')
      .first();
    const component = await db(COMPONENT_TABLES[session.componentType])
      .where({ id: session.componentId })
      .first();

    const generatedDescription = await generateComponentDescription(
      authUserIdOf(req),
      COMPONENT_LABELS[session.componentType],
      {
        name: component?.name,
        existingDescription:
          component?.description ?? component?.physical_description,
        selectedConceptPrompt: image?.prompt,
      }
    );

    await db(COMPONENT_TABLES[session.componentType])
      .where({ id: session.componentId })
      .update({ ai_description: generatedDescription, updated_at: db.fn.now() });

    await conceptSessionRepository.updateStatus(session.id, 'COMPLETED');

    res.json({ status: 'COMPLETED', generatedDescription });
  }
);
