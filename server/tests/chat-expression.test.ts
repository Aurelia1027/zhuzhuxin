import test from 'node:test'
import assert from 'node:assert/strict'
import { Group, Mesh, MeshStandardMaterial, Texture, BoxGeometry, SRGBColorSpace } from 'three'
import { ActionIntent } from '../llm/ActionIntent.ts'
import { parseActionOutput } from '../llm/ActionOutputProtocol.ts'
import { getQwenConfig } from '../llm/config.ts'
import { CharacterRulesLoader } from '../character/CharacterRulesLoader.ts'
import { createExpressionStore, expressionStore } from '../../src/stores/expressionStore.ts'
import { createExpressionBinding } from '../../src/characters/expressionBinding.ts'
import { characterExpressions, normalizeExpression } from '../../src/types/characterExpression.ts'
import { chatStore } from '../../src/stores/chatStore.ts'
import { actionBridge } from '../../src/characters/actionBridge.ts'
import type { CharacterActionCommand } from '../../src/characters/characterAnimations.ts'

test('expression whitelist matches approved IDs; missing and illegal values become neutral',()=>{
 assert.deepEqual(characterExpressions.map(([id])=>id),['neutral','happy','laugh','surprised','shy','sad','angry','love','blink'])
 for(const value of [undefined,null,42,{},'excited','HAPPY','/private.jpg'])assert.equal(normalizeExpression(value),'neutral')
 const result=parseActionOutput('{"reply":"嗯。","expression":"unknown","commands":[]}')
 assert.equal(result.expression,'neutral')
 assert.throws(()=>parseActionOutput('{"reply":"嗯。","expression":"happy","commands":[{"type":"jump"}]}'))
 assert.throws(()=>parseActionOutput('{"reply":"嗯。","expression":"happy","commands":[],"private":"x"}'))
})

test('manual choices win; old and cancelled AI generations cannot overwrite a newer expression',()=>{
 const store=createExpressionStore(),old=store.beginAIRequest(),current=store.beginAIRequest()
 assert.equal(store.applyAI('happy',old),false);assert.equal(store.applyAI('shy',current),true)
 store.setManual('love');assert.equal(store.applyAI('sad',current),false);assert.equal(store.getSnapshot().expression,'love')
 store.followChat();assert.equal(store.applyAI('sad',current),false)
 const next=store.beginAIRequest();assert(store.applyAI('happy',next))
 store.invalidateAI();assert.equal(store.applyAI('sad',next),false)
})

test('material binding reuses approved maps, ignores late loads, preserves geometry and restores neutral',()=>{
 const root=new Group(),originalMap=new Texture(),material=new MeshStandardMaterial({map:originalMap}),geometry=new BoxGeometry(),mesh=new Mesh(geometry,material)
 root.add(mesh)
 const pending=new Map<string,{done:(t:Texture)=>void;error:()=>void}>()
 const binding=createExpressionBinding(root,{load:(url,done,error)=>{pending.set(url,{done,error})}})
 const own=mesh.material as MeshStandardMaterial
 assert.notEqual(own,material);assert.equal(mesh.geometry,geometry)
 binding.setExpression('happy');binding.setExpression('shy')
 const shy=new Texture(),happy=new Texture()
 pending.get('/models/shuibuxin-expressions/shy.jpg')!.done(shy)
 pending.get('/models/shuibuxin-expressions/happy.jpg')!.done(happy)
 assert.equal(own.map,shy);assert.equal(shy.flipY,false);assert.equal(shy.colorSpace,SRGBColorSpace)
 binding.setExpression('happy');assert.equal(own.map,happy)
 binding.setExpression('angry');const firstAngry=pending.get('/models/shuibuxin-expressions/angry.jpg')!
 binding.setExpression('angry');const secondAngry=pending.get('/models/shuibuxin-expressions/angry.jpg')!
 const angry=new Texture();secondAngry.done(angry);firstAngry.done(new Texture());assert.equal(own.map,angry)
 binding.setExpression('love');pending.get('/models/shuibuxin-expressions/love.jpg')!.error();assert.equal(own.map,originalMap)
 binding.setExpression('neutral');assert.equal(own.map,originalMap)
 binding.dispose();assert.equal(mesh.material,material);assert.equal(material.map,originalMap)
 geometry.dispose();material.dispose();originalMap.dispose()
})

test('single mocked Qwen response drives chat, expression and existing Wave/Walk/ListenRap bridge',async()=>{
 const original=globalThis.fetch,rules=await new CharacterRulesLoader().load(),sent:CharacterActionCommand[]=[]
 const status=(action:CharacterActionCommand['action']='Idle',moving=false,dock:'Bed'|'Desk'='Bed')=>({action,moving,dock,phase:'playing' as const,bones:12})
 const detach=actionBridge.attach(command=>sent.push(command));actionBridge.observe(status());chatStore.setMode('ai');expressionStore.followChat()
 const scenarios=[
  {message:'今天收到很开心的好消息，想跟你分享',expression:'happy',commands:[]},
  {message:'今天有点难过，陪我聊一会好吗',expression:'love',commands:[]},
  {message:'你刚才那句话让我有点不好意思啦',expression:'shy',commands:[]},
  {message:'今天过得怎么样呀',expression:'neutral',commands:[]},
  {message:'跟我聊聊，也朝我挥一下手吧',expression:'happy',commands:[{type:'wave'}]},
 ]
 let calls=0
 try{
  for(const scenario of scenarios){
   globalThis.fetch=async(_url,init)=>{
    calls++;const input=JSON.parse(init!.body as string)
    const intent=new ActionIntent(getQwenConfig({}),{id:'qwen',async *stream({prompt}){
     assert.equal(prompt.messages[1].content,rules.content);assert.match(prompt.messages[0].content,/expression/)
     yield JSON.stringify({reply:'嗯，我在听呢。',expression:scenario.expression,commands:scenario.commands})
    }})
    return Response.json(await intent.respond(input,new AbortController().signal))
   }
   assert.equal(await chatStore.send(scenario.message),true);assert.equal(expressionStore.getSnapshot().expression,scenario.expression)
  }
  assert.equal(calls,5);assert.equal(sent.at(-1)?.action,'Wave')
  actionBridge.observe(status('Wave'));actionBridge.observe(status());await Promise.resolve()
  actionBridge.submit({commands:[{type:'walk_to_desk',followUpAction:'listen_rap'}]})
  actionBridge.observe(status('Walk',true));const walkCount=sent.length
  globalThis.fetch=async()=>Response.json({reply:'嗯，我听着。',expression:'love',commands:[]})
  assert(await chatStore.send('边走边听我讲讲今天的事'))
  assert.equal(expressionStore.getSnapshot().expression,'love');assert.equal(sent.length,walkCount)
  actionBridge.observe(status('Idle',false,'Desk'));await Promise.resolve();assert.equal(sent.at(-1)?.action,'ListenRap')
  actionBridge.observe(status('ListenRap',false,'Desk'));const count=sent.length
  assert(await chatStore.send('这个节奏我也喜欢呢'));assert.equal(sent.length,count)
 }finally{globalThis.fetch=original;detach()}
})

test('network failure preserves manual expression and local actions; late cancelled response is not applied',async()=>{
 const original=globalThis.fetch;chatStore.setMode('ai');expressionStore.setManual('shy')
 try{
  globalThis.fetch=async()=>{throw new Error('offline mock')}
  assert.equal(await chatStore.send('陪我说两句吧'),false);assert.equal(expressionStore.getSnapshot().expression,'shy')
  assert.equal(await chatStore.send('挥挥手'),true)
  expressionStore.followChat()
  let resolve!:(response:Response)=>void
  globalThis.fetch=async()=>new Promise<Response>(done=>{resolve=done})
  const pending=chatStore.send('这个请求稍后才会回来')
  assert.equal(await chatStore.send('不应并发发送第二次'),false)
  chatStore.cancel();resolve(Response.json({reply:'晚到回复',expression:'angry',commands:[]}))
  assert.equal(await pending,false);assert.equal(expressionStore.getSnapshot().expression,'shy')
  globalThis.fetch=async()=>Response.json({reply:'新的回复',expression:'happy',commands:[]})
  assert(await chatStore.send('现在发送新的消息'));assert.equal(expressionStore.getSnapshot().expression,'happy')
  expressionStore.setManual('love');assert(await chatStore.send('继续跟我说说话'));assert.equal(expressionStore.getSnapshot().expression,'love')
 }finally{globalThis.fetch=original;expressionStore.followChat()}
})
