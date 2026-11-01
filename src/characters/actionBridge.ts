import { parseActionPlan } from '../types/actionCommands.ts'
import type { ActionCommand, ActionPlan } from '../types/actionCommands.ts'
import type { CharacterActionCommand } from './characterAnimations.ts'
interface CharacterPlayback {action:CharacterActionCommand['action'];phase:'playing'|'ready';bones:number;moving?:boolean;dock?:'Bed'|'Desk'}
type Active={command:ActionCommand;started:boolean}
export class ActionBridge {
 private dispatch:((command:CharacterActionCommand)=>void)|null=null
 private queue:ActionCommand[]=[];private active:Active|null=null;private ids=new Set<string>();private sequence=0
 private playback:CharacterPlayback|null=null;private timer:ReturnType<typeof setTimeout>|undefined
 private listeners=new Set<()=>void>();private message='等待角色加载';private snapshot={message:this.message,pending:0}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}}
 getSnapshot=()=>this.snapshot
 private notify(message:string){this.message=message;this.snapshot={message,pending:this.queue.length+(this.active?1:0)};for(const l of this.listeners)l()}
 attach(dispatch:(command:CharacterActionCommand)=>void){this.dispatch=dispatch;this.pump();return()=>{this.dispatch=null;this.playback=null;this.fail('角色已离开场景，待执行动作已取消。')}}
 submit(value:unknown,id:string=crypto.randomUUID()){
  const plan=parseActionPlan(value);if(this.ids.has(id))return false
  const commands=plan.commands.flatMap(c=>[{type:c.type,destination:c.destination},...(c.followUpAction?[{type:c.followUpAction}]:[])])
  if(this.queue.length+commands.length>16)throw new Error('动作排队太多了，等一下再说。')
  this.ids.add(id);if(this.ids.size>256)this.ids.delete(this.ids.values().next().value!)
  this.queue.push(...commands);this.notify('动作已排队，尚未执行完成。');this.pump();return true
 }
 observe(state:CharacterPlayback){
  this.playback=state
  if(!this.active){this.notify(state.moving?'正在走向安全停靠点':`当前 ${state.action} · ${state.dock??'Bed'}`);this.pump();return}
  const a=this.active,c=a.command
  if(c.type.startsWith('walk_to_')){
   if(state.moving)a.started=true
   if(a.started&&!state.moving&&state.dock===(c.type==='walk_to_desk'?'Desk':'Bed'))this.complete('已到达'+(state.dock==='Desk'?'书桌旁':'床边'))
  }else if(c.type==='wave'){
   if(state.action==='Wave')a.started=true
   if(a.started&&state.action==='Idle'&&!state.moving)this.complete('挥手完成')
  }else if(!state.moving&&state.action===(c.type==='listen_rap'?'ListenRap':'Idle'))this.complete(c.type==='listen_rap'?'正在听 Rap（无音频）':'已切换 Idle')
 }
 private complete(message:string){clearTimeout(this.timer);this.active=null;this.notify(message);queueMicrotask(()=>this.pump())}
 private pump(){
  if(!this.dispatch||!this.playback||this.playback.moving||this.active||!this.queue.length)return
  const c=this.queue.shift()!
  const destination=c.type==='walk_to_desk'?'Desk':c.type==='walk_to_bed'?'Bed':undefined
  if(destination===this.playback.dock&&destination){this.notify('已经在'+(destination==='Desk'?'书桌旁':'床边'));queueMicrotask(()=>this.pump());return}
  this.active={command:c,started:false};this.notify(destination?'准备走向'+(destination==='Desk'?'书桌旁':'床边'):'正在执行 '+c.type)
  // Failure watchdog only. It NEVER acknowledges arrival or runs a dependent action.
  this.timer=setTimeout(()=>this.fail('动作未收到完成信号，后续动作已取消。'),120000)
  this.dispatch({action:destination?'Walk':c.type==='wave'?'Wave':c.type==='listen_rap'?'ListenRap':'Idle',destination,sequence:++this.sequence})
 }
 stop(){this.queue=[];if(this.playback?.moving||this.active?.command.type.startsWith('walk_to_')){this.queue.push({type:'idle'});this.notify('后续动作已取消；会在安全停靠后停下。')}else{clearTimeout(this.timer);this.active=null;this.queue.push({type:'idle'});this.pump()}return this.message}
 fail(message:string){clearTimeout(this.timer);this.active=null;this.queue=[];this.notify(message)}
}
export const actionBridge=new ActionBridge()
export const characterActions={wave:()=>actionBridge.submit({commands:[{type:'wave'}]}),listenRap:()=>actionBridge.submit({commands:[{type:'listen_rap'}]}),walkTo:(destination:'bed'|'desk')=>actionBridge.submit({commands:[{type:`walk_to_${destination}`}]}),idle:()=>actionBridge.submit({commands:[{type:'idle'}]})}
export function enqueuePlan(plan:ActionPlan,id:string){return actionBridge.submit(plan,id)}
