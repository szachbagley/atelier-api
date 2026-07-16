import type {
  ArtStyle,
  Character,
  LightingSetup,
  Prop,
  Scene,
  Setting,
  Shot,
  Variant,
} from '../../types/models.js';
import {
  CAMERA_ANGLE_DESCRIPTIONS,
  SHOT_TYPE_DESCRIPTIONS,
  TIME_OF_DAY_DESCRIPTIONS,
  WEATHER_DESCRIPTIONS,
} from './descriptors.js';

export const MAX_PROMPT_LENGTH = 1500;

export interface ShotContext {
  shot: Shot;
  scene: Scene;
  artStyle: ArtStyle | null;
  characters: Array<{ character: Character; variant?: Variant }>;
  setting: Setting | null;
  lighting: LightingSetup | null;
  props: Prop[];
}

export interface PromptSection {
  name: string;
  content: string;
  source: string;
}

export interface CompilationResult {
  prompt: string;
  sections: PromptSection[];
  warnings: string[];
  error: { code: string; message: string } | null;
}

// Prompt-injection defence (docs/SECURITY.md): applied to every piece of user
// text that enters a prompt.
export function sanitizeForPrompt(input: string): string {
  return input
    .replace(/[<>{}[\]]/g, '') // Remove brackets
    .replace(/```/g, '') // Remove code blocks
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .trim()
    .slice(0, 2000); // Enforce length limit
}

export abstract class PromptCompiler {
  compile(context: ShotContext): CompilationResult {
    const warnings: string[] = [];

    if (!context.artStyle?.ai_description && !context.artStyle?.description) {
      warnings.push(
        'Art style has no description - output may lack visual consistency'
      );
    }

    context.characters.forEach(({ character, variant }) => {
      const desc = variant?.ai_description || character.ai_description;
      if (!desc && !character.physical_description) {
        warnings.push(`Character "${character.name}" has no description`);
      }
    });

    const sections = this.buildSections(context);
    const prompt = this.assembleSections(sections);

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return {
        prompt,
        sections,
        warnings,
        error: {
          code: 'GEN_PROMPT_TOO_LONG',
          message: `Prompt is ${prompt.length} characters. Maximum is ${MAX_PROMPT_LENGTH}.`,
        },
      };
    }

    return { prompt, sections, warnings, error: null };
  }

  // Section order is binding per docs/ARCHITECTURE.md: framing → description
  // → characters → props → setting → lighting → style → quality.
  protected buildSections(context: ShotContext): PromptSection[] {
    const sections: PromptSection[] = [];

    for (const section of [
      this.buildFramingSection(context),
      this.buildDescriptionSection(context),
      this.buildCharactersSection(context),
      this.buildPropsSection(context),
      this.buildSettingSection(context),
      this.buildLightingSection(context),
      this.buildStyleSection(context),
      this.buildQualitySection(),
    ]) {
      if (section) sections.push(section);
    }

    return sections;
  }

  protected buildFramingSection(context: ShotContext): PromptSection | null {
    const parts: string[] = [];

    if (context.shot.shot_type) {
      parts.push(SHOT_TYPE_DESCRIPTIONS[context.shot.shot_type] || '');
    }
    if (context.shot.camera_angle) {
      parts.push(CAMERA_ANGLE_DESCRIPTIONS[context.shot.camera_angle] || '');
    }

    const content = parts.filter(Boolean).join(', ');
    if (!content) return null;

    return { name: 'framing', content, source: 'system:shot_type' };
  }

  protected buildDescriptionSection(
    context: ShotContext
  ): PromptSection | null {
    if (!context.shot.description) return null;

    return {
      name: 'description',
      content: sanitizeForPrompt(context.shot.description),
      source: 'user:shot_description',
    };
  }

  protected buildCharactersSection(
    context: ShotContext
  ): PromptSection | null {
    if (context.characters.length === 0) return null;

    const descriptions = context.characters.map(({ character, variant }) =>
      sanitizeForPrompt(
        variant?.ai_description ||
          character.ai_description ||
          character.physical_description ||
          character.name
      )
    );

    return {
      name: 'characters',
      content: `featuring ${descriptions.join('; ')}`,
      source: context.characters
        .map((c) => `character:${c.character.id}`)
        .join(','),
    };
  }

  protected buildPropsSection(context: ShotContext): PromptSection | null {
    if (context.props.length === 0) return null;

    const descriptions = context.props.map((p) =>
      sanitizeForPrompt(p.ai_description || p.description || p.name)
    );

    return {
      name: 'props',
      content: `with ${descriptions.join(', ')}`,
      source: context.props.map((p) => `prop:${p.id}`).join(','),
    };
  }

  protected buildSettingSection(context: ShotContext): PromptSection | null {
    if (!context.setting) return null;

    const parts: string[] = [];

    if (context.setting.ai_description) {
      parts.push(sanitizeForPrompt(context.setting.ai_description));
    } else {
      if (context.setting.description) {
        parts.push(sanitizeForPrompt(context.setting.description));
      }
      if (context.setting.set_dressing) {
        parts.push(sanitizeForPrompt(context.setting.set_dressing));
      }
    }

    if (
      context.setting.time_of_day &&
      context.setting.time_of_day !== 'unspecified'
    ) {
      parts.push(TIME_OF_DAY_DESCRIPTIONS[context.setting.time_of_day]);
    }

    if (context.setting.weather && context.setting.weather !== 'unspecified') {
      parts.push(WEATHER_DESCRIPTIONS[context.setting.weather]);
    }

    const content = parts.filter(Boolean).join('. ');
    if (!content) return null;

    return {
      name: 'setting',
      content: `Set in ${content}`,
      source: `setting:${context.setting.id}`,
    };
  }

  protected buildLightingSection(context: ShotContext): PromptSection | null {
    if (!context.lighting) return null;

    const desc =
      context.lighting.ai_description || context.lighting.description;
    if (!desc) return null;

    return {
      name: 'lighting',
      content: sanitizeForPrompt(desc),
      source: `lighting:${context.lighting.id}`,
    };
  }

  protected buildStyleSection(context: ShotContext): PromptSection | null {
    if (!context.artStyle) return null;

    const desc =
      context.artStyle.ai_description || context.artStyle.description;
    if (!desc) return null;

    return {
      name: 'style',
      content: `Rendered in ${sanitizeForPrompt(desc)}`,
      source: `art_style:${context.artStyle.id}`,
    };
  }

  protected abstract buildQualitySection(): PromptSection | null;
  protected abstract assembleSections(sections: PromptSection[]): string;
}
