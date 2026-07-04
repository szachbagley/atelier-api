import { PromptCompiler } from './PromptCompiler.js';
import type { PromptSection } from './PromptCompiler.js';

const GEMINI_QUALITY_BOOSTERS = [
  'Highly detailed',
  'professional cinematography',
  'cinematic composition',
  'dramatic lighting',
];

export class GeminiPromptCompiler extends PromptCompiler {
  protected buildQualitySection(): PromptSection {
    return {
      name: 'quality',
      content: GEMINI_QUALITY_BOOSTERS.join(', '),
      source: 'system:quality_boosters',
    };
  }

  protected assembleSections(sections: PromptSection[]): string {
    // Gemini works best with natural prose.
    const prose = sections
      .map((s) => s.content)
      .join('. ')
      .replace(/\.\./g, '.')
      .trim();
    // Sentence-case the prompt (descriptors are lowercase fragments).
    return prose.charAt(0).toUpperCase() + prose.slice(1);
  }
}
