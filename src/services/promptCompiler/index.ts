import { GeminiPromptCompiler } from './geminiAdapter.js';
import type { PromptCompiler } from './PromptCompiler.js';

export type {
  CompilationResult,
  PromptSection,
  ShotContext,
} from './PromptCompiler.js';
export { MAX_PROMPT_LENGTH, sanitizeForPrompt } from './PromptCompiler.js';
export { buildShotContext } from './contextBuilder.js';

const compilers: Record<string, PromptCompiler> = {
  gemini: new GeminiPromptCompiler(),
};

export function getPromptCompiler(provider: string): PromptCompiler {
  const compiler = compilers[provider];
  if (!compiler) {
    throw new Error(`No prompt compiler available for provider: ${provider}`);
  }
  return compiler;
}
