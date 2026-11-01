import { parseActionPlan } from '../types/actionCommands.ts'
import type { ActionCommand, ActionPlan } from '../types/actionCommands.ts'
import type { CharacterActionCommand } from './characterAnimations.ts'
import { parseRootAction } from './characterRootActions.ts'
import type { RootActionType, RootActionCommand } from './characterRootActions.ts'
interface CharacterPlayback {action:CharacterActionCommand['action'];phase:'playing'|'ready';bones:number;moving?:boolean;dock?:'Bed'|'Desk';posture?:'standing'|'sitting'|'seated'|'standing-up';transitioning?:boolean;completedRoot?:RootActionType;completedSequence?:number;error?:string;sleeping?:boolean}
type PoseCommand={type:'sit_down'|'stand_up'|'open_arms'|'nod'|'shake_head'|'jump'|'dance'|'sleep'|'wake_up'}
type BridgeCommand=ActionCommand|PoseCommand|RootActionCommand
type Active={command:BridgeCommand;started:boolean;sequence:number}
export class ActionBridge {
 private dispatch:((command:CharacterActionCommand)=>void)|null=null
 private queue:BridgeCommand[]=[];private active:Active|null=null;private ids=new Set<string>();private sequence=0
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
  this.enqueue(commands);return true
 }
 /** Closed button-only adapter during visual acceptance; same queue and completion signals. */
 requestPose(type:PoseCommand['type']){
  if(!['sit_down','stand_up','open_arms','nod','shake_head','jump','dance','sleep','wake_up'].includes(type))throw new Error('不支持的姿态')
  this.enqueue([{type}])
 }
 submitRoot(value:unknown,id:string=crypto.randomUUID()){
  const command=parseRootAction(value)
  if(this.ids.has(id))return false
  if(this.queue.length>=16)throw new Error('动作排队太多了，等一下再说。')
  this.ids.add(id);if(this.ids.size>256)this.ids.delete(this.ids.values().next().value!)
  this.enqueue([command]);return true
 }
 private enqueue(commands:BridgeCommand[]){
  if(this.queue.length+commands.length>16)throw new Error('动作排队太多了，等一下再说。')
  for(const c of commands){
   if(['sit_down','stand_up','open_arms','nod','shake_head','turn_around','come_to_me','jump','dance','sleep','wake_up'].includes(c.type)&&([this.active?.command,...this.queue].some(p=>p?.type===c.type)))continue
   if(c.type==='sit_down'&&!this.active&&!this.queue.length&&this.playback?.posture==='seated'){this.notify('已经在床边坐稳。');continue}
   this.queue.push(c)
  }
  this.notify('动作已排队，尚未执行完成。');this.pump()
 }
 observe(state:CharacterPlayback){
  this.playback=state
  if(state.error){this.fail(state.error);return}
  if(!this.active){this.notify(state.moving?'正在走向安全停靠点':`当前 ${state.action} · ${state.dock??'Bed'}`);this.pump();return}
  const a=this.active,c=a.command
  if(c.type==='turn_around'||c.type==='come_to_me'){
   if(state.completedRoot===c.type&&state.completedSequence===a.sequence&&!state.moving&&!state.transitioning)this.complete(c.type==='turn_around'?'已转身180°':'已回到床边并面向你')
  }else if(c.type==='sleep'){
   if(state.action==='Sleep'&&state.sleeping&&!state.moving&&!state.transitioning)this.complete('正在床边闭眼打盹')
  }else if(c.type==='wake_up'){
   if(!state.sleeping&&!state.moving&&!state.transitioning&&(state.action==='Seated'||state.action==='Idle'))this.complete('已醒来')
  }else if(c.type==='dance'){
   if(state.action==='Dance'&&!state.moving&&!state.transitioning)this.complete('正在跳舞（无音乐），点击Idle或停止即可结束')
  }else if(c.type==='sit_down'){
   if(state.action==='Seated'&&state.posture==='seated'&&!state.moving)this.complete('已在床边坐稳')
  }else if(c.type==='stand_up'){
   if(state.action==='Idle'&&state.posture==='standing'&&!state.moving&&!state.transitioning)this.complete('已起身并回到床边站立点')
  }else if(c.type.startsWith('walk_to_')){
   if(state.moving)a.started=true
   if(a.started&&!state.moving&&state.dock===(c.type==='walk_to_desk'?'Desk':'Bed'))this.complete('已到达'+(state.dock==='Desk'?'书桌旁':'床边'))
  }else if(c.type==='wave'||c.type==='open_arms'||c.type==='nod'||c.type==='shake_head'||c.type==='jump'){
   const expected=c.type==='wave'?'Wave':c.type==='open_arms'?'OpenArms':c.type==='nod'?'Nod':c.type==='jump'?'Jump':'ShakeHead'
   if(state.action===expected)a.started=true
   if(a.started&&state.action==='Idle'&&!state.moving&&!state.transitioning)this.complete(c.type==='wave'?'挥手完成':c.type==='open_arms'?'求抱抱表达完成，已收回手臂':c.type==='nod'?'点头完成':c.type==='jump'?'跳跃落地完成':'摇头完成')
  }else if(!state.moving&&!state.transitioning&&state.action===(c.type==='listen_rap'?'ListenRap':'Idle'))this.complete(c.type==='listen_rap'?'正在听 Rap（无音频）':'已切换 Idle')
 }
 private complete(message:string){clearTimeout(this.timer);this.active=null;this.notify(message);queueMicrotask(()=>this.pump())}
 private pump(){
  if(!this.dispatch||!this.playback||this.playback.moving||this.playback.transitioning||this.active||!this.queue.length)return
  const c=this.queue.shift()!
  const destination=c.type==='walk_to_desk'?'Desk':c.type==='walk_to_bed'?'Bed':undefined
  if(destination===this.playback.dock&&destination&&this.playback.posture!=='seated'){this.notify('已经在'+(destination==='Desk'?'书桌旁':'床边'));queueMicrotask(()=>this.pump());return}
  this.active={command:c,started:false,sequence:++this.sequence};this.notify(destination?'准备走向'+(destination==='Desk'?'书桌旁':'床边'):'正在执行 '+c.type)
  // Failure watchdog only. It NEVER acknowledges arrival or runs a dependent action.
  this.timer=setTimeout(()=>this.fail('动作未收到完成信号，后续动作已取消。'),120000)
  this.dispatch({action:destination?'Walk':c.type==='wave'?'Wave':c.type==='listen_rap'?'ListenRap':c.type==='sit_down'?'SitDown':c.type==='stand_up'?'StandUp':c.type==='open_arms'?'OpenArms':c.type==='nod'?'Nod':c.type==='shake_head'?'ShakeHead':c.type==='turn_around'?'TurnAround':c.type==='come_to_me'?'ComeToMe':c.type==='jump'?'Jump':c.type==='dance'?'Dance':c.type==='sleep'?'Sleep':c.type==='wake_up'?'WakeUp':'Idle',destination,sequence:this.sequence})
 }
 stop(){this.queue=[];if(this.playback?.moving||this.playback?.transitioning||this.active&&['sit_down','stand_up','open_arms','jump','sleep','wake_up'].includes(this.active.command.type)||this.active?.command.type.startsWith('walk_to_')){this.queue.push({type:'idle'});this.notify('后续动作已取消；当前动作安全收尾后恢复站立。')}else{clearTimeout(this.timer);this.active=null;this.queue.push({type:'idle'});this.pump()}return this.message}
 fail(message:string){clearTimeout(this.timer);this.active=null;this.queue=[];this.notify(message)}
}
export const actionBridge=new ActionBridge()
export const characterActions={wave:()=>actionBridge.submit({commands:[{type:'wave'}]}),listenRap:()=>actionBridge.submit({commands:[{type:'listen_rap'}]}),walkTo:(destination:'bed'|'desk')=>actionBridge.submit({commands:[{type:`walk_to_${destination}`}]}),idle:()=>actionBridge.submit({commands:[{type:'idle'}]}),sitDown:()=>actionBridge.requestPose('sit_down'),standUp:()=>actionBridge.requestPose('stand_up'),openArms:()=>actionBridge.requestPose('open_arms'),turnAround:()=>actionBridge.submitRoot({type:'turn_around'}),comeToMe:()=>actionBridge.submitRoot({type:'come_to_me'})}
export function enqueuePlan(plan:ActionPlan,id:string){return actionBridge.submit(plan,id)}
