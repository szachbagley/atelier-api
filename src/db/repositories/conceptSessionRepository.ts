import { v4 as uuid } from 'uuid';
import { db } from '../index.js';
import type {
  ComponentType,
  ConceptArtMessage,
  ConceptArtSession,
  ConceptArtSessionStatus,
} from '../../types/models.js';
import * as storage from '../../services/storage/storageService.js';
import { toCamelRow } from '../../utils/caseMapping.js';
import { addActiveFilter } from '../../utils/softDelete.js';

export interface SessionRecord {
  id: string;
  projectId: string;
  componentType: ComponentType;
  componentId: string;
  status: ConceptArtSessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionListItem extends SessionRecord {
  messageCount: number;
}

export interface MessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | null;
  generatedImageId: string | null;
  imageUrl?: string | null;
  createdAt: Date;
}

export interface SessionDetail extends SessionRecord {
  messages: MessageRecord[];
}

const MESSAGE_COUNT_SQL = `(
  select count(*) from concept_art_messages m
  where m.session_id = concept_art_sessions.id
) as message_count`;

export async function create(
  projectId: string,
  componentType: ComponentType,
  componentId: string
): Promise<SessionRecord> {
  const id = uuid();
  await db('concept_art_sessions').insert({
    id,
    project_id: projectId,
    component_type: componentType,
    component_id: componentId,
    status: 'ACTIVE',
  });

  const row = (await db<ConceptArtSession>('concept_art_sessions')
    .where({ id })
    .first()) as ConceptArtSession;
  return toCamelRow<SessionRecord>(row);
}

export async function findByProject(
  projectId: string
): Promise<SessionListItem[]> {
  const rows = await addActiveFilter(
    db<ConceptArtSession>('concept_art_sessions').where({
      project_id: projectId,
    })
  )
    .select('concept_art_sessions.*', db.raw(MESSAGE_COUNT_SQL))
    .orderBy('created_at', 'desc');

  return rows.map((row) => {
    const item = toCamelRow<SessionListItem>(row as object);
    item.messageCount = Number(item.messageCount);
    return item;
  });
}

export async function findById(
  projectId: string,
  id: string
): Promise<SessionRecord | null> {
  const row = await addActiveFilter(
    db<ConceptArtSession>('concept_art_sessions').where({
      id,
      project_id: projectId,
    })
  ).first();
  return row ? toCamelRow<SessionRecord>(row) : null;
}

export async function findDetail(
  projectId: string,
  id: string
): Promise<SessionDetail | null> {
  const session = await findById(projectId, id);
  if (!session) return null;

  const messages = (await db<ConceptArtMessage>('concept_art_messages')
    .leftJoin(
      'generated_images',
      'concept_art_messages.generated_image_id',
      'generated_images.id'
    )
    .where({ 'concept_art_messages.session_id': id })
    .select(
      'concept_art_messages.*',
      'generated_images.s3_key as image_s3_key'
    )
    .orderBy('concept_art_messages.created_at')) as Array<
    ConceptArtMessage & { image_s3_key: string | null }
  >;

  return {
    ...session,
    messages: await Promise.all(
      messages.map(async (m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        generatedImageId: m.generated_image_id,
        imageUrl: m.image_s3_key
          ? await storage.getImageUrl(m.image_s3_key)
          : null,
        createdAt: m.created_at,
      }))
    ),
  };
}

export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  generatedImageId?: string | null
): Promise<MessageRecord> {
  const id = uuid();
  await db('concept_art_messages').insert({
    id,
    session_id: sessionId,
    role,
    content,
    generated_image_id: generatedImageId ?? null,
  });

  const row = (await db<ConceptArtMessage>('concept_art_messages')
    .where({ id })
    .first()) as ConceptArtMessage;

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    generatedImageId: row.generated_image_id,
    createdAt: row.created_at,
  };
}

export async function updateStatus(
  id: string,
  status: ConceptArtSessionStatus
): Promise<void> {
  await db('concept_art_sessions')
    .where({ id })
    .update({ status, updated_at: db.fn.now() });
}

// True if the given generated image was produced within this session.
export async function imageBelongsToSession(
  sessionId: string,
  generatedImageId: string
): Promise<boolean> {
  const row = await db('concept_art_messages')
    .where({ session_id: sessionId, generated_image_id: generatedImageId })
    .first();
  return !!row;
}
