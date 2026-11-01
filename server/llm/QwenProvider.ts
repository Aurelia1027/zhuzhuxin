import { llmMetrics } from './llmMetrics.ts'
import { readSse } from '../../src/services/dialogue/sse.ts'
import type { QwenConfig } from './config.ts'
import { ProviderError } from './LLMProvider.ts'
import type { LLMProvider, ProviderInput } from './LLMProvider.ts'

export class QwenProvider implements LLMProvider {
  readonly id = 'qwen' as const
  private readonly config: QwenConfig
  private readonly request: typeof fetch
  constructor(config: QwenConfig, request: typeof fetch = fetch) { this.config = config; this.request = request }
  async *stream(input: ProviderInput) {
    if (!this.config.apiKey || !this.config.enabled) throw new ProviderError('AI_NOT_CONFIGURED', 'Qwen 尚未配置或未启用计费请求，请先使用 Demo。')
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), this.config.timeoutMs)
    const signal = AbortSignal.any([input.signal, timeout.signal])
    const started=performance.now()
    llmMetrics.calls++
    try {
      const response = await this.request(this.config.baseUrl + '/chat/completions', {
        method: 'POST', redirect: 'error', signal,
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, messages: input.prompt.messages, stream: true, enable_thinking: false, response_format: input.jsonMode ? {type: 'json_object'} : undefined, max_tokens: input.maxTokens ?? 1200, stream_options: { include_usage: true } }),
      })
      if (!response.ok) {
        // Inspect only an allowlisted error code from a bounded body; never forward raw details.
        let quota = false
        const reader = response.body?.getReader()
        if (reader) {
          try {
            let size = 0; const parts:Uint8Array[]=[]
            for (;;) { const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>8192)break;parts.push(chunk.value) }
            if(size<=8192){
              const parsed=JSON.parse(Buffer.concat(parts).toString('utf8'))
              const code=parsed?.error?.code??parsed?.code
              quota=typeof code==='string'&&['Arrearage','AllocationQuota.FreeTierOnly','insufficient_quota','QuotaExhausted'].includes(code)
            }
          } catch {/* Unrecognized upstream bodies stay private. */}
          finally {await reader.cancel().catch(()=>{});reader.releaseLock()}
        }
        if(quota)throw new ProviderError('QWEN_QUOTA_EXHAUSTED','AI 额度已用尽或账户暂不可用，请使用 Demo。')
        const message = response.status === 401 || response.status === 403 ? 'Qwen 鉴权失败，请检查 Key 与服务地域是否一致。'
          : response.status === 429 ? 'Qwen 请求过于频繁或额度不足，请稍后手动重试。'
          : 'Qwen 服务暂时不可用，请稍后手动重试。'
        throw new ProviderError('UPSTREAM_' + response.status, message)
      }
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new ProviderError('INVALID_STREAM', '模型返回的流格式不正确。')
      let finished = false, size = 0
      for await (const frame of readSse(response.body, signal)) {
        if (frame.data === '[DONE]') { if (!finished) throw new ProviderError('INTERRUPTED', '回复未完整结束，请重试。'); llmMetrics.completed++; return }
        const value = JSON.parse(frame.data)
        if(value.usage){
          const promptTokens=value.usage.prompt_tokens,completionTokens=value.usage.completion_tokens
          if(Number.isSafeInteger(promptTokens)&&promptTokens>=0&&Number.isSafeInteger(completionTokens)&&completionTokens>=0){
            llmMetrics.promptTokens+=promptTokens;llmMetrics.completionTokens+=completionTokens;llmMetrics.usageReports++
            input.onUsage?.({promptTokens,completionTokens})
          }
        }
        if (value.error) throw new ProviderError('UPSTREAM_ERROR', 'Qwen 返回异常，请稍后重试。')
        const choice = value.choices?.find((entry: { index?: number }) => entry.index === 0)
        if (!choice) continue
        if (choice.finish_reason && choice.finish_reason !== 'stop') throw new ProviderError('INCOMPLETE_REPLY', '回复达到限制或被服务中止，请缩短问题后重试。')
        if (choice.finish_reason === 'stop') finished = true
        const text: unknown = choice.delta?.content
        if (text !== undefined && text !== null && typeof text !== 'string') throw new ProviderError('INVALID_STREAM', '模型返回的数据格式不正确。')
        if (typeof text === 'string' && text) {
          size += text.length
          if (size > 4000) throw new ProviderError('REPLY_TOO_LONG', '回复过长，已停止生成。')
          yield text
        }
        // reasoning_content and tool calls are never forwarded or executed.
      }
      if (!finished) throw new ProviderError('INTERRUPTED', '连接中断，回复未完成。请手动重试。')
      llmMetrics.completed++
    } catch (error) {
      llmMetrics.errors++
      if (input.signal.aborted) throw new ProviderError('CANCELLED', '已停止生成。')
      if (timeout.signal.aborted) throw new ProviderError('TIMEOUT', 'Qwen 响应超时，请稍后重试。')
      if (error instanceof ProviderError) throw error
      // Do not forward raw bodies, SDK errors, URLs, credentials or prompts.
      throw new ProviderError('NETWORK_ERROR', '连接 Qwen 失败或流已损坏，请稍后重试。')
    } finally { clearTimeout(timer); llmMetrics.lastLatencyMs=performance.now()-started }
  }
}
