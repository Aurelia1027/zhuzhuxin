import { characterActions } from '../characters/characterAnimations'
import type { CharacterActionName } from '../characters/characterAnimations'
import type { WalkStop } from '../characters/characterWalk'
import type { Posture } from '../characters/characterPosture'
export function CharacterActionPanel({action,ready,moving=false,dock='Bed',posture='standing',transitioning=false,onAction,onMove}:{action:CharacterActionName;ready:boolean;moving?:boolean;dock?:WalkStop;posture?:Posture;transitioning?:boolean;onAction:(a:CharacterActionName)=>void;onMove:(target:WalkStop)=>void}){
  return <section className="character-panel" aria-label="猪猪心动作面板">
    <div className="section-label"><span>猪猪心</span><small>03 / ROOMMATE</small></div>
    <div className="character-actions">{characterActions.filter(a=>a!=='Walk').map(a=><button type="button" key={a} disabled={!ready||moving||transitioning} aria-pressed={action===a} onClick={()=>onAction(a)}>{a}</button>)}</div>
    <div className="character-actions"><button disabled={!ready||moving||transitioning||dock==='Desk'} onClick={()=>onMove('Desk')}>Walk to Desk</button><button disabled={!ready||moving||transitioning||(dock==='Bed'&&posture==='standing')} onClick={()=>onMove('Bed')}>Walk to Bed</button></div>
    <div className="character-actions"><button disabled={!ready||moving||transitioning||posture==='seated'} onClick={()=>onAction('SitDown')}>坐下</button><button disabled={!ready||moving||transitioning||posture!=='seated'} onClick={()=>onAction('StandUp')}>起身</button><button disabled={!ready||moving||transitioning||action==='OpenArms'} onClick={()=>onAction('OpenArms')}>求抱抱</button></div>
    <div className="character-actions"><button disabled={!ready||moving||transitioning||action==='Nod'} onClick={()=>onAction('Nod')}>点头</button><button disabled={!ready||moving||transitioning||action==='ShakeHead'} onClick={()=>onAction('ShakeHead')}>摇头</button></div>
    <div className="character-actions"><button disabled={!ready||moving||transitioning} onClick={()=>onAction('TurnAround')}>转身</button><button disabled={!ready||moving||transitioning} onClick={()=>onAction('ComeToMe')}>回到我面前</button></div>
    <div className="character-actions"><button disabled={!ready||moving||transitioning||action==='Jump'} onClick={()=>onAction('Jump')}>跳起来</button><button disabled={!ready||moving||transitioning||action==='Dance'} onClick={()=>onAction('Dance')}>跳舞</button><button disabled={!ready||moving||transitioning||action==='Sleep'} onClick={()=>onAction('Sleep')}>睡觉 · 打盹</button></div>
    <div className="character-actions"><button disabled={!ready||moving||transitioning||action!=='Sleep'} onClick={()=>onAction('WakeUp')}>醒来</button></div>
    <p role="status" data-testid="character-playback">{ready?`${moving?'正在移动 · ':''}正在播放 ${action}${posture==='seated'?' · 床边坐稳':transitioning?' · 姿态过渡中':moving?'':` · ${dock==='Bed'?'床边':'书桌旁'}`}`:'角色正在入住…'}</p>
  </section>
}
