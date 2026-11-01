import { useSyncExternalStore } from 'react'
import { roomInteractions } from '../interactions/roomInteractions.ts'

export function FurnitureInteractionPanel(){
 const state=useSyncExternalStore(roomInteractions.subscribe,roomInteractions.getSnapshot,roomInteractions.getSnapshot)
 const busy=!state.characterReady||state.moving||state.characterPending>0||state.activeFurniture!==null
 return <section className="furniture-interactions" aria-label="房间物品互动">
  <div className="section-label"><span>房间互动</span><small>04 / PLAY</small></div>
  <div className="furniture-buttons">
   <button type="button" disabled={state.sharkMoving} onClick={()=>roomInteractions.request('shark')}>{state.sharkRaised?'放回鲨鱼':'浮起鲨鱼'}</button>
   <button type="button" disabled={busy} onClick={()=>roomInteractions.request('bed')}>走到床边</button>
   <button type="button" disabled={busy} onClick={()=>roomInteractions.request('desk')}>去书桌挥手</button>
   <button type="button" disabled={state.lampMoving} aria-pressed={state.deskLampOn} onClick={()=>roomInteractions.request('deskLamp')}>{state.deskLampOn?'关闭桌灯':'打开桌灯'}</button>
  </div>
  <p role="status" data-testid="furniture-status">{state.message}</p>
 </section>
}
