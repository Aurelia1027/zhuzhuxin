import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Group, Mesh } from 'three'
import { ActionBridge } from '../../src/characters/actionBridge.ts'
import type { CharacterActionCommand } from '../../src/characters/characterAnimations.ts'
import { createRoomInteractions, approach } from '../../src/interactions/roomInteractions.ts'
import { classifyDeskHit } from '../../src/interactions/assetHit.ts'
import { expressionStore } from '../../src/stores/expressionStore.ts'

const status=(action:CharacterActionCommand['action']='Idle',moving=false,dock:'Bed'|'Desk'='Bed')=>({action,moving,dock,phase:'playing' as const,bones:12})
test('existing GLBs contain eligible Blender nodes; merged doors/books/speakers are not exposed',async()=>{
 const bytes=await readFile(new URL('../../public/models/cozy-room.glb',import.meta.url)),data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())
 assert.match(data.asset.generator,/Blender/)
 const names=data.nodes.map((node:{name:string})=>node.name)
 for(const name of ['Bed','GamingDesk','GamingChair','DeskLamp','ShoeCabinet','Lamps','FloorLamp','Plants','Bookshelf','Door'])assert(names.includes(name))
 for(const name of ['CabinetDoor','Speaker','Book_0'])assert(!names.includes(name))
 const shark=await readFile(new URL('../../public/models/shark.glb',import.meta.url));assert.match(JSON.parse(shark.subarray(20,20+shark.readUInt32LE(12)).toString()).asset.generator,/Blender/)
})
test('shark and lamp duplicate clicks are rejected until actual completion, old callbacks cannot unlock a new target',()=>{
 const bridge=new ActionBridge(),c=createRoomInteractions(bridge)
 try{
  assert(c.request('shark'));assert.equal(c.request('shark'),false);c.finishShark(false);assert(c.getSnapshot().sharkMoving)
  c.finishShark(true);assert(c.request('shark'));c.finishShark(false);assert.equal(c.getSnapshot().sharkRaised,false)
  assert(c.request('deskLamp'));assert.equal(c.request('deskLamp'),false);c.finishLamp(true);assert(c.getSnapshot().lampMoving)
  c.finishLamp(false);assert.equal(c.getSnapshot().deskLampOn,false)
  c.syncLampPreset(false);c.finishLamp(false);c.syncLampPreset(true);assert.equal(c.getSnapshot().deskLampOn,true)
 }finally{c.dispose()}
})
test('furniture motion converges to absolute targets without drift or overshoot',()=>{
 let value=0
 for(let cycle=0;cycle<25;cycle++){
  for(const target of [.28,0]){
   for(let frame=0;frame<160;frame++){value=approach(value,target,1/60);assert(value>=0&&value<=.28)}
   assert.equal(value,target)
  }
 }
})
test('desk lamp and chair descendants do not trigger the desk walk hotzone',()=>{
 const desk=new Group(),lamp=new Group(),chair=new Group(),bulb=new Mesh(),seat=new Mesh(),top=new Mesh()
 lamp.name='DeskLamp';chair.name='GamingChair';lamp.add(bulb);chair.add(seat);desk.add(lamp,chair,top)
 assert.equal(classifyDeskHit(bulb,desk),'lamp');assert.equal(classifyDeskHit(seat,desk),'chair');assert.equal(classifyDeskHit(top,desk),'desk')
})
test('desk click uses existing bridge, arrival precedes Wave, and repeat/competing furniture clicks do not queue',async()=>{
 const bridge=new ActionBridge(),sent:CharacterActionCommand[]=[],c=createRoomInteractions(bridge),detach=bridge.attach(command=>sent.push(command))
 try{
  assert.equal(c.request('desk'),false)
  bridge.observe(status());c.observeCharacter(status());assert(c.request('desk'));assert.equal(c.request('bed'),false);assert.equal(c.request('desk'),false)
  assert.equal(sent.length,1);assert.equal(sent[0].destination,'Desk')
  bridge.observe(status('Walk',true));c.observeCharacter(status('Walk',true));await Promise.resolve();assert.equal(sent.length,1)
  bridge.observe(status('Idle',false,'Desk'));c.observeCharacter(status('Idle',false,'Desk'));await Promise.resolve();assert.equal(sent.at(-1)?.action,'Wave')
  bridge.observe(status('Wave',false,'Desk'));bridge.observe(status('Idle',false,'Desk'));await Promise.resolve();assert.equal(c.getSnapshot().activeFurniture,null)
  assert(c.request('bed'));assert.equal(sent.at(-1)?.destination,'Bed')
  bridge.observe(status('Walk',true,'Desk'));bridge.observe(status());c.observeCharacter(status());await Promise.resolve();assert.equal(sent.at(-1)?.action,'Idle')
  bridge.observe(status());assert.equal(c.getSnapshot().activeFurniture,null)
 }finally{detach();c.dispose()}
})
test('existing AI queue has priority; furniture can animate during walking without touching expression',()=>{
 const bridge=new ActionBridge(),c=createRoomInteractions(bridge),detach=bridge.attach(()=>{})
 try{
  bridge.observe(status());c.observeCharacter(status());bridge.submit({commands:[{type:'wave'}]})
  assert.equal(c.request('desk'),false)
  expressionStore.setManual('shy');assert(c.request('shark'));assert(c.request('deskLamp'));assert.equal(expressionStore.getSnapshot().expression,'shy')
  bridge.fail('失败，后续动作取消');assert.equal(c.getSnapshot().characterPending,0)
 }finally{detach();c.dispose();expressionStore.followChat()}
})
test('movement failure clears furniture task without firing dependent Wave',async()=>{
 const bridge=new ActionBridge(),sent:CharacterActionCommand[]=[],c=createRoomInteractions(bridge),detach=bridge.attach(command=>sent.push(command))
 try{
  bridge.observe(status());c.observeCharacter(status());c.request('desk');bridge.fail('未收到完成信号，后续动作已取消。')
  await Promise.resolve();assert.equal(sent.length,1);assert.equal(c.getSnapshot().activeFurniture,null);assert.match(c.getSnapshot().message,/取消/)
 }finally{detach();c.dispose()}
})
