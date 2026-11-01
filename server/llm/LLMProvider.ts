import type { DialogueRequest } from '../../src/types/dialogue.ts'
import type { PreparedCharacterPrompt } from '../prompts/CharacterPromptBuilder.ts'
export interface ProviderInput { request: DialogueRequest; prompt: PreparedCharacterPrompt; signal: AbortSignal; maxTokens?: number; jsonMode?: boolean; onUsage?: (usage:{promptTokens:number;completionTokens:number})=>void }
export interface LLMProvider {
  readonly id: 'qwen' | 'mini-sglang' | 'demo'
  stream(input: ProviderInput): AsyncIterable<string>
}
export class ProviderError extends Error {
  readonly code: string
  readonly diagnostics?: {stage:string;issues:{path:string;errorType:string}[]}
  constructor(code: string, message: string, diagnostics?:{stage:string;issues:{path:string;errorType:string}[]}) { super(message); this.code = code; this.diagnostics=diagnostics }
}
