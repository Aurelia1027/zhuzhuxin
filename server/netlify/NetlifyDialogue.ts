import { resolve } from 'node:path'
import { CharacterRulesLoader, RulesLoadError } from '../character/CharacterRulesLoader.ts'
import { CustomCharacterLoader } from '../character/CustomCharacterLoader.ts'
import { DialogueController, InvalidRequestError } from '../dialogue/DialogueController.ts'
import { ActionIntent } from '../llm/ActionIntent.ts'
import { StreamingDialogue } from '../llm/StreamingDialogue.ts'
import { QwenProvider } from '../llm/QwenProvider.ts'
import { getQwenConfig } from '../llm/config.ts'
import type { QwenConfig } from '../llm/config.ts'
import { ProviderError } from '../llm/LLMProvider.ts'
import type { LLMProvider } from '../llm/LLMProvider.ts'
import { isDialogueRequest } from '../../src/types/dialogue.ts'
import type { DialogueResponse } from '../../src/types/dialogue.ts'
import { FunctionAccess, BoundedFunctionProvider, publicFunctionLimits as limits } from '../security/FunctionAccess.ts'

export interface FunctionContext { ip?: string }
interface Options {
  env?: NodeJS.ProcessEnv
  root?: string
  access?: FunctionAccess
  providerFactory?: (config: QwenConfig) => LLMProvider
}
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' }
const json = (status: number, data: unknown, extra: Record<string, string> = {}) => Response.json(data, { status, headers: { ...headers, ...extra } })
const publicError = (status: number, code: string, error: string) => json(status, { code, error, fallback: 'demo' }, status === 429 ? { 'Retry-After': '60' } : {})

export function createNetlifyDialogueHandler(options: Options = {}) {
  const env = options.env ?? process.env
  const access = options.access ?? new FunctionAccess()
  // included_files places the unchanged Markdown under the Function working directory.
  const root = options.root ?? process.cwd()
  const loader = new CharacterRulesLoader(resolve(root, 'docs/character/zhuzhuxin.md'), new CustomCharacterLoader(root, env.CHARACTER_CUSTOM_ENABLED === 'true'))
  const controller = new DialogueController(loader)
  const apiKey = () => env.DASHSCOPE_API_KEY?.trim() || env.QWEN_API_KEY?.trim() || ''
  const enabled = () => env.PUBLIC_QWEN_ENABLED === 'true' && Boolean(apiKey())

  return async (request: Request, context: FunctionContext): Promise<Response> => {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/\.netlify\/functions\/lumi(?=\/|$)/, '/api').replace(/\/$/, '')
    const origin = request.headers.get('origin')
    if (origin && origin !== url.origin) return publicError(403, 'ORIGIN_REJECTED', '不支持跨站请求。')
    if (request.headers.get('sec-fetch-site') === 'cross-site') return publicError(403, 'ORIGIN_REJECTED', '不支持跨站请求。')
    try {
      if (path === '/api/health' && request.method === 'GET') return json(200, { ok: true, paidChat: enabled() ? 'configured' : 'disabled', limiter: 'per-instance' })
      if (path === '/api/character' && request.method === 'GET') return json(200, { ...await controller.metadata(), aiAvailable: enabled() })
      if (!['/api/action-intent', '/api/dialogue', '/api/dialogue/stream'].includes(path)) return publicError(404, 'NOT_FOUND', '接口不存在。')
      if (request.method !== 'POST') return publicError(405, 'METHOD_NOT_ALLOWED', '请使用 POST。')
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return publicError(415, 'JSON_REQUIRED', '仅接受 JSON。')
      const reader = request.body?.getReader()
      if (!reader) return publicError(400, 'INVALID_REQUEST', '消息格式无效。')
      let bytes = 0
      const chunks: Uint8Array[] = []
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > limits.bodyBytes) { await reader.cancel(); return publicError(413, 'TOO_LARGE', '消息内容过长。') }
          chunks.push(value)
        }
      } finally { reader.releaseLock() }
      let value: unknown
      try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return publicError(400, 'INVALID_REQUEST', '消息格式无效。') }
      if (!isDialogueRequest(value)) throw new InvalidRequestError()
      if (value.message.length > limits.messageChars) return publicError(413, 'TOO_LARGE', '每次消息最多 1000 字符。')
      // Keep the shared schema unchanged; bound the public history before prompt construction.
      const history = value.history.slice(-limits.historyMessages)
      while (history.reduce((sum, item) => sum + item.content.length, 0) > limits.historyChars) history.shift()
      value = { ...value, history }
      if (!isDialogueRequest(value)) throw new InvalidRequestError()
      if (path === '/api/action-intent' && value.mode !== 'ai') throw new InvalidRequestError()
      const paid = value.mode === 'ai'
      if (paid && !enabled()) return publicError(503, 'PUBLIC_AI_DISABLED', '真实 AI 暂未开放，已切换 Demo；房间和本地动作仍可使用。')
      const requestId = request.headers.get('x-lumi-request-id') ?? undefined
      if (requestId && !/^[a-zA-Z0-9-]{1,80}$/.test(requestId)) return publicError(400, 'INVALID_REQUEST_ID', '请求标识无效。')
      const release = paid ? access.acquire(context.ip, requestId) : () => {}
      try {
        const config = getQwenConfig({
          ...env, DASHSCOPE_API_KEY: apiKey(), QWEN_ENABLE_PAID_REQUESTS: enabled() ? 'true' : 'false',
          QWEN_TIMEOUT_MS: String(limits.timeoutMs), QWEN_HISTORY_MESSAGES: String(limits.historyMessages), QWEN_HISTORY_CHARS: String(limits.historyChars),
        })
        const provider = paid ? new BoundedFunctionProvider(options.providerFactory?.(config) ?? new QwenProvider(config)) : undefined
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(limits.timeoutMs + 2000)])
        if (path === '/api/action-intent') return json(200, await new ActionIntent(config, provider, loader).respond(value, signal))
        if (path === '/api/dialogue' && !paid) return json(200, await controller.respond(value))
        // Buffer complete, validated SSE frames for predictable Function error/fallback semantics.
        // Wire format is unchanged; token-by-token network delivery is not promised here.
        let frames = '', result: DialogueResponse | undefined
        for await (const event of new StreamingDialogue(config, provider, loader).stream(value, signal)) {
          frames += `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
          if (event.event === 'done') result = event.data
        }
        if (!result) throw new ProviderError('INTERRUPTED', '回复未完整结束，请使用 Demo。')
        return path === '/api/dialogue' ? json(200, result) : new Response(frames, { headers: { ...headers, 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Lumi-Delivery': 'buffered-sse' } })
      } finally { release() }
    } catch (error) {
      if (error instanceof InvalidRequestError) return publicError(400, 'INVALID_REQUEST', '消息、关系配置或环境状态无效。')
      if (error instanceof ProviderError) {
        const busy = ['RATE_LIMITED', 'CONCURRENCY_LIMIT', 'DUPLICATE_REQUEST', 'UPSTREAM_429'].includes(error.code)
        const message = error.code === 'UPSTREAM_429' ? 'AI 额度不足或请求过多，已切换 Demo。' : error.code === 'UPSTREAM_401' || error.code === 'UPSTREAM_403' ? 'AI 服务配置暂不可用，已切换 Demo。' : error.message
        return publicError(busy ? 429 : error.code === 'CANCELLED' ? 408 : 503, error.code, message)
      }
      if (request.signal.aborted || error instanceof DOMException && error.name === 'TimeoutError') return publicError(408, 'TIMEOUT', '回复超时或已取消，请使用 Demo。')
      if (error instanceof RulesLoadError) return publicError(503, 'RULES_UNAVAILABLE', '角色服务暂不可用，请稍后再试。')
      return publicError(503, 'DIALOGUE_FAILED', 'AI 服务暂不可用，已切换 Demo。')
    }
  }
}
