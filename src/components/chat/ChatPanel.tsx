import { actionBridge } from '../../characters/actionBridge'
import { CharacterExpressionControls } from '../CharacterExpressionControls'
import { characterIdentity } from '../../types/characterIdentity.ts'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent, PointerEvent } from 'react'
import { getCharacterMetadata } from '../../services/dialogue/DialogueService.ts'
import { chatStore, useChatStore } from '../../stores/chatStore.ts'
import { defaultRelationship } from '../../types/dialogue.ts'
import type { CharacterMetadata } from '../../types/dialogue.ts'
import { useMobileChatLayout } from './useMobileChatLayout'
import './chat.css'

export function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [metadata, setMetadata] = useState<CharacterMetadata | null>(null)
  const [metadataError, setMetadataError] = useState('')
  const [relationshipMode, setRelationshipMode] = useState<'rules-default' | 'user-defined'>('rules-default')
  const [description, setDescription] = useState('')
  const [addressAs, setAddressAs] = useState('')
  const [relationshipFeedback, setRelationshipFeedback] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const composing = useRef(false)
  const nearBottom = useRef(true)
  const savedScroll = useRef(0)
  const previousMessage = useRef<string | undefined>(undefined)
  const mobile = useMobileChatLayout(open)
  const chat = useChatStore()
  const actionState = useSyncExternalStore(actionBridge.subscribe, actionBridge.getSnapshot, actionBridge.getSnapshot)
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setMetadataError('')
    void getCharacterMetadata(controller.signal).then(value => { setMetadata(value); chatStore.syncAvailability(value.aiAvailable) }).catch(error => {
      if (!controller.signal.aborted) setMetadataError(error instanceof Error ? error.message : '规则加载失败。')
    })
    // Do not summon a phone keyboard merely by expanding the conversation.
    if (!mobile) input.current?.focus({ preventScroll: true })
    return () => controller.abort()
  }, [open, mobile])
  useLayoutEffect(() => {
    if (open && log.current) log.current.scrollTop = nearBottom.current ? log.current.scrollHeight : savedScroll.current
  }, [open])
  useEffect(() => {
    const last = chat.messages.at(-1)
    const ownMessage = last?.role === 'user' && last.id !== previousMessage.current
    previousMessage.current = last?.id
    if (open && log.current && (nearBottom.current || ownMessage)) log.current.scrollTop = log.current.scrollHeight
  }, [chat.messages, chat.pending, open])
  const close = () => {
    if (log.current) savedScroll.current = log.current.scrollTop
    input.current?.blur()
    setSettingsOpen(false); setOpen(false)
    if (!mobile) launcher.current?.focus({ preventScroll: true })
  }
  const preserveInputFocus = (event: PointerEvent<HTMLButtonElement>) => {
    if (mobile && document.activeElement === input.current) event.preventDefault()
  }
  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (composing.current || !draft.trim() || chat.pending) return
    const sent = draft
    setDraft('')
    if (!await chatStore.send(sent)) setDraft(value => value || sent)
    // Preserve the user's current touch focus; never reopen a dismissed keyboard after a reply.
    if (!mobile) input.current?.focus({ preventScroll: true })
  }
  const saveRelationship = () => {
    const value = relationshipMode === 'rules-default' ? { ...defaultRelationship } : { mode: 'user-defined' as const, description, addressAs }
    setRelationshipFeedback(chatStore.setRelationship(value) ? '关系设置已应用，后续请求生效。' : '请填写相处方式；发送消息期间请稍后再修改。')
  }
  const rules = chat.rules ?? metadata
  return <>
    <button ref={launcher} className="chat-launcher" type="button" aria-expanded={open} aria-controls="character-chat" onClick={() => open ? close() : setOpen(true)}>和{characterIdentity.nickname}聊聊 <span>{chat.mode === 'ai' ? 'QWEN' : 'DEMO'}</span></button>
    {open && <section id="character-chat" className="character-chat" role="region" aria-labelledby="chat-title"
      onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) close() }}>
      <header className="chat-header"><div><span className="chat-eyebrow">LUMI ROOM · CHARACTER LAB</span><h2 id="chat-title">{characterIdentity.displayName} <span>{chat.mode === 'ai' ? 'Qwen AI' : 'Demo Mode'}</span></h2></div><button type="button" aria-label={mobile ? '收起聊天' : '关闭聊天'} onClick={close}><span className="chat-close-desktop">×</span><span className="chat-close-mobile">收起⌄</span></button></header>
      <p className="chat-disclaimer">{chat.mode === 'ai' ? '虚拟角色扮演 · Qwen AI 生成，不代表现实人物本人。' : '虚拟角色扮演 · 预设测试回复，非真实 AI 生成。'}</p>
      <div className="chat-mode-row">
        <label className="chat-rule-status chat-mode-switch">对话模式 <select aria-label="对话模式" value={chat.mode} disabled={chat.pending} onChange={event => chatStore.setMode(event.target.value as 'demo' | 'ai')}><option value="demo">Demo · 离线演示</option><option value="ai" disabled={!metadata?.aiAvailable}>Qwen AI{!metadata?.aiAvailable && ' · 尚未启用'}</option></select></label>
        <button className="chat-settings-toggle" type="button" aria-expanded={settingsOpen} aria-controls="chat-settings" onClick={() => setSettingsOpen(value => !value)}>{settingsOpen ? '收起设置' : '设置 / 表情'}</button>
      </div>
      <div id="chat-settings" className={`chat-settings-body${settingsOpen ? ' is-open' : ''}`}>
        <div className="chat-rule-status" role="status">{metadataError ? '角色服务暂不可用 · 本地 Demo 预设仍可使用' : rules ? `角色规则 v${rules.version} · 服务端加载` : '正在检查角色规则…'}</div>
        <details className="chat-relationship"><summary>相处方式 · {chat.relationship.mode === 'rules-default' ? '原稿默认' : '用户自定义'}</summary>
          <label>关系模式<select aria-label="关系模式" disabled={chat.pending} value={relationshipMode} onChange={event => { setRelationshipMode(event.target.value as typeof relationshipMode); setRelationshipFeedback('') }}><option value="rules-default">遵循原稿第 06 节</option><option value="user-defined">由我指定相处方式</option></select></label>
          {relationshipMode === 'user-defined' && <><label>相处方式<input aria-label="相处方式" value={description} maxLength={280} disabled={chat.pending} onChange={event => setDescription(event.target.value)} placeholder="填写你希望的相处方式" /></label><label>希望被称呼为<input aria-label="希望被称呼为" value={addressAs} maxLength={40} disabled={chat.pending} onChange={event => setAddressAs(event.target.value)} placeholder="可留空，按原稿称呼" /></label></>}
          <button type="button" disabled={chat.pending} onClick={saveRelationship}>应用关系设置</button><p role="status">{relationshipFeedback || '关系设置独立保存，不改写角色原稿。Demo 仅演示称呼，不模拟关系演变。'}</p>
        </details>
        <div className="chat-room-status" aria-label="对话房间状态"><span>灯光：{chat.environment.lighting}</span><span>天气请求：{chat.environment.weather}</span><span>音乐请求：{chat.environment.music}</span><span>动作请求：{chat.lastAction ?? '—'}</span><small role="status" data-testid="action-bridge-status">{actionState.message} · 待执行 {actionState.pending}</small><button type="button" onClick={() => actionBridge.stop()}>取消待执行动作</button></div>
        {(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV && chat.apiMetrics && <details className="chat-metrics"><summary>API 用量（开发）</summary><pre>{JSON.stringify(chat.apiMetrics, null, 2)}</pre></details>}
        <details className="chat-expressions"><summary>猪猪心表情</summary><CharacterExpressionControls /></details>
      </div>
      <div ref={log} className="chat-log" role="log" aria-label="聊天记录" aria-live="polite" aria-relevant="additions text" onScroll={event => {
        const element = event.currentTarget
        nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 60
        savedScroll.current = element.scrollTop
      }}>
        {chat.messages.length === 0 && <p className="chat-empty">试着说声“你好”，或告诉他你想休息、学习。</p>}
        {chat.messages.map(message => <article className={`chat-message ${message.role}`} key={message.id}><small>{message.role === 'user' ? '你' : `${characterIdentity.displayName} · ${message.mode === 'ai' ? 'AI 生成' : message.mode === 'local' ? '本地动作' : 'Demo 测试回复'}`}{message.failed && ' · 发送失败'}</small><p>{message.content}</p></article>)}
        {chat.pending && <p className="chat-waiting">{chat.mode === 'ai' ? '猪猪心正在回复…' : '正在准备 Demo 回复…'}</p>}
      </div>
      {chat.error && <p className="chat-error" role="alert">{chat.error}</p>}
      <form className="chat-composer" onSubmit={event => { void send(event) }}><label htmlFor="chat-message">发送消息</label><textarea ref={input} id="chat-message" aria-label="聊天消息" rows={2} maxLength={1000} value={draft} disabled={chat.pending && !mobile} readOnly={chat.pending}
        onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
        onChange={event => setDraft(event.target.value)} placeholder="说点什么…" onKeyDown={event => {
          if (event.key === 'Enter' && !mobile && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void send(event) }
        }} /><div><small>{mobile ? 'Enter 换行 · 点击发送' : 'Enter 发送 · Shift+Enter 换行'}</small><button type="submit" disabled={chat.pending || !draft.trim()} onPointerDown={preserveInputFocus}>发送 / 重试</button>{chat.pending && <button type="button" onPointerDown={preserveInputFocus} onClick={() => chatStore.cancel()}>停止生成</button>}</div></form>
    </section>}
  </>
}
