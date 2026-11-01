import { ProviderError } from './LLMProvider.ts'
import type { LLMProvider, ProviderInput } from './LLMProvider.ts'
export class MiniSGLangProvider implements LLMProvider {
  readonly id = 'mini-sglang' as const
  async *stream(_input: ProviderInput): AsyncGenerator<string> {
    throw new ProviderError('NOT_IMPLEMENTED', 'Mini-SGLang 尚未接入。')
  }
}
