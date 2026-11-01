import { createHash, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
import { ProviderError } from '../llm/LLMProvider.ts'
import type { LLMProvider, ProviderInput } from '../llm/LLMProvider.ts'

export const publicFunctionLimits = Object.freeze({
  bodyBytes: 48 * 1024, messageChars: 1000, historyMessages: 8, historyChars: 4000,
  promptBytes: 32 * 1024, outputTokens: 600, timeoutMs: 20_000,
  perIpMinute: 6, globalMinute: 30, concurrent: 3, maxIdentities: 4096,
})

/** Best effort per warm Function instance. NOT a distributed quota or a money cap. */
export class FunctionAccess {
  private readonly salt = randomBytes(32)
  private readonly visitors = new Map<string, { start: number; count: number }>()
  private recent = new Map<string, number>()
  private window = 0
  private count = 0
  private active = 0
  private readonly now: () => number
  constructor(now = () => Date.now()) { this.now = now }

  acquire(ip: string | undefined, requestId?: string) {
    if (!ip || !isIP(ip)) throw new ProviderError('CLIENT_UNAVAILABLE', '暂时无法验证请求来源，请使用 Demo。')
    const now = this.now()
    if (now - this.window >= 60_000) { this.window = now; this.count = 0 }
    for (const [key, value] of this.visitors) if (now - value.start >= 60_000) this.visitors.delete(key)
    for (const [key, expires] of this.recent) if (expires <= now) this.recent.delete(key)
    const visitor = createHash('sha256').update(this.salt).update(ip).digest('hex')
    const entry = this.visitors.get(visitor) ?? { start: now, count: 0 }
    if (this.active >= publicFunctionLimits.concurrent) throw new ProviderError('CONCURRENCY_LIMIT', '猪猪心正在回复其他访客，请稍后再试，已切换 Demo。')
    if (this.count >= publicFunctionLimits.globalMinute || entry.count >= publicFunctionLimits.perIpMinute)
      throw new ProviderError('RATE_LIMITED', '消息有点频繁，请稍后再试，已切换 Demo。')
    if (!this.visitors.has(visitor) && this.visitors.size >= publicFunctionLimits.maxIdentities)
      throw new ProviderError('RATE_LIMITED', '当前访客较多，请稍后再试。')
    const duplicate = requestId ? visitor + ':' + requestId : undefined
    if (duplicate && this.recent.has(duplicate)) throw new ProviderError('DUPLICATE_REQUEST', '这条请求已处理，请勿重复发送。')
    if (duplicate) this.recent.set(duplicate, now + 120_000)
    entry.count++; this.visitors.set(visitor, entry); this.count++; this.active++
    let released = false
    return () => { if (!released) { released = true; this.active-- } }
  }
}

/** Every public paid route wraps the existing provider; no duplicate transport or retry. */
export class BoundedFunctionProvider implements LLMProvider {
  readonly id = 'qwen' as const
  private readonly provider: LLMProvider
  constructor(provider: LLMProvider) { this.provider = provider }
  async *stream(input: ProviderInput) {
    if (input.prompt.messages.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'utf8'), 0) > publicFunctionLimits.promptBytes)
      throw new ProviderError('PROMPT_TOO_LONG', '本次上下文过长，请缩短消息或使用 Demo。')
    for await (const chunk of this.provider.stream({ ...input, maxTokens: publicFunctionLimits.outputTokens })) yield chunk
  }
}
