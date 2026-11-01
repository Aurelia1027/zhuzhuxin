import test from 'node:test'
import assert from 'node:assert/strict'
import {parseActionOutput} from '../llm/ActionOutputProtocol.ts'
import {ProviderError} from '../llm/LLMProvider.ts'
import {ActionIntent} from '../llm/ActionIntent.ts'
import {getIntentDiagnostics} from '../llm/intentDiagnostics.ts'
import {getQwenConfig} from '../llm/config.ts'
import {CharacterRulesLoader} from '../character/CharacterRulesLoader.ts'
import {CharacterPromptBuilder} from '../prompts/CharacterPromptBuilder.ts'
import {QwenProvider} from '../llm/QwenProvider.ts'
import {defaultRelationship,initialEnvironment} from '../../src/types/dialogue.ts'
import {recognizeLocal} from '../../src/types/actionCommands.ts'
import {ActionBridge} from '../../src/characters/actionBridge.ts'
import type {CharacterActionCommand} from '../../src/characters/characterAnimations.ts'
import {createDialogueHandler} from '../http.ts'
import {StreamingDialogue} from '../llm/StreamingDialogue.ts'
import {createServer} from 'node:http'
import {once} from 'node:events'
import type {AddressInfo} from 'node:net'

const request={mode:'ai' as const,message:'先去书桌旁边，再听一会 Rap，等我来找你。',history:[],relationship:defaultRelationship,environment:initialEnvironment}
const envelope=(command:unknown)=>JSON.stringify({reply:'嗯，我先过去，到了再听会Rap。',commands:[command]})
const cases:[string,string,string][]=[
 ['```json\n{}\n```','JSON',''],['{"reply":','JSON',''],
 ['null','ROOT',''],['[]','ROOT',''],['{}','MISSING_FIELD','/reply'],
 ['{"reply":"好"}','MISSING_FIELD','/commands'],['{"commands":[]}','MISSING_FIELD','/reply'],
 ['{"reply":"好","commands":[],"private-sentinel":"secret"}','UNKNOWN_FIELD','/<unknown>'],
 [envelope({type:'wave','private-sentinel':'secret'}),'UNKNOWN_FIELD','/commands/0/<unknown>'],
 [envelope({}),'MISSING_FIELD','/commands/0/type'],
 [envelope({type:'listenRap'}),'ACTION_NAME','/commands/0/type'],
 [envelope({type:'jump'}),'ACTION_NAME','/commands/0/type'],
 [envelope({type:'walk_to_desk',destination:'bed'}),'DESTINATION_MISMATCH','/commands/0/destination'],
 [envelope({type:'walk_to_desk',destination:'window'}),'DESTINATION','/commands/0/destination'],
 [envelope({type:'walk_to_desk',destination:null}),'OPTIONAL_NULL','/commands/0/destination'],
 [envelope({type:'walk_to_desk',followUpAction:null}),'OPTIONAL_NULL','/commands/0/followUpAction'],
 [envelope({type:'wave',followUpAction:'idle'}),'FOLLOWUP','/commands/0/followUpAction'],
 [envelope({type:'walk_to_desk',followUpAction:'dance'}),'FOLLOWUP','/commands/0/followUpAction'],
 ['{"reply":"","commands":[]}','REPLY','/reply'],
 ['{"reply":"好","commands":null}','FIELD_TYPE','/commands'],
 ['{"reply":"好","commands":"[]"}','FIELD_TYPE','/commands'],
]
for(const [index,[text,stage,path]] of cases.entries())test(`strict output rejects ${stage} at ${path||'root'}: ${index}`,()=>{
 assert.throws(()=>parseActionOutput(text),(error:unknown)=>{
  assert.ok(error instanceof ProviderError);assert.equal(error.code,'INVALID_PLAN_'+stage)
  assert.equal(error.diagnostics?.issues[0].path,path)
  assert(!JSON.stringify(error).includes('private-sentinel'));assert(!JSON.stringify(error).includes('secret'))
  return true
 })
})

test('independent action protocol preserves complete rules and preferred follow-up; legacy formats unchanged',async()=>{
 const rules=await new CharacterRulesLoader().load(),builder=new CharacterPromptBuilder()
 const prompt=builder.build(request,rules,'action')
 assert.equal(prompt.messages[1].content,rules.content)
 assert.match(prompt.messages[0].content,/"type":"walk_to_desk","followUpAction":"listen_rap"/)
 assert.match(prompt.messages[0].content,/绝不可填写 null/)
 assert(!prompt.messages[0].content.includes('只返回角色的自然语言回复'))
 assert.match(builder.build(request,rules,'text').messages[0].content,/只返回角色的自然语言回复/)
 assert.match(builder.build(request,rules,'json').messages[0].content,/JSON Schema/)
})

test('required local inputs remain deterministic; mixed compound is delegated, not keyword executed',()=>{
 const inputs:[string,string[]][]=[['挥挥手',['wave']],['去书桌',['walk_to_desk']],['回床边',['walk_to_bed']],['听 Rap',['listen_rap']],['去书桌听 Rap',['walk_to_desk','listen_rap']]]
 for(const [text,types] of inputs){const local=recognizeLocal(text);assert.equal(local.kind,'plan');if(local.kind==='plan')assert.deepEqual(local.plan.commands.map(c=>c.type),types)}
 for(const text of [request.message,'先去书桌，再听 Rap，等我来找你','今天有点累'])assert.equal(recognizeLocal(text).kind,'chat')
 assert.equal(recognizeLocal('跳起来').kind,'pose')
})

test('mocked complex output reaches bridge and waits for real arrival before follow-up',async()=>{
 let calls=0
 const intent=new ActionIntent(getQwenConfig({}),{id:'qwen',async *stream(input){calls++;assert.equal(input.maxTokens,600);assert.equal(input.jsonMode,true);input.onUsage?.({promptTokens:20,completionTokens:15});yield envelope({type:'walk_to_desk',followUpAction:'listen_rap'})}})
 const result=await intent.respond(request,new AbortController().signal)
 assert.equal(calls,1)
 const bridge=new ActionBridge(),sent:CharacterActionCommand[]=[]
 const status=(action:CharacterActionCommand['action']='Idle',moving=false,dock:'Bed'|'Desk'='Bed')=>({action,moving,dock,phase:'playing' as const,bones:12})
 const detach=bridge.attach(c=>sent.push(c))
 try{
  // Match chatStore: the reply stays in chat, only commands enter the strict bridge.
  bridge.observe(status());bridge.submit({commands:result.commands},'mock-compound')
  assert.equal(sent.length,1);assert.equal(sent[0].destination,'Desk')
  bridge.observe(status('Walk',true));await Promise.resolve();assert.equal(sent.length,1)
  bridge.observe(status('Idle',false,'Desk'));await Promise.resolve()
  assert.equal(sent.at(-1)?.action,'ListenRap');bridge.observe(status('ListenRap',false,'Desk'))
 }finally{detach()}
 const record=getIntentDiagnostics().at(-1)!
 assert.equal(record.stage,'SUCCESS');assert.equal(record.promptTokens,20);assert.equal(record.completionTokens,15);assert(record.latencyMs>=0)
})

test('diagnostics retain only paths, error kinds, usage and latency; missing usage remains unknown',async()=>{
 const service=new ActionIntent(getQwenConfig({}),{id:'qwen',async *stream(input){input.onUsage?.({promptTokens:12,completionTokens:9});yield envelope({type:'walk_to_desk',destination:null})}})
 await assert.rejects(service.respond(request,new AbortController().signal))
 const record=getIntentDiagnostics().at(-1)!
 assert.equal(record.stage,'OPTIONAL_NULL');assert.equal(record.issues[0].path,'/commands/0/destination');assert.equal(record.issues[0].errorType,'enum')
 assert.equal(record.promptTokens,12);assert.equal(record.completionTokens,9)
 const json=JSON.stringify(record);assert(!json.includes(request.message));assert(!json.includes('reply'))
 await assert.rejects(new ActionIntent(getQwenConfig({})).respond(request,new AbortController().signal),/未配置/)
 assert.equal(getIntentDiagnostics().at(-1)?.promptTokens,null)
 assert.equal(recognizeLocal('去书桌').kind,'plan')
})

test('existing Qwen json_object transport uses one mocked request and reports usage; no retry on rejection',async()=>{
 const rules=await new CharacterRulesLoader().load(),config={...getQwenConfig({}),enabled:true,apiKey:'mock-secret-only'}
 for(const reject of [false,true]){
  let calls=0,usage:unknown
  const provider=new QwenProvider(config,async(_url,init)=>{
   calls++;const body=JSON.parse(init!.body as string)
   assert.deepEqual(body.response_format,{type:'json_object'});assert.equal(body.max_tokens,600);assert.equal(body.messages[1].content,rules.content)
   if(reject)return new Response('private-output',{status:400})
   return new Response('data: '+JSON.stringify({choices:[{index:0,delta:{content:'{}'},finish_reason:'stop'}]})+'\n\ndata: '+JSON.stringify({choices:[],usage:{prompt_tokens:21,completion_tokens:8}})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}})
  })
  const consume=async()=>{for await(const _chunk of provider.stream({request,prompt:new CharacterPromptBuilder().build(request,rules,'action'),signal:new AbortController().signal,jsonMode:true,maxTokens:600,onUsage:value=>{usage=value}})){ /* drain mock stream */ }}
  if(reject)await assert.rejects(consume(),error=>error instanceof ProviderError&&error.code==='UPSTREAM_400'&&!String(error).includes('private-output'))
  else{await consume();assert.deepEqual(usage,{promptTokens:21,completionTokens:8})}
  assert.equal(calls,1)
 }
})

test('HTTP validation error exposes safe metadata only, never raw output',async()=>{
 const intent=new ActionIntent(getQwenConfig({}),{id:'qwen',async *stream(){yield envelope({type:'wave','private-sentinel':'private-output'})}})
 const server=createServer(createDialogueHandler(undefined,new StreamingDialogue(getQwenConfig({})),intent));server.listen(0,'127.0.0.1');await once(server,'listening')
 try{
  const response=await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/action-intent`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)})
  assert.equal(response.status,503);const text=await response.text();const value=JSON.parse(text)
  assert.equal(value.code,'INVALID_PLAN_UNKNOWN_FIELD');if(process.env.NODE_ENV!=='production')assert.equal(value.diagnostics.issues[0].path,'/commands/0/<unknown>')
  assert(!text.includes('private-output'));assert(!text.includes('private-sentinel'));assert(!text.includes(request.message))
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})
