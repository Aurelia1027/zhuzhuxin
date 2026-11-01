import test from 'node:test'
import assert from 'node:assert/strict'
import {recognizeLocal,parseActionPlan} from '../../src/types/actionCommands.ts'
import {ActionBridge} from '../../src/characters/actionBridge.ts'
import {ActionIntent} from '../llm/ActionIntent.ts'
import {getQwenConfig} from '../llm/config.ts'
import {defaultRelationship,initialEnvironment} from '../../src/types/dialogue.ts'
import {CharacterRulesLoader} from '../character/CharacterRulesLoader.ts'
import type {CharacterActionCommand} from '../../src/characters/characterAnimations.ts'
import {createDialogueHandler} from '../http.ts'
import {StreamingDialogue} from '../llm/StreamingDialogue.ts'
import {createServer} from 'node:http'
import {once} from 'node:events'
import type {AddressInfo} from 'node:net'
import {chatStore} from '../../src/stores/chatStore.ts'
const tick=()=>new Promise<void>(resolve=>queueMicrotask(resolve))
const status=(action:CharacterActionCommand['action']='Idle',moving=false,dock:'Bed'|'Desk'='Bed')=>({action,moving,dock,phase:'playing' as const,bones:12})
test('precise local commands; mixed chat, negation and quotation are never keyword executed',()=>{
 for(const s of ['挥挥手','去书桌','回床边','听Rap','去书桌听Rap'])assert.equal(recognizeLocal(s).kind,'plan')
 assert.equal(recognizeLocal('停下来').kind,'stop');assert.equal(recognizeLocal('跳起来').kind,'unsupported')
 for(const s of ['别去书桌','我今天很难过，去书桌陪我聊聊吧','你会挥手吗','他说“去书桌”','我喜欢听Rap'])assert.equal(recognizeLocal(s).kind,'chat')
})
test('unknown actions/locations, extra properties and inconsistent destinations fail closed',()=>{
 for(const c of [{type:'jump'},{type:'sit'},{type:'read'},{type:'walk_to_desk',destination:'window'},{type:'wave',destination:'desk'},{type:'idle',followUpAction:'wave'},{type:'wave',script:'x'}])assert.throws(()=>parseActionPlan({commands:[c]}))
})
test('follow-up waits for actual arrival; dedupe and FIFO keep only one movement active',async()=>{
 const b=new ActionBridge(),sent:CharacterActionCommand[]=[];const detach=b.attach(c=>sent.push(c));b.observe(status())
 b.submit({commands:[{type:'walk_to_desk',followUpAction:'listen_rap'}]},'once');assert.equal(b.submit({commands:[]},'once'),false)
 assert.equal(sent.length,1);b.observe(status('Idle',true));b.observe(status('Walk',true));await tick();assert.equal(sent.length,1)
 b.observe(status('Idle',false,'Desk'));await tick();assert.equal(sent.at(-1)?.action,'ListenRap');b.observe(status('ListenRap',false,'Desk'));detach()
})
test('stop cancels pending dependencies while allowing the active walk to reach safety',async()=>{
 const b=new ActionBridge(),sent:CharacterActionCommand[]=[];const d=b.attach(c=>sent.push(c));b.observe(status());b.submit({commands:[{type:'walk_to_desk'},{type:'listen_rap'}]});b.observe(status('Walk',true));b.stop();b.observe(status('Idle',false,'Desk'));await tick();assert.equal(sent.at(-1)?.action,'Idle');assert(!sent.some(c=>c.action==='ListenRap'));b.observe(status('Idle',false,'Desk'));d()
})
test('failure clears dependencies and same-dock move finishes without waiting for a nonexistent callback',async()=>{
 const b=new ActionBridge(),sent:CharacterActionCommand[]=[];const d=b.attach(c=>sent.push(c));b.observe(status());b.submit({commands:[{type:'walk_to_bed'},{type:'wave'}]});await tick();assert.equal(sent[0].action,'Wave');b.observe(status('Wave'));b.observe(status());await tick();b.submit({commands:[{type:'walk_to_desk'},{type:'listen_rap'}]});b.fail('failed');b.observe(status('Idle',false,'Desk'));await tick();assert(!sent.some(c=>c.action==='ListenRap'));d()
})
const request={mode:'ai' as const,message:'猪猪心，去书桌旁边听会歌。',history:[],relationship:defaultRelationship,environment:initialEnvironment}
test('Qwen mock receives original rules and bounded protocol; valid plan and chat work without paid calls',async()=>{
 const rules=await new CharacterRulesLoader().load()
 for(const commands of [[{type:'walk_to_desk'},{type:'listen_rap'}],[]]){
  const service=new ActionIntent(getQwenConfig({}),{id:'qwen',async *stream(input){assert.equal(input.prompt.messages[1].content,rules.content);assert.equal(input.maxTokens,600);yield JSON.stringify({reply:'嗯，我陪着你。',commands})}})
  const result=await service.respond(request,new AbortController().signal);assert.deepEqual(result.commands,commands)
 }
})
test('invalid Qwen output and unavailable API never produce an executable plan',async()=>{
 const bad=new ActionIntent(getQwenConfig({}),{id:'qwen',async *stream(){yield '{"reply":"好","commands":[{"type":"dance"}]}'}})
 await assert.rejects(bad.respond(request,new AbortController().signal),/不够明确/)
 await assert.rejects(new ActionIntent(getQwenConfig({})).respond(request,new AbortController().signal),/未配置/)
 assert.equal(recognizeLocal('挥挥手').kind,'plan')
})
test('HTTP intent returns validated mock chat/plan; no real network or billing',async()=>{
 const intent=new ActionIntent(getQwenConfig({}),{id:'qwen',async *stream(){yield JSON.stringify({reply:'嗯，我陪着你。',commands:[]})}})
 const server=createServer(createDialogueHandler(undefined,new StreamingDialogue(getQwenConfig({})),intent));server.listen(0,'127.0.0.1');await once(server,'listening')
 try{const response=await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/action-intent`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});assert.equal(response.status,200);const value=await response.json() as {commands:unknown[];reply:string};assert.deepEqual(value.commands,[]);assert.equal(value.reply,'嗯，我陪着你。')}
 finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
test('local chat actions work with fetch unavailable and do not attempt API calls',async()=>{
 const original=globalThis.fetch;let calls=0
 try{globalThis.fetch=async()=>{calls++;throw new Error('offline')};for(const text of ['挥挥手','去书桌','回床边','听Rap','去书桌听Rap','跳起来','停下来'])assert.equal(await chatStore.send(text),true);assert.equal(calls,0)}
 finally{globalThis.fetch=original}
})
