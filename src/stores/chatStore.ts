import { recognizeLocal, parseActionPlan } from '../types/actionCommands.ts'
import { actionBridge } from '../characters/actionBridge.ts'
import { expressionStore } from './expressionStore.ts'
import { normalizeExpression } from '../types/characterExpression.ts'
import { demoReply } from '../services/dialogue/demoReply.ts'
import { useSyncExternalStore } from 'react'
import { defaultRelationship, initialEnvironment, isRelationshipConfig, parseDialogueResponse } from '../types/dialogue.ts'
import type { CharacterAction, DialogueMode, EnvironmentState, RelationshipConfig, RulesMetadata } from '../types/dialogue.ts'
import { DemoDialogueService, AiDialogueService } from '../services/dialogue/DialogueService.ts'
import type { DialogueService } from '../services/dialogue/DialogueService.ts'
import { publishRoomDialogueEvent } from '../services/dialogue/roomEvents.ts'

export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; mode?: DialogueMode | 'local'; failed?: boolean }
export interface ChatState {
  messages: ChatMessage[]
  mode: DialogueMode
  pending: boolean
  error: string | null
  relationship: RelationshipConfig
  environment: EnvironmentState
  apiMetrics?: {calls:number;promptTokens:number;completionTokens:number;lastLatencyMs:number;usageReports:number}
  lastAction: CharacterAction | null
  rules: RulesMetadata | null
}
let state: ChatState = { messages: [], mode: 'demo', pending: false, error: null, relationship: { ...defaultRelationship }, environment: { ...initialEnvironment }, lastAction: null, rules: null }
const listeners = new Set<() => void>()
const service = new DemoDialogueService()
const aiService = new AiDialogueService()
let active: AbortController | null = null
let manualMode = false
function update(patch: Partial<ChatState>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
export const chatStore = {
  setMode(mode: DialogueMode) { if (!state.pending && (mode === 'ai' || mode === 'demo')) {manualMode=true;update({ mode, error: null })} },
  syncAvailability(available:boolean) { if(!state.pending&&!manualMode)update({mode:available?'ai':'demo'}) },
  cancel() { expressionStore.invalidateAI();active?.abort() },
  getSnapshot: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  setRelationship(relationship: RelationshipConfig) {
    if (state.pending || !isRelationshipConfig(relationship)) return false
    update({ relationship: { ...relationship }, error: null }); return true
  },
  syncLighting(lighting: EnvironmentState['lighting']) {
    if (!['day', 'warm', 'night'].includes(lighting)) throw new Error('Invalid lighting')
    if (state.environment.lighting !== lighting) update({ environment: { ...state.environment, lighting } })
  },
  async send(message: string, dialogue?: DialogueService): Promise<boolean> {
    if (state.pending || !message.trim() || message.length > 2000) return false
    const local=recognizeLocal(message)
    if(local.kind!=='chat'){
      const id=crypto.randomUUID();let reply='嗯，收到啦。我会按顺序做，还没完成哦。'
      try{
        if(local.kind==='plan')actionBridge.submit(local.plan,id)
        else if(local.kind==='stop')reply=actionBridge.stop()
        else reply='这个动作我还没学会…可以挥手、听 Rap，或走到床边和书桌旁。'
      }catch(error){reply=error instanceof Error?error.message:'这次动作没有执行。'}
      update({error:null,messages:[...state.messages.slice(-98),{id,role:'user',content:message},{id:id+'-local',role:'assistant',content:reply,mode:'local'}]});return true
    }
    const selected=dialogue??(state.mode==='ai'?aiService:service)
    // A manual retry replaces the failed turn rather than duplicating it.
    const previousUser = [...state.messages].reverse().find(entry => entry.role === 'user')
    const prior = previousUser?.failed && previousUser.content === message
      ? { ...state, messages: state.messages.slice(0, state.messages.indexOf(previousUser)) }
      : state
    const id = crypto.randomUUID()
    const history = prior.messages.filter(entry => !entry.failed).slice(-20).map(({ role, content }) => ({ role, content }))
    update({ pending: true, error: null, messages: [...prior.messages.slice(-98), { id, role: 'user', content: message }] })
    const controller = new AbortController()
    const expressionToken=expressionStore.beginAIRequest()
    active = controller
    const assistantId = crypto.randomUUID()
    const timeout = setTimeout(() => controller.abort(), 185_000)
    let fallbackReason = 'AI 或对话服务暂不可用。'
    try {
      if(!dialogue&&state.mode==='ai'){
        const response=await fetch('/api/action-intent',{method:'POST',headers:{'Content-Type':'application/json','X-Lumi-Request-Id':id},body:JSON.stringify({mode:'ai',message,history,relationship:{...prior.relationship},environment:{...prior.environment}}),signal:controller.signal})
        const raw:unknown=await response.json();if(!raw||typeof raw!=='object')throw new Error('AI 回复格式无效。');const result=raw as {reply?:unknown;commands?:unknown;expression?:unknown;error?:unknown;code?:unknown;metrics?:ChatState['apiMetrics']}
        if(!response.ok){
          fallbackReason=result.code==='QWEN_QUOTA_EXHAUSTED'?'AI 额度已用尽或账户暂不可用。':['UPSTREAM_429','RATE_LIMITED','CONCURRENCY_LIMIT'].includes(String(result.code))?'AI 请求较多或额度受限。':result.code==='TIMEOUT'?'AI 回复超时。':result.code==='PUBLIC_AI_DISABLED'?'真实 AI 暂未开放。':fallbackReason
          update({apiMetrics:result.metrics});throw new Error(typeof result.error==='string'?result.error:'AI 暂时不可用，本地动作仍可使用。')
        }
        if(typeof result.reply!=='string'||result.reply.length>1200)throw new Error('AI 回复无效，未执行动作。')
        const plan=parseActionPlan({commands:result.commands});controller.signal.throwIfAborted()
        if(plan.commands.length)actionBridge.submit(plan,id)
        expressionStore.applyAI(normalizeExpression(result.expression),expressionToken)
        update({pending:false,messages:[...state.messages,{id:assistantId,role:'assistant',content:result.reply,mode:'ai'}],apiMetrics:result.metrics})
        return true
      }
      const response = parseDialogueResponse(await selected.send({ mode: selected.mode, message, history, relationship: { ...prior.relationship }, environment: { ...prior.environment } }, controller.signal, text => {
        controller.signal.throwIfAborted()
        const current = state.messages.find(entry => entry.id === assistantId)
        update({ messages: current ? state.messages.map(entry => entry.id === assistantId ? { ...entry, content: entry.content + text } : entry) : [...state.messages, { id: assistantId, role: 'assistant', mode: selected.mode, content: text }] })
      }))
      controller.signal.throwIfAborted()
      if (response.mode !== selected.mode) throw new Error('对话模式不一致。')
      update({ pending: false, messages: [...state.messages.filter(entry => entry.id !== assistantId), { id: response.requestId, role: 'assistant', content: response.reply, mode: response.mode }], environment: response.mode === 'ai' ? state.environment : response.environment, lastAction: response.action, rules: response.rules })
      if (response.mode === 'demo') publishRoomDialogueEvent({ type: 'room.environment.requested', requestId: response.requestId, environment: response.environment })
      return true
    } catch (error) {
      if(!controller.signal.aborted&&!dialogue){
        // No extra API request, action dispatch or expression update during fallback.
        const fallback=demoReply({mode:'demo',message,history,relationship:prior.relationship,environment:prior.environment})
        manualMode=true
        update({pending:false,mode:'demo',error:fallbackReason+'已切换 Demo（预设回复）；可以稍后手动重试 AI。',messages:[...state.messages.filter(entry=>entry.id!==assistantId),{id:assistantId,role:'assistant',content:fallback.reply,mode:'demo'}]})
        return true
      }
      update({ pending: false, error: controller.signal.aborted ? '已停止生成，可重新发送。' : error instanceof Error ? error.message : '请求失败，请重试。', messages: state.messages.map(entry => (entry.id === id || entry.id === assistantId) ? { ...entry, failed: true } : entry) })
      return false
    } finally { clearTimeout(timeout); active = null }
  },
}
export function useChatStore() { return useSyncExternalStore(chatStore.subscribe, chatStore.getSnapshot, chatStore.getSnapshot) }
