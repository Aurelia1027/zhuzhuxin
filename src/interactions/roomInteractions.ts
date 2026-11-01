import { actionBridge } from '../characters/actionBridge.ts'
import type { ActionPlan } from '../types/actionCommands.ts'

export type FurnitureInteraction='shark'|'bed'|'desk'|'deskLamp'|'bedSit'|'bedSleep'|'deskDance'
interface BridgePort {
 submit:(plan:ActionPlan,id?:string)=>boolean
 requestPose?:(type:'sit_down'|'sleep'|'dance')=>void
 getSnapshot:()=>{pending:number;message:string}
 subscribe:(listener:()=>void)=>()=>void
}
export function createRoomInteractions(bridge:BridgePort){
 let state={message:'点击鲨鱼、床、书桌或桌面台灯试试。',characterMessage:'等待角色加载',characterReady:false,moving:false,characterPending:0,activeFurniture:null as 'bed'|'desk'|null,sharkRaised:false,sharkMoving:false,deskLampOn:true,lampMoving:false}
 let preset=true
 const listeners=new Set<()=>void>()
 const update=(patch:Partial<typeof state>)=>{state={...state,...patch};listeners.forEach(listener=>listener())}
 const detach=bridge.subscribe(()=>{
  const next=bridge.getSnapshot(),wasActive=state.activeFurniture!==null
  update({characterPending:next.pending,characterMessage:next.message,...(wasActive?{message:next.message,activeFurniture:next.pending===0?null:state.activeFurniture}:{})})
 })
 const request=(id:FurnitureInteraction)=>{
  if(id==='shark'){
   if(state.sharkMoving){update({message:'鲨鱼正在移动，等它停稳再点。'});return false}
   update({sharkRaised:!state.sharkRaised,sharkMoving:true,message:state.sharkRaised?'正在放回鲨鱼…':'鲨鱼正在轻轻浮起…'});return true
  }
  if(id==='deskLamp'){
   if(state.lampMoving){update({message:'桌灯正在调光，请稍等。'});return false}
   update({deskLampOn:!state.deskLampOn,lampMoving:true,message:'正在调节桌面台灯…'});return true
  }
  if(!state.characterReady){update({message:'猪猪心还在加载，稍等一下。'});return false}
  if(state.moving||bridge.getSnapshot().pending>0||state.activeFurniture){update({message:'猪猪心正在忙，完成当前动作后再点。'});return false}
  const target=id==='desk'||id==='deskDance'?'desk':'bed'
  update({activeFurniture:target,message:id==='bedSit'?'准备走近床沿坐下。':id==='bedSleep'?'准备去床边坐下打盹。':id==='deskDance'?'准备走到书桌旁再跳舞。':id==='bed'?'准备回到床边。':'准备去书桌旁打招呼。'})
  if(id==='bedSit'||id==='bedSleep'||id==='deskDance'){
   if(!bridge.requestPose){update({activeFurniture:null,message:'当前角色控制器尚未提供这个家具动作。'});return false}
   try{
    if(id==='deskDance'){bridge.submit({commands:[{type:'walk_to_desk'}]});bridge.requestPose('dance')}
    else bridge.requestPose(id==='bedSleep'?'sleep':'sit_down')
    return true
   }catch{update({activeFurniture:null,message:'这次家具动作没有开始，请稍后再试。'});return false}
  }
  try{return bridge.submit({commands:[{type:id==='bed'?'walk_to_bed':'walk_to_desk',followUpAction:id==='bed'?'idle':'wave'}]})}
  catch{update({activeFurniture:null,message:'这次互动没有开始，请稍后再试。'});return false}
 }
 return {
  request,
  notice:(message:string)=>update({message}),
  getSnapshot:()=>state,
  subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}},
  observeCharacter:(playback:{moving?:boolean})=>update({characterReady:true,moving:playback.moving??false}),
  syncLampPreset:(on:boolean)=>{if(on===preset)return;preset=on;update({deskLampOn:on,lampMoving:true})},
  finishShark:(raised:boolean)=>{if(state.sharkMoving&&state.sharkRaised===raised)update({sharkMoving:false,message:state.sharkRaised?'鲨鱼已浮起，再点一下放回。':'鲨鱼已回到原位。'})},
  finishLamp:(on:boolean)=>{if(state.lampMoving&&state.deskLampOn===on)update({lampMoving:false,message:state.deskLampOn?'桌面台灯已打开。':'桌面台灯已关闭。'})},
  dispose:detach,
 }
}
export const roomInteractions=createRoomInteractions(actionBridge)
export function approach(current:number,target:number,delta:number){const next=current+(target-current)*(1-Math.exp(-Math.max(0,Math.min(delta,.1))*9));return Math.abs(target-next)<.001?target:next}
