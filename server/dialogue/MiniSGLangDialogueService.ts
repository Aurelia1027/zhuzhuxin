import { isModelReply } from '../../src/types/dialogue.ts'
import type { DialogueRequest } from '../../src/types/dialogue.ts'
import type { PreparedCharacterPrompt, PromptMessage } from '../prompts/CharacterPromptBuilder.ts'
import type { DialogueService, ModelReply } from './DialogueService.ts'

/** Week 04 implements this transport on the server; no credentials or prompts reach React. */
export interface MiniSGLangTransport { complete(messages: PromptMessage[]): Promise<unknown> }
export class AiNotConfiguredError extends Error {
  constructor() { super('AI Mode 尚未接入 Mini-SGLang。请使用 Demo Mode。') }
}
export class MiniSGLangDialogueService implements DialogueService {
  readonly mode = 'ai' as const
  private readonly transport?: MiniSGLangTransport
  constructor(transport?: MiniSGLangTransport) { this.transport = transport }
  async reply(_request: DialogueRequest, prompt: PreparedCharacterPrompt): Promise<ModelReply> {
    if (!this.transport) throw new AiNotConfiguredError()
    const raw = await this.transport.complete(prompt.messages)
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!isModelReply(value)) throw new Error('AI response failed JSON Schema validation')
    return value
  }
}
