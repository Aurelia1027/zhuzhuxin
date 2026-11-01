import { readSse } from './sse.ts'
import { isCharacterMetadata, isDialogueRequest, parseDialogueResponse } from '../../types/dialogue.ts'
import type { CharacterMetadata, DialogueMode, DialogueRequest, DialogueResponse } from '../../types/dialogue.ts'

export interface DialogueService {
  readonly mode: DialogueMode
  send(request: DialogueRequest, signal?: AbortSignal, onDelta?: (text: string) => void): Promise<DialogueResponse>
}
class HttpDialogueService implements DialogueService {
  readonly mode: DialogueMode
  constructor(mode: DialogueMode) { this.mode = mode }
  async send(request: DialogueRequest, signal?: AbortSignal) {
    if (!isDialogueRequest(request) || request.mode !== this.mode) throw new Error('请求格式或对话模式不正确。')
    const response = await fetch('/api/dialogue', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal,
    })
    const value: unknown = await response.json()
    if (!response.ok) {
      const message = typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
        ? value.error : '对话服务暂时不可用。'
      throw new Error(message)
    }
    const validated = parseDialogueResponse(value)
    if (validated.mode !== this.mode) throw new Error('返回的对话模式与请求不一致，未应用任何动作。')
    return validated
  }
}
export class DemoDialogueService extends HttpDialogueService { constructor() { super('demo') } }
export class AiDialogueService implements DialogueService {
  readonly mode = 'ai' as const
  async send(request: DialogueRequest, signal?: AbortSignal, onDelta?: (text: string) => void) {
    if (!isDialogueRequest(request) || request.mode !== 'ai') throw new Error('请求格式无效。')
    const response = await fetch('/api/dialogue/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal })
    if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('对话服务暂时不可用，请重试。')
    let seq = 0, content = ''
    for await (const frame of readSse(response.body, signal)) {
      const value = JSON.parse(frame.data)
      if (frame.event === 'error') throw new Error(typeof value.error === 'string' ? value.error : '生成中断，请重试。')
      if (frame.event === 'delta') {
        if (!Number.isInteger(value.seq) || typeof value.text !== 'string') throw new Error('回复流格式无效。')
        if (value.seq <= seq) continue
        if (value.seq !== seq + 1 || content.length + value.text.length > 4000) throw new Error('回复流不完整。')
        seq = value.seq; content += value.text; onDelta?.(value.text)
      } else if (frame.event === 'done') {
        const result = parseDialogueResponse(value)
        if (result.mode !== 'ai' || result.reply !== content) throw new Error('回复校验失败。')
        return result
      }
    }
    throw new Error('连接中断，回复未完成，请手动重试。')
  }
}
export async function getCharacterMetadata(signal?: AbortSignal): Promise<CharacterMetadata> {
  const response = await fetch('/api/character', { cache: 'no-store', signal })
  const value: unknown = await response.json()
  if (!response.ok || !isCharacterMetadata(value)) throw new Error('角色规则暂时不可用，请检查服务端原稿与版本。')
  return value
}
