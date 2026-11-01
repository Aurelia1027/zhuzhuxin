/// <reference types="vite/client" />
import { actionBridge } from './characters/actionBridge'
import { roomInteractions } from './interactions/roomInteractions'
import { FurnitureInteractionPanel } from './components/FurnitureInteractionPanel'
import type { WalkStop } from './characters/characterWalk'
import { CharacterActionPanel } from './components/CharacterActionPanel'
import type { CharacterActionCommand, CharacterActionName } from './characters/characterAnimations'
import type { CharacterPlayback } from './characters/ZhuZhuXinCharacter'
import { ChatPanel } from './components/chat/ChatPanel'
import { chatStore } from './stores/chatStore'
import { subscribeRoomDialogueEvents } from './services/dialogue/roomEvents'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Icon } from './components/Icon'
import type { Mood, ViewMode } from './scene/palette'
import { roomItems } from './scene/roomConfig'
import type { RoomItemId } from './scene/roomConfig'

const RoomViewport = lazy(() => import('./components/RoomViewport').then(module => ({ default: module.RoomViewport })))
const featuredItems: RoomItemId[] = ['shark', 'bed', 'cabinet', 'typography']

export default function App() {
  const [characterCommand, setCharacterCommand] = useState<CharacterActionCommand>({action:'Idle',sequence:0})
  const [characterPlayback, setCharacterPlayback] = useState<CharacterPlayback | null>(null)
  const onCharacterPlayback = useCallback((state:CharacterPlayback) => {setCharacterPlayback(state);actionBridge.observe(state);roomInteractions.observeCharacter(state)}, [])
  useEffect(()=>actionBridge.attach(command=>setCharacterCommand(command)),[])
  const requestCharacterMove = useCallback((destination:WalkStop)=>{
    actionBridge.submit({commands:[{type:destination==='Desk'?'walk_to_desk':'walk_to_bed'}]})
  },[])
  const requestCharacterAction = useCallback((action:CharacterActionName)=>{
    if(action==='Jump'||action==='Dance'||action==='Sleep'||action==='WakeUp'){actionBridge.requestPose(action==='Jump'?'jump':action==='Dance'?'dance':action==='Sleep'?'sleep':'wake_up');return}
    if(action==='TurnAround'||action==='ComeToMe'){actionBridge.submitRoot({type:action==='TurnAround'?'turn_around':'come_to_me'});return}
    if(action==='Nod'||action==='ShakeHead'){actionBridge.requestPose(action==='Nod'?'nod':'shake_head');return}
    if(action==='SitDown'||action==='StandUp'||action==='OpenArms'){actionBridge.requestPose(action==='SitDown'?'sit_down':action==='StandUp'?'stand_up':'open_arms');return}
    actionBridge.submit({commands:[{type:action==='Wave'?'wave':action==='ListenRap'?'listen_rap':'idle'}]})
  },[])
  const [mood, setMood] = useState<Mood>('evening')
  const [view, setView] = useState<ViewMode>('overview')
  const [selected, setSelected] = useState<RoomItemId | null>(null)
  const [lampOn, setLampOn] = useState(true)
  const [autoRotate, setAutoRotate] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => subscribeRoomDialogueEvents(event => {
    if (event.type !== 'room.environment.requested') return
    const lighting = event.environment.lighting
    setMood(lighting === 'day' ? 'day' : 'evening')
    setLampOn(lighting !== 'night')
  }), [])
  useEffect(() => {
    chatStore.syncLighting(mood === 'day' ? 'day' : lampOn ? 'warm' : 'night')
  }, [mood, lampOn])

  const toggleLamp = () => setLampOn(value => !value)
  const item = roomItems[selected ?? 'shark']
  const changeView = (next: ViewMode) => { setView(next); setAutoRotate(false) }

  return <main className={`app mood-${mood} view-${view}`}>
    <header className="header">
      <a className="brand" href="/" aria-label="Lumi Room 首页"><span className="brand-mark">l<span /></span><span>lumi<span className="brand-light"> room</span><span className="brand-dot">.</span></span></a>
      <div className="header-caption"><span /> SPACES WITH PERSONALITY</div>
      <span className="edition">THE BEDROOM COLLECTION <span>02</span></span>
    </header>
    <section className="experience" aria-label="Lumi Room 暗色卧室交互体验">
      <div className="scene-area">
        <div className="scene-heading"><span className="eyebrow">ROOM 002 <span>/</span> AFTER HOURS</span><h1>下线之后，<span>回到自己。</span></h1><p>你的房间，你的规则。</p></div>
        <div className="scene-indicator"><span className={`indicator-dot ${mood === 'evening' ? 'night' : ''}`} />{mood === 'evening' ? 'NIGHT SESSION' : 'DAYLIGHT SESSION'}</div>
        <Suspense fallback={<div className="scene-message" role="status">正在布置你的夜间据点…</div>}>
          <RoomViewport mood={mood} lampOn={lampOn} autoRotate={autoRotate && !reducedMotion} resetKey={resetKey}
            view={view} selected={selected} onSelect={setSelected} onToggleLamp={toggleLamp} characterCommand={characterCommand} onCharacterPlayback={onCharacterPlayback} />
        </Suspense>
        <div className="scene-footnote"><span className="scene-cross">+</span>{view === 'inside' ? 'IN THE ROOM / 沉浸视角' : 'THE WHOLE PICTURE / 房间全景'}<span className="scene-cross">+</span></div>
        <div className="scene-toolbar">
          <span className="gesture"><Icon name="mouse" size={16} /><span>拖动旋转 <b>·</b> 滚轮缩放 <b>·</b> 点击物品</span></span>
          <div className="toolbar-actions">
            <button type="button" className={autoRotate ? 'icon-button active' : 'icon-button'} disabled={reducedMotion} aria-label="自动环绕" title={reducedMotion ? '已遵循系统减少动态效果设置' : '自动环绕'} aria-pressed={autoRotate && !reducedMotion} onClick={() => setAutoRotate(value => !value)}><Icon name="rotate" size={18} /></button>
            <button type="button" className="icon-button" aria-label="重置视角" title="重置视角" onClick={() => { setResetKey(value => value + 1); setAutoRotate(false) }}><Icon name="reset" size={17} /></button>
          </div>
        </div>
      </div>
      <aside className="sidebar">
        <div className="sidebar-intro"><span className="eyebrow">A ROOM THAT FEELS LIKE YOU</span><h2>深色，也可以很温暖。</h2><p>一点街头感，一束暖光。<br />还有一只不想上班的大鲨鱼。</p></div>
        <section className="settings-section" aria-label="房间设置">
          <div className="section-label"><span>光线氛围</span><small>01 / ATMOSPHERE</small></div>
          <div className="mood-options" role="group" aria-label="日间和夜间灯光">
            <button type="button" aria-pressed={mood === 'day'} className={mood === 'day' ? 'mood-option selected' : 'mood-option'} onClick={() => setMood('day')}><Icon name="sun" size={21} /><span>日间<small>DAYLIGHT</small></span></button>
            <button type="button" aria-pressed={mood === 'evening'} className={mood === 'evening' ? 'mood-option selected' : 'mood-option'} onClick={() => setMood('evening')}><Icon name="moon" size={21} /><span>夜间<small>AFTER DARK</small></span></button>
          </div>
          <div className="lamp-setting"><Icon name="lamp" size={21} /><div><strong>暖色台灯</strong><p>{lampOn ? '留一盏灯给自己' : '让蓝色光环接管夜晚'}</p></div><button type="button" role="switch" aria-checked={lampOn} aria-label="台灯开关" className={`switch ${lampOn ? 'on' : ''}`} onClick={toggleLamp}><span /></button></div>
        </section>
        <section className="view-section" aria-label="视角切换"><div className="section-label"><span>换个角度</span><small>02 / PERSPECTIVE</small></div><div className="view-options" role="group" aria-label="观察视角"><button type="button" aria-pressed={view === 'overview'} className={view === 'overview' ? 'selected' : ''} onClick={() => changeView('overview')}>房间全景</button><button type="button" aria-pressed={view === 'inside'} className={view === 'inside' ? 'selected' : ''} onClick={() => changeView('inside')}>走进房间 <Icon name="arrow" size={14} /></button></div></section>
        <CharacterActionPanel action={characterPlayback?.action ?? 'Idle'} ready={characterPlayback !== null} moving={characterPlayback?.moving} dock={characterPlayback?.dock} posture={characterPlayback?.posture} transitioning={characterPlayback?.transitioning} onMove={requestCharacterMove} onAction={requestCharacterAction} />
        {import.meta.env.DEV&&<output hidden data-testid="character-debug-pose">{JSON.stringify(characterPlayback)}</output>}
        <FurnitureInteractionPanel />
        <section className="object-card" aria-live="polite" aria-label="物品详情"><div className="object-card-top"><span className="eyebrow">{selected ? 'SELECTED OBJECT' : 'MEET YOUR ROOMMATE'}</span><span className="object-star">✳</span></div><span className="object-tag">{item.tag}</span><h3>{item.name}</h3><p>{item.description}</p><div className="object-detail"><span />{item.detail}</div></section>
        <div className="object-shortcuts" aria-label="核心家具"><span className="eyebrow">EXPLORE THE DETAILS</span><div>{featuredItems.map((id, index) => <button type="button" key={id} aria-pressed={selected === id} className={selected === id ? 'selected' : ''} onClick={() => setSelected(id)}><small>0{index + 1}</small>{roomItems[id].name}<Icon name="arrow" size={13} /></button>)}</div></div>
        <div className="palette-row"><span className="swatches"><i /><i /><i /><i /></span><span>CHARCOAL / WALNUT / ELECTRIC BLUE</span></div>
      </aside>
    </section>
    <ChatPanel />
    <footer className="footer"><span>DESIGNED FOR YOUR OFFLINE HOURS</span><span>MAKE ROOM FOR YOURSELF <b>✧</b></span><span>LUMI ROOM © {new Date().getFullYear()}</span></footer>
  </main>
}
