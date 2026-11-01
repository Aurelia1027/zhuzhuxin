import { DemoDialogueService } from '../dialogue/DemoDialogueService.ts'
import type { LLMProvider, ProviderInput } from './LLMProvider.ts'
export class DemoProvider implements LLMProvider {
  readonly id = 'demo' as const
  async *stream(input: ProviderInput) {
    input.signal.throwIfAborted()
    yield (await new DemoDialogueService().reply(input.request, input.prompt)).reply
  }
}
