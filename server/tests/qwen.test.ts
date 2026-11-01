import test from 'node:test'
import assert from 'node:assert/strict'
import { QwenProvider } from '../llm/QwenProvider.ts'
import { StreamingDialogue, historyWindow, DisclosureGuard } from '../llm/StreamingDialogue.ts'
import { getQwenConfig } from '../llm/config.ts'
import { CharacterRulesLoader } from '../character/CharacterRulesLoader.ts'
import { CharacterPromptBuilder } from '../prompts/CharacterPromptBuilder.ts'
import { defaultRelationship, initialEnvironment, isSceneInstruction } from '../../src/types/dialogue.ts'
import type { DialogueRequest } from '../../src/types/dialogue.ts'
import { AiDialogueService } from '../../src/services/dialogue/DialogueService.ts'
import { readSse } from '../../src/services/dialogue/sse.ts'
import { chatStore } from '../../src/stores/chatStore.ts'
import { createDialogueHandler } from '../http.ts'
import { createServer } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'

const config = { ...getQwenConfig({}), apiKey: 'mock-secret-only', enabled: true }
const request: DialogueRequest = { mode: 'ai', message: '你好', history: [{ role: 'user', content: '之前的问题' }, { role: 'assistant', content: '之前的回答' }], relationship: defaultRelationship, environment: initialEnvironment }
const rules = await new CharacterRulesLoader().load()
const input = { request, prompt: new CharacterPromptBuilder().build(request, rules, 'text'), signal: new AbortController().signal }
async function collect<T>(stream: AsyncIterable<T>) { const values: T[] = []; for await (const value of stream) values.push(value); return values }
function sse(text: string) { return new Response(text, { headers: { 'Content-Type': 'text/event-stream' } }) }
const modelStream = 'data: {"choices":[{"index":0,"delta":{"content":"你好","reasoning_content":"hidden"}}]}\n\ndata: {"choices":[{"index":0,"delta":{"content":"呀"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'

test('Qwen sends full source and multi-turn messages; streams only content', async () => {
 const provider = new QwenProvider(config, async (_url, init) => {
  const body = JSON.parse(init!.body as string)
  assert.equal(body.messages[1].content, rules.content)
  assert.deepEqual(body.messages.slice(-3), [...request.history, { role: 'user', content: request.message }])
  assert.equal(body.stream, true); assert.equal(body.enable_thinking, false)
  assert.equal((init!.headers as Record<string,string>).Authorization, 'Bearer mock-secret-only')
  return sse(modelStream)
 })
 assert.deepEqual(await collect(provider.stream(input)), ['你好', '呀'])
})
test('billing gate prevents network; upstream failures never expose response bodies or key', async () => {
 let called = false
 await assert.rejects(collect(new QwenProvider({ ...config, enabled: false }, async () => { called = true; return sse('') }).stream(input)), /尚未配置/)
 assert.equal(called, false)
 for (const status of [401,429,500]) await assert.rejects(collect(new QwenProvider(config, async () => new Response(config.apiKey, { status })).stream(input)), error => !String(error).includes(config.apiKey))
 await assert.rejects(collect(new QwenProvider(config, async () => sse('data: {"choices":[{"index":0,"delta":{"content":"partial"}}]}\n\n')).stream(input)), /中断/)
})
test('timeout and cancellation abort upstream', async () => {
 const hanging: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
  const signal = init!.signal!
  if (signal.aborted) reject(new Error('aborted'))
  else signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
 })
 await assert.rejects(collect(new QwenProvider({ ...config, timeoutMs: 10 }, hanging).stream(input)), /超时/)
 const controller = new AbortController(); controller.abort()
 await assert.rejects(collect(new QwenProvider(config, hanging).stream({ ...input, signal: controller.signal })), /停止/)
})
test('bounded history, split disclosure protection and invalid scene instructions', () => {
 assert.deepEqual(historyWindow(request, { ...config, historyPolicy: 'none' }), [])
 assert.deepEqual(historyWindow(request, { ...config, historyMessages: 1 }), [])
 const guard = new DisclosureGuard(['private-secret']); assert.equal(guard.push('hello private-'), 'hello ')
 assert.throws(() => guard.push('secret'), /内部/)
 assert.ok(isSceneInstruction({ reply: '嗯', mood: 'calm', action: 'idle', environment: initialEnvironment }))
 assert.equal(isSceneInstruction({ reply: '嗯', mood: 'calm', action: 'execute', environment: initialEnvironment }), false)
 assert.equal(isSceneInstruction({ reply: '嗯', mood: 'calm', action: 'idle', environment: { ...initialEnvironment, music: 'https://bad' } }), false)
})
test('SSE handles fragmented UTF8 and CRLF', async () => {
 const bytes = new TextEncoder().encode('event: delta\r\ndata: 你好\r\n\r\n')
 const body = new ReadableStream<Uint8Array>({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close() } })
 assert.deepEqual(await collect(readSse(body)), [{ event: 'delta', data: '你好' }])
})
test('client receives incremental text once, validates final result, rejects interrupted streams', async () => {
 const events = await collect(new StreamingDialogue(config, new QwenProvider(config, async () => sse(modelStream))).stream(request, input.signal))
 const wire = events.map(e => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('')
 const originalFetch = globalThis.fetch
 try {
  globalThis.fetch = async () => sse(wire.replace('event: done', `event: delta\ndata: {"seq":1,"text":"你好"}\n\nevent: done`))
  const chunks: string[] = []
  const result = await new AiDialogueService().send(request, undefined, text => chunks.push(text))
  assert.deepEqual(chunks, ['你好','呀']); assert.equal(result.reply, '你好呀'); assert.equal(result.action, 'idle')
  assert.ok(!wire.includes(config.apiKey)); assert.ok(!wire.includes(rules.content))
  globalThis.fetch = async () => sse('event: delta\ndata: {"seq":1,"text":"partial"}\n\n')
  await assert.rejects(new AiDialogueService().send(request), /未完成/)
 } finally { globalThis.fetch = originalFetch }
})
test('store rejects concurrent send, cancellation keeps partial out of history, retry replaces failed turn', async () => {
 const pending = chatStore.send('cancel-test', { mode: 'ai', send: async (_request, signal, delta) => {
  delta?.('partial')
  return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('abort')), { once: true }))
 } })
 assert.equal(chatStore.getSnapshot().pending, true)
 assert.equal(await chatStore.send('duplicate'), false)
 chatStore.cancel(); assert.equal(await pending, false)
 assert.ok(chatStore.getSnapshot().messages.every(entry => entry.failed))
 assert.equal(await chatStore.send('cancel-test', { mode: 'ai', send: async value => {
  assert.deepEqual(value.history, [])
  return { requestId: 'retry', mode: 'ai', reply: 'complete', action: 'idle', environment: initialEnvironment, rules: rules.metadata }
 } }), true)
 assert.equal(chatStore.getSnapshot().messages.length, 2)
})
test('HTTP SSE emits validated frames and client disconnect cancels provider', async () => {
 let disconnected!: () => void
 const cancellation = new Promise<void>(resolve => { disconnected = resolve })
 const streaming = new StreamingDialogue(config, { id: 'qwen', async *stream({ signal }) {
  yield 'first'
  await new Promise<void>(resolve => { signal.addEventListener('abort', () => { disconnected(); resolve() }, { once: true }) })
  signal.throwIfAborted()
 } })
 const server = createServer(createDialogueHandler(undefined, streaming)); server.listen(0, '127.0.0.1'); await once(server, 'listening')
 const abort = new AbortController()
 try {
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/dialogue/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: abort.signal })
  const reader = response.body!.getReader()
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: delta/)
  abort.abort()
  let timer: ReturnType<typeof setTimeout> | undefined
  try { await Promise.race([cancellation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('abort not propagated')), 2000) })]) }
  finally { clearTimeout(timer) }
 } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
