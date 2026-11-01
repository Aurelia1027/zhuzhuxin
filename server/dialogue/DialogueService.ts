import type { DialogueRequest, DialogueResponse } from '../../src/types/dialogue.ts'
import type { PreparedCharacterPrompt } from '../prompts/CharacterPromptBuilder.ts'

export type ModelReply = Pick<DialogueResponse, 'reply' | 'action' | 'environment'>
export interface DialogueService {
  readonly mode: 'demo' | 'ai'
  reply(request: DialogueRequest, prompt: PreparedCharacterPrompt): Promise<ModelReply>
}
