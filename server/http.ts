import { ActionIntent } from './llm/ActionIntent.ts'
import { llmMetrics } from './llm/llmMetrics.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { DialogueController, InvalidRequestError } from './dialogue/DialogueController.ts'
import { AiNotConfiguredError } from './dialogue/MiniSGLangDialogueService.ts'
import { RulesLoadError } from './character/CharacterRulesLoader.ts'

import { StreamingDialogue } from './llm/StreamingDialogue.ts'
import { ProviderError } from './llm/LLMProvider.ts'
import { isDialogueRequest } from '../src/types/dialogue.ts'
import { allowsProductionAi, createApiRateLimit } from './security/PublicApiPolicy.ts'

const MAX_BODY_BYTES = 128 * 1024
function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(body))
}
export function createDialogueHandler(controller = new DialogueController(), streaming = new StreamingDialogue(), intent = new ActionIntent()) {
  const rateLimit=createApiRateLimit()
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const path = request.url?.split('?')[0]
    const origin = request.headers.origin
    if (origin && origin !== `http://${request.headers.host}` && origin !== `https://${request.headers.host}`) {
      json(response, 403, { code: 'ORIGIN_REJECTED', error: '请求来源不受支持。' }); return
    }
    try {
      if(process.env.NODE_ENV==='production'&&!rateLimit()){json(response,429,{code:'RATE_LIMITED',error:'请求有点频繁，请稍后再试。'});return}
      if(path==='/api/health'&&request.method==='GET'){json(response,200,{ok:true,paidChat:allowsProductionAi()?'local-configured':'disabled'});return}
      if (path === '/api/character' && request.method === 'GET') { json(response, 200, { ...await controller.metadata(), aiAvailable: allowsProductionAi()&&streaming.available() }); return }
      if (path !== '/api/dialogue' && path !== '/api/dialogue/stream' && path !== '/api/action-intent') { json(response, 404, { code: 'NOT_FOUND', error: '接口不存在。' }); return }
      if (request.method !== 'POST') { json(response, 405, { code: 'METHOD_NOT_ALLOWED', error: '请使用 POST。' }); return }
      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        json(response, 415, { code: 'JSON_REQUIRED', error: '仅接受 JSON 数据。' }); return
      }
      const chunks: Buffer[] = []; let bytes = 0
      for await (const chunk of request) {
        const buffer = Buffer.from(chunk); bytes += buffer.length
        if (bytes > MAX_BODY_BYTES) { json(response, 413, { code: 'TOO_LARGE', error: '消息内容过长。' }); return }
        chunks.push(buffer)
      }
      let value: unknown
      try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new InvalidRequestError() }
      if(!allowsProductionAi()&&(path==='/api/action-intent'||(value&&typeof value==='object'&&'mode'in value&&value.mode==='ai'))){json(response,503,{code:'PUBLIC_AI_DISABLED',error:'公开演示暂未开放付费聊天；本地动作、表情和Demo仍可使用。'});return}
      if(path === '/api/action-intent'){
        const abort=new AbortController();const close=()=>abort.abort();response.on('close',close)
        try{const result=await intent.respond(value,abort.signal);json(response,200,{...result,...(process.env.NODE_ENV!=='production'?{metrics:{...llmMetrics}}:{})})}
        finally{response.off('close',close)}
        return
      }
      if (path === '/api/dialogue/stream') {
        if (!isDialogueRequest(value)) throw new InvalidRequestError()
        const abort = new AbortController()
        const close = () => abort.abort()
        response.on('close', close)
        response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' })
        response.flushHeaders()
        const heartbeat = setInterval(() => { if (!response.destroyed) response.write(': heartbeat\n\n') }, 10000)
        try {
          for await (const event of streaming.stream(value, abort.signal)) {
            if (abort.signal.aborted) break
            response.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`)
          }
        } catch (error) {
          if (!abort.signal.aborted) response.write(`event: error\ndata: ${JSON.stringify({ error: error instanceof ProviderError ? error.message : '对话暂时不可用，请重试。' })}\n\n`)
        } finally { clearInterval(heartbeat); response.off('close', close); response.end() }
        return
      }
      json(response, 200, await controller.respond(value))
    } catch (error) {
      if (error instanceof InvalidRequestError) json(response, 400, { code: 'INVALID_REQUEST', error: '消息、关系配置或环境状态无效。' })
      else if (error instanceof ProviderError) json(response, 503, {code:error.code,error:error.message,...(path==='/api/action-intent'&&process.env.NODE_ENV!=='production'?{metrics:{...llmMetrics},diagnostics:error.diagnostics}:{})})
      else if (error instanceof AiNotConfiguredError) json(response, 503, { code: 'AI_NOT_CONFIGURED', error: error.message })
      else if (error instanceof RulesLoadError) json(response, 503, { code: 'RULES_UNAVAILABLE', error: error.message })
      else json(response, 500, { code: 'DIALOGUE_FAILED', error: '对话暂时不可用，未执行房间动作。' })
    }
  }
}
