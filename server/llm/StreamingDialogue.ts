import { randomUUID } from 'node:crypto'
import type { DialogueRequest, DialogueResponse } from '../../src/types/dialogue.ts'
import { isDialogueRequest, parseDialogueResponse } from '../../src/types/dialogue.ts'
import { CharacterRulesLoader } from '../character/CharacterRulesLoader.ts'
import { CharacterPromptBuilder } from '../prompts/CharacterPromptBuilder.ts'
import { InvalidRequestError } from '../dialogue/DialogueController.ts'
import { getQwenConfig } from './config.ts'
import type { QwenConfig } from './config.ts'
import { QwenProvider } from './QwenProvider.ts'
import { DemoProvider } from './DemoProvider.ts'
import { ProviderError } from './LLMProvider.ts'
import type { LLMProvider } from './LLMProvider.ts'

export function historyWindow(request: DialogueRequest, config: QwenConfig) {
  if (config.historyPolicy === 'none' || config.historyMessages === 0) return []
  const result = request.history.slice(-config.historyMessages)
  let chars = result.reduce((sum, message) => sum + message.content.length, 0)
  while (chars > config.historyChars && result.length) chars -= result.shift()!.content.length
  while (result[0]?.role === 'assistant') result.shift()
  return result
}
/** Hold only possible forbidden prefixes so normal text streams immediately. */
export class DisclosureGuard {
  private pending = ''
  private readonly patterns: string[]
  constructor(patterns: string[]) { this.patterns = patterns.filter(Boolean) }
  push(text: string, final = false) {
    this.pending += text
    if (this.patterns.some(pattern => this.pending.includes(pattern))) throw new ProviderError('PRIVATE_CONTENT', '回复包含内部内容，已停止生成，请换一种方式提问。')
    let hold = 0
    if (!final) for (const pattern of this.patterns) {
      for (let n = Math.min(this.pending.length, pattern.length - 1); n > hold; n--) {
        if (this.pending.endsWith(pattern.slice(0, n))) { hold = n; break }
      }
    }
    const output = this.pending.slice(0, this.pending.length - hold)
    this.pending = this.pending.slice(this.pending.length - hold)
    return output
  }
}
export type StreamEvent = { event: 'delta'; data: { seq: number; text: string } } | { event: 'done'; data: DialogueResponse }
export class StreamingDialogue {
  private readonly config: QwenConfig
  private readonly provider?: LLMProvider
  constructor(config = getQwenConfig(), provider?: LLMProvider) { this.config = config; this.provider = provider }
  available() { return Boolean(this.config.apiKey && this.config.enabled) }
  async *stream(value: unknown, signal: AbortSignal): AsyncGenerator<StreamEvent> {
    if (!isDialogueRequest(value)) throw new InvalidRequestError()
    const rules = await new CharacterRulesLoader().load()
    const request = { ...value, history: historyWindow(value, this.config) }
    const prompt = new CharacterPromptBuilder().build(request, rules, 'text')
    const provider = this.provider ?? (value.mode === 'demo' ? new DemoProvider() : new QwenProvider(this.config))
    const privateLines = (rules.sections.get(10) ?? '').split(/\r?\n/).map(line => line.replace(/^[-\s]+/, '')).filter(line => line.length >= 24)
    const guard = new DisclosureGuard([rules.content.trim(),rules.custom?.content??'', ...privateLines, this.config.apiKey])
    let reply = '', seq = 0, total = 0
    for await (const delta of provider.stream({ request, prompt, signal })) {
      signal.throwIfAborted()
      if (typeof delta !== 'string' || (total += delta.length) > 4000) throw new ProviderError('INVALID_REPLY', '模型回复格式或长度无效。')
      const text = guard.push(delta)
      if (text) { reply += text; yield { event: 'delta', data: { seq: ++seq, text } } }
    }
    signal.throwIfAborted()
    const tail = guard.push('', true)
    if (tail) { reply += tail; yield { event: 'delta', data: { seq: ++seq, text: tail } } }
    yield { event: 'done', data: parseDialogueResponse({ requestId: randomUUID(), mode: value.mode, reply, mood: 'calm', action: 'idle', environment: value.environment, rules: rules.metadata }) }
  }
}
