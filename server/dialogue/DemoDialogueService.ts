import type { DialogueRequest } from '../../src/types/dialogue.ts'
import type { PreparedCharacterPrompt } from '../prompts/CharacterPromptBuilder.ts'
import type { DialogueService, ModelReply } from './DialogueService.ts'
import { demoReply } from '../../src/services/dialogue/demoReply.ts'

/** Same deterministic fixtures, shared with the browser's clearly labelled fallback. */
export class DemoDialogueService implements DialogueService {
  readonly mode = 'demo' as const
  async reply(request: DialogueRequest, _prompt: PreparedCharacterPrompt): Promise<ModelReply> { return demoReply(request) }
}
