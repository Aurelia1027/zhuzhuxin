import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createNetlifyDialogueHandler } from '../netlify/NetlifyDialogue.ts'
import { FunctionAccess, publicFunctionLimits } from '../security/FunctionAccess.ts'
import { QwenProvider } from '../llm/QwenProvider.ts'
import { ProviderError } from '../llm/LLMProvider.ts'
import { CharacterRulesLoader } from '../character/CharacterRulesLoader.ts'
import { defaultRelationship, initialEnvironment } from '../../src/types/dialogue.ts'
import { chatStore } from '../../src/stores/chatStore.ts'
import { expressionStore } from '../../src/stores/expressionStore.ts'
import { actionBridge } from '../../src/characters/actionBridge.ts'
import type { CharacterActionCommand } from '../../src/characters/characterAnimations.ts'
import { AiDialogueService } from '../../src/services/dialogue/DialogueService.ts'

const env={PUBLIC_QWEN_ENABLED:'true',DASHSCOPE_API_KEY:'mock-netlify-key-only',QWEN_MODEL:'qwen-plus'}
const body={mode:'ai',message:'陪我聊聊，顺便向我挥一下手',history:[],relationship:defaultRelationship,environment:initialEnvironment}
const post=(path='/api/action-intent',value:unknown=body,extra:Record<string,string>={})=>new Request('https://lumi.test'+path,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(value)})
const context={ip:'192.0.2.1'}
function sse(reply:string){return new Response('data: '+JSON.stringify({choices:[{index:0,delta:{content:reply},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}})}

test('Netlify paid gate defaults off; a key alone never enables upstream; Demo and metadata work',async()=>{
 for(const disabled of [{},{DASHSCOPE_API_KEY:env.DASHSCOPE_API_KEY},{PUBLIC_QWEN_ENABLED:'true'}]){
  let calls=0
  const handle=createNetlifyDialogueHandler({env:disabled,providerFactory:()=>{calls++;throw new Error('must not call')}})
  for(const path of ['/api/action-intent','/api/dialogue','/api/dialogue/stream'])assert.equal((await handle(post(path),context)).status,503)
  const meta=await (await handle(new Request('https://lumi.test/api/character'),context)).json() as {aiAvailable:boolean}
  assert.equal(meta.aiAvailable,false)
  assert.equal((await handle(post('/api/dialogue',{...body,mode:'demo'}),context)).status,200)
  assert.equal(calls,0)
 }
})

test('real QwenProvider transport mocked once: full official prompt, bounded tokens/history, validated expression and action',async()=>{
 const rules=await new CharacterRulesLoader().load();let calls=0
 const handle=createNetlifyDialogueHandler({env,providerFactory:config=>new QwenProvider(config,async(_url,init)=>{
  calls++;const sent=JSON.parse(init!.body as string)
  assert.equal((init!.headers as Record<string,string>).Authorization,'Bearer '+env.DASHSCOPE_API_KEY)
  assert.equal(sent.messages[1].content,rules.content);assert.equal(sent.max_tokens,600);assert.equal(sent.enable_thinking,false)
  assert(sent.messages.length<=12);assert.equal(config.timeoutMs,20000)
  return sse(JSON.stringify({reply:'嗯，跟你打个招呼。',expression:'happy',commands:[{type:'wave'}]}))
 })})
 const response=await handle(post('/.netlify/functions/lumi/action-intent',{...body,history:Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',content:'旧消息'.repeat(100)}))}),context)
 assert.equal(response.status,200)
 const result=await response.json() as {reply:string;expression:string;commands:unknown[]}
 assert.equal(result.expression,'happy');assert.deepEqual(result.commands,[{type:'wave'}]);assert.equal(calls,1)
 assert(!JSON.stringify(result).includes(env.DASHSCOPE_API_KEY));assert(!JSON.stringify(result).includes(rules.content))
})

test('invalid JSON, body/message limits, unknown actions and forged origins never bypass validation',async()=>{
 let calls=0
 const handle=createNetlifyDialogueHandler({env,providerFactory:()=>({id:'qwen',async *stream(){calls++;yield '{"reply":"好","commands":[{"type":"jump"}]}'}})})
 assert.equal((await handle(post('/api/action-intent',{...body,message:'x'.repeat(1001)}),context)).status,413)
 assert.equal((await handle(post('/api/action-intent',{...body,message:'x'.repeat(50000)}),context)).status,413)
 assert.equal((await handle(post('/api/action-intent',body,{Origin:'https://evil.invalid'}),context)).status,403)
 assert.equal((await handle(post('/api/action-intent',{...body,privateKey:'anything'}),context)).status,400)
 assert.equal(calls,0)
 const response=await handle(post(),context);assert.equal(response.status,503)
 assert.equal((await response.json() as {code:string}).code,'INVALID_PLAN_ACTION_NAME');assert.equal(calls,1)
})

test('all three paid routes share per-instance rate/concurrency guard; trusted context IP required',async()=>{
 const access=new FunctionAccess(()=>1000)
 const handle=createNetlifyDialogueHandler({env,access,providerFactory:()=>({id:'qwen',async *stream(input){yield input.jsonMode?'{"reply":"你好","commands":[]}':'你好'}})})
 const paths=['/api/action-intent','/api/dialogue','/api/dialogue/stream']
 for(let i=0;i<6;i++)assert.equal((await handle(post(paths[i%3]),context)).status,200)
 assert.equal((await handle(post(),context)).status,429)
 assert.equal((await handle(post(),{ip:'192.0.2.2'})).status,200)
 assert.equal((await handle(post('/api/action-intent',body,{'X-Forwarded-For':'192.0.2.99'}),{})).status,503)
 let release!:()=>void;const wait=new Promise<void>(done=>{release=done})
 const parallel=createNetlifyDialogueHandler({env,providerFactory:()=>({id:'qwen',async *stream(){await wait;yield '{"reply":"好","commands":[]}'}})})
 const pending=Array.from({length:3},(_,i)=>parallel(post(),{ip:'192.0.2.'+(i+10)}))
 // Let asynchronous body parsing finish; do not guess arrival or animation completion.
 await new Promise<void>(done=>setImmediate(done))
 assert.equal((await parallel(post(),{ip:'192.0.2.20'})).status,429)
 release();assert((await Promise.all(pending)).every(response=>response.status===200))
 assert.equal((await parallel(post(),{ip:'192.0.2.20'})).status,200)
})

test('guard deduplicates short-term IDs, releases slots idempotently and resets after a minute; restart has no durable quota',()=>{
 let now=0;const access=new FunctionAccess(()=>now)
 const release=access.acquire(context.ip,'one');release();release()
 assert.throws(()=>access.acquire(context.ip,'one'),/重复/)
 for(let i=0;i<5;i++)access.acquire(context.ip)()
 assert.throws(()=>access.acquire(context.ip),/频繁/)
 now=60001;access.acquire(context.ip)()
 new FunctionAccess(()=>now).acquire(context.ip)()
 assert.equal(publicFunctionLimits.concurrent,3)
})

test('Qwen errors, exhausted quota, interrupted output and cancellation are sanitized and never retried',async()=>{
 for(const status of [400,401,403,429,500]){
  let calls=0
  const handle=createNetlifyDialogueHandler({env,providerFactory:config=>new QwenProvider(config,async()=>{calls++;return new Response(env.DASHSCOPE_API_KEY,{status})})})
  const response=await handle(post(),context),text=await response.text()
  assert.equal(response.status,status===429?429:503);assert(!text.includes(env.DASHSCOPE_API_KEY));assert.match(text,/demo/);assert.equal(calls,1)
 }
 const interrupted=createNetlifyDialogueHandler({env,providerFactory:config=>new QwenProvider(config,async()=>new Response('data: {"choices":[{"index":0,"delta":{"content":"partial"}}]}\n\n',{headers:{'Content-Type':'text/event-stream'}}))})
 for(const [status,code] of [[400,'Arrearage'],[403,'AllocationQuota.FreeTierOnly']] as const){
  const exhausted=createNetlifyDialogueHandler({env,providerFactory:config=>new QwenProvider(config,async()=>Response.json({error:{code,message:env.DASHSCOPE_API_KEY}},{status}))})
  const result=await (await exhausted(post(),context)).json() as {code:string}
  assert.equal(result.code,'QWEN_QUOTA_EXHAUSTED');assert(!JSON.stringify(result).includes(env.DASHSCOPE_API_KEY))
 }
 assert.equal((await interrupted(post('/api/dialogue/stream'),context)).status,503)
 const cancelled=new AbortController();cancelled.abort()
 const response=await createNetlifyDialogueHandler({env,providerFactory:()=>({id:'qwen',async *stream(input){input.signal.throwIfAborted();yield ''}})})(new Request(post(),{signal:cancelled.signal}),context)
 assert.equal(response.status,408)
 const timeout=createNetlifyDialogueHandler({env,providerFactory:()=>({id:'qwen',async *stream(){throw new ProviderError('TIMEOUT','回复超时，请使用 Demo。')}})})
 assert.equal((await timeout(post(),context)).status,503)
})

test('buffered Function SSE preserves existing delta/done contract and legacy /dialogue JSON',async()=>{
 const handle=createNetlifyDialogueHandler({env,providerFactory:()=>({id:'qwen',async *stream(){yield '你好';yield '呀'}})})
 const original=globalThis.fetch
 try{
  globalThis.fetch=async(url,init)=>handle(new Request('https://lumi.test'+String(url),init),context)
  const deltas:string[]=[]
  const result=await new AiDialogueService().send(body as Parameters<AiDialogueService['send']>[0],undefined,text=>deltas.push(text))
  assert.equal(result.reply,'你好呀');assert.deepEqual(deltas,['你好','呀'])
  const json=await handle(post('/api/dialogue'),context);assert.equal((await json.json() as {mode:string}).mode,'ai')
 }finally{globalThis.fetch=original}
})

test('chat UI store consumes Function response on same character bridge; failure uses labelled local Demo with no extra call',async()=>{
 const original=globalThis.fetch,sent:CharacterActionCommand[]=[]
 const detach=actionBridge.attach(command=>sent.push(command))
 const state=(action:CharacterActionCommand['action']='Idle',moving=false,dock:'Bed'|'Desk'='Bed')=>({action,moving,dock,phase:'playing' as const,bones:12})
 actionBridge.observe(state());expressionStore.followChat();chatStore.setMode('ai')
 const handle=createNetlifyDialogueHandler({env,providerFactory:()=>({id:'qwen',async *stream(){yield '{"reply":"我先过去，到了听 Rap。","expression":"happy","commands":[{"type":"walk_to_desk","followUpAction":"listen_rap"}]}'}})})
 try{
  let calls=0
  globalThis.fetch=async(url,init)=>{calls++;return handle(new Request('https://lumi.test'+String(url),init),context)}
  assert(await chatStore.send('先去书桌旁边，再听一会 Rap，等我来找你。'))
  assert.equal(sent.at(-1)?.action,'Walk');assert.equal(expressionStore.getSnapshot().expression,'happy')
  actionBridge.observe(state('Walk',true));assert.equal(sent.length,1)
  actionBridge.observe(state('Idle',false,'Desk'));await Promise.resolve();assert.equal(sent.at(-1)?.action,'ListenRap')
  actionBridge.observe(state('ListenRap',false,'Desk'))
  expressionStore.setManual('shy');const count=sent.length
  globalThis.fetch=async()=>{calls++;return Response.json({code:'UPSTREAM_429',error:'额度不足',fallback:'demo'},{status:429})}
  assert(await chatStore.send('今天过得怎么样？'));assert.equal(chatStore.getSnapshot().mode,'demo')
  assert.equal(chatStore.getSnapshot().messages.at(-1)?.mode,'demo');assert.match(chatStore.getSnapshot().error??'',/Demo/)
  assert.equal(expressionStore.getSnapshot().expression,'shy');assert.equal(sent.length,count);assert.equal(calls,2)
  globalThis.fetch=async()=>{calls++;throw new Error('offline')}
  assert(await chatStore.send('你好呀'));assert.equal(chatStore.getSnapshot().messages.at(-1)?.mode,'demo');assert.equal(calls,3)
 }finally{globalThis.fetch=original;detach();expressionStore.followChat()}
})

test('deployment configuration routes API before SPA and bundles only server Markdown outside dist',async()=>{
 const toml=await readFile(new URL('../../netlify.toml',import.meta.url),'utf8')
 assert(toml.indexOf('from = "/api/*"')<toml.indexOf('from = "/*"'))
 assert.match(toml,/included_files = \["docs\/character\/\*\.md"/)
 assert.match(toml,/included_files = .*"!\.env"/)
 assert(!toml.includes(env.DASHSCOPE_API_KEY));assert(!toml.includes('VITE_DASHSCOPE'))
})
