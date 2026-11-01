import { characterActions } from '../characters/characterAnimations'
import type { CharacterActionName } from '../characters/characterAnimations'
import type { WalkStop } from '../characters/characterWalk'
export function CharacterActionPanel({action,ready,moving=false,dock='Bed',onAction,onMove}:{action:CharacterActionName;ready:boolean;moving?:boolean;dock?:WalkStop;onAction:(a:CharacterActionName)=>void;onMove:(target:WalkStop)=>void}){
  return <section className="character-panel" aria-label="猪猪心动作面板">
    <div className="section-label"><span>猪猪心</span><small>03 / ROOMMATE</small></div>
    <div className="character-actions">{characterActions.filter(a=>a!=='Walk').map(a=><button type="button" key={a} disabled={!ready||moving} aria-pressed={action===a} onClick={()=>onAction(a)}>{a}</button>)}</div>
    <div className="character-actions"><button disabled={!ready||moving||dock==='Desk'} onClick={()=>onMove('Desk')}>Walk to Desk</button><button disabled={!ready||moving||dock==='Bed'} onClick={()=>onMove('Bed')}>Walk to Bed</button></div>
    <p role="status" data-testid="character-playback">{ready?`${moving?'正在移动 · ':''}正在播放 ${action}${moving?'':` · ${dock==='Bed'?'床边':'书桌旁'}`}`:'角色正在入住…'}</p>
  </section>
}
