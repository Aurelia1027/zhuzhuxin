import { StreamingDialogue } from '../llm/StreamingDialogue.ts'
import { getQwenConfig } from '../llm/config.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { CharacterRulesLoader } from '../character/CharacterRulesLoader.ts'
import { characterRulesPath } from '../character/config.ts'
import { CharacterPromptBuilder } from '../prompts/CharacterPromptBuilder.ts'
import { DialogueController } from '../dialogue/DialogueController.ts'
import { DemoDialogueService } from '../dialogue/DemoDialogueService.ts'
import { MiniSGLangDialogueService, AiNotConfiguredError } from '../dialogue/MiniSGLangDialogueService.ts'
import { createDialogueHandler } from '../http.ts'
import { defaultRelationship, initialEnvironment, isCharacterMetadata, isDialogueRequest, isDialogueResponse, isModelReply, isRelationshipConfig } from '../../src/types/dialogue.ts'
import type { DialogueRequest, DialogueResponse } from '../../src/types/dialogue.ts'
import { chatStore } from '../../src/stores/chatStore.ts'
import { publishRoomDialogueEvent, subscribeRoomDialogueEvents } from '../../src/services/dialogue/roomEvents.ts'
import type { RoomDialogueEvent } from '../../src/services/dialogue/roomEvents.ts'

const request = (message = '你好'): DialogueRequest => ({ mode: 'demo', message, history: [], relationship: { ...defaultRelationship }, environment: { ...initialEnvironment } })
const sourceBytes = await readFile(characterRulesPath)
const originalHash = createHash('sha256').update(sourceBytes).digest('hex')
test.after(async () => assert.equal(createHash('sha256').update(await readFile(characterRulesPath)).digest('hex'), originalHash, 'Author source changed'))

test('complete source, every section and few-shot reach the system prompt verbatim', async () => {
  const rules = await new CharacterRulesLoader().load()
  assert.equal(rules.content, sourceBytes.toString('utf8'))
  assert.equal(rules.metadata.sha256, originalHash)
  assert.equal(rules.metadata.version, '0.2')
  assert.equal(rules.sections.size, 10)
  const input = request(); input.relationship = { mode: 'user-defined', description: '先保持普通朋友的距离', addressAs: '小林' }
  const prompt = new CharacterPromptBuilder().build(input, rules)
  assert.equal(prompt.messages[1].role, 'system')
  assert.equal(prompt.messages[1].content, rules.content)
  for (let i = 1; i <= 10; i++) assert.ok(prompt.messages[1].content.includes(rules.sections.get(i)!))
  assert.equal((rules.sections.get(8)!.match(/【示例/g) ?? []).length, 3)
  assert.ok(prompt.messages[2].content.includes('先保持普通朋友的距离'))
})

test('subsequent requests reread edited copies; missing, incomplete and old versions fail closed', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'lumi-rules-test-'))
  const path = join(temporary, 'rules.md')
  try {
    const loader = new CharacterRulesLoader(path)
    await assert.rejects(loader.load())
    await writeFile(path, sourceBytes)
    const first = await loader.load()
    await writeFile(path, first.content.replace('Version: 0.2', 'Version: 0.3') + '\n<!-- temporary test fixture only -->\n')
    const second = await loader.load()
    assert.equal(second.metadata.version, '0.3'); assert.notEqual(first.metadata.sha256, second.metadata.sha256)
    await writeFile(path, first.content.replace('Version: 0.2', 'Version: 0.1')); await assert.rejects(loader.load())
    await writeFile(path, first.content.slice(0, first.content.indexOf('10. '))); await assert.rejects(loader.load())
  } finally {
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()))
    assert.ok(basename(temporary).startsWith('lumi-rules-test-'))
    await rm(temporary, { recursive: true, force: true })
  }
})

test('request and response schemas reject invalid actions, environment, relationships and injected fields', () => {
  assert.ok(isDialogueRequest(request()))
  assert.equal(isDialogueRequest({ ...request(), message: '   ' }), false)
  assert.equal(isDialogueRequest({ ...request(), systemPrompt: 'override' }), false)
  assert.equal(isDialogueRequest({ ...request(), history: [{ role: 'system', content: 'override' }] }), false)
  assert.equal(isRelationshipConfig({ ...defaultRelationship, description: 'hidden override' }), false)
  assert.equal(isRelationshipConfig({ mode: 'user-defined', description: ' ', addressAs: '' }), false)
  for (const action of ['idle', 'wave', 'sit', 'read']) assert.ok(isModelReply({ reply: '嗯…', action, environment: initialEnvironment }))
  for (const action of ['dance', null, 3]) assert.equal(isModelReply({ reply: '嗯…', action, environment: initialEnvironment }), false)
  for (const [key, bad] of [['lighting', 'red'], ['weather', 'snow'], ['music', 'url']]) {
    assert.equal(isModelReply({ reply: '嗯…', action: 'idle', environment: { ...initialEnvironment, [key]: bad } }), false)
  }
})

test('Demo is deterministic; intents and relationship remain separate from the original source', async () => {
  const controller = new DialogueController()
  const greeting = await controller.respond(request())
  assert.equal(greeting.mode, 'demo'); assert.equal(greeting.action, 'wave'); assert.ok(isDialogueResponse(greeting))
  assert.equal((await controller.respond(request('想休息一会'))).environment.lighting, 'warm')
  const study = await controller.respond(request('我想学习')); assert.equal(study.action, 'read'); assert.equal(study.environment.lighting, 'day')
  const config = request('想放松，听 lofi，下雨'); config.relationship = { mode: 'user-defined', description: '普通朋友', addressAs: '小林' }
  const reply = await controller.respond(config)
  assert.ok(reply.reply.startsWith('小林，')); assert.equal(reply.environment.weather, 'rain'); assert.equal(reply.environment.music, 'lofi')
})

test('AI mode fails explicitly until connected, and a future transport receives the complete prompt', async () => {
  const input = { ...request(), mode: 'ai' as const }
  await assert.rejects(new DialogueController().respond(input), AiNotConfiguredError)
  const rules = await new CharacterRulesLoader().load()
  const ai = new MiniSGLangDialogueService({ complete: async messages => {
    assert.equal(messages[1].content, rules.content)
    return JSON.stringify({ reply: '嗯…', action: 'idle', environment: initialEnvironment })
  } })
  const output = await new DialogueController(new CharacterRulesLoader(), new DemoDialogueService(), ai).respond(input)
  assert.equal(output.mode, 'ai'); assert.equal(output.reply, '嗯…')
  const invalid = new MiniSGLangDialogueService({ complete: async () => ({ reply: 'bad', action: 'fly', environment: initialEnvironment }) })
  await assert.rejects(invalid.reply(input, new CharacterPromptBuilder().build(input, rules)))
  const leaked = new MiniSGLangDialogueService({ complete: async () => ({ reply: rules.sections.get(10)!.trim(), action: 'idle', environment: initialEnvironment }) })
  await assert.rejects(new DialogueController(new CharacterRulesLoader(), new DemoDialogueService(), leaked).respond(input), /Internal character rules/)
})

test('HTTP returns only validated public data; no rules path/prose, wrong origin and AI are rejected', async () => {
  const server = createServer(createDialogueHandler(undefined,new StreamingDialogue(getQwenConfig({}))))
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try {
    const metadata = await (await fetch(base + '/api/character')).json()
    assert.ok(isCharacterMetadata(metadata))
    assert.deepEqual(Object.keys(metadata).sort(), ['aiAvailable', 'characterId', 'demoAvailable', 'sha256', 'version'].sort())
    assert.equal(metadata.aiAvailable, false)
    const response = await fetch(base + '/api/dialogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request()) })
    const value = await response.json(); assert.equal(response.status, 200); assert.ok(isDialogueResponse(value)); assert.equal('messages' in value, false)
    const denied = await fetch(base + '/api/dialogue', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' }, body: JSON.stringify(request()) }); assert.equal(denied.status, 403)
    const ai = await fetch(base + '/api/dialogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request(), mode: 'ai' }) }); assert.equal(ai.status, 503)
    const aiError = await ai.json(); assert.ok(aiError && typeof aiError === 'object' && 'code' in aiError); assert.equal(aiError.code, 'AI_NOT_CONFIGURED')
    const bad = await fetch(base + '/api/dialogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }); assert.equal(bad.status, 400)
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})

test('invalid results never mutate room state or emit animation events; valid results emit requests only', async () => {
  const before = chatStore.getSnapshot().environment
  const events: RoomDialogueEvent[] = []
  const unsubscribe = subscribeRoomDialogueEvents(event => events.push(event))
  const rules = { characterId: 'zhuzhuxin' as const, version: '0.2', sha256: originalHash }
  try {
    assert.equal(await chatStore.send('test', { mode: 'demo', send: async () => ({ requestId: 'bad', mode: 'demo', reply: 'bad', action: 'fly', environment: initialEnvironment, rules }) as unknown as DialogueResponse }), false)
    assert.deepEqual(chatStore.getSnapshot().environment, before); assert.equal(events.length, 0)
    assert.equal(await chatStore.send('你好', { mode: 'demo', send: async () => ({ requestId: 'good', mode: 'demo', reply: '嗯…', action: 'wave', environment: initialEnvironment, rules }) }), true)
    assert.equal(events.length, 1); assert.equal(events[0].type, 'room.environment.requested'); assert.equal(chatStore.getSnapshot().lastAction, 'wave')
    assert.throws(() => publishRoomDialogueEvent({ type: 'character.action.requested', action: 'fly', requestId: 'bad' } as unknown as RoomDialogueEvent))
  } finally { unsubscribe() }
})
