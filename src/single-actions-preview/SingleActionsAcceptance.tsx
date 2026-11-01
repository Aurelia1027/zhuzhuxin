import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Group, Vector3 } from 'three'
import { ActionBridge } from '../characters/actionBridge'
import { characterPlacement } from '../characters/characterAnimations'
import type { CharacterActionCommand } from '../characters/characterAnimations'
import { ZhuZhuXinCharacter } from '../characters/ZhuZhuXinCharacter'
import type { CharacterPlayback } from '../characters/ZhuZhuXinCharacter'
import './single-actions-preview.css'

function StudyBed({ visible }: { visible: boolean }) {
  const { scene } = useGLTF('/models/cozy-room.glb')
  const bed = useMemo(() => scene.getObjectByName('Bed')!.clone(true), [scene])
  return <group visible={visible}><primitive object={bed} dispose={null} /></group>
}
function CameraView({ view, pose, root }: { view: 'front' | 'side' | 'back'; pose: CharacterPlayback | null; root: RefObject<Group | null> }) {
  const { camera, controls } = useThree()
  const stablePosition = pose?.position?.join(',')
  useEffect(() => {
    if (!root.current) return
    const center = root.current.position.clone().add(new Vector3(0, .8, 0))
    const yaw = root.current.rotation.y + characterPlacement.yaw + (view === 'front' ? 0 : view === 'side' ? Math.PI / 2 : Math.PI)
    camera.position.set(center.x + Math.sin(yaw) * 4, center.y, center.z + Math.cos(yaw) * 4)
    camera.lookAt(center)
    if (controls && 'target' in controls) (controls.target as Vector3).copy(center)
  }, [camera, controls, root, view, stablePosition])
  return null
}
export default function SingleActionsAcceptance() {
  const bridge = useMemo(() => new ActionBridge(), []), root = useRef<Group>(null)
  const [command, setCommand] = useState<CharacterActionCommand>({ action: 'Idle', sequence: 0 }), [pose, setPose] = useState<CharacterPlayback | null>(null)
  const [view, setView] = useState<'front' | 'side' | 'back'>('front'), [showBed, setShowBed] = useState(true)
  const [cycles, setCycles] = useState<{ active: boolean; completed: number; phase: 'sit' | 'stand'; positions: number[][] }>({ active: false, completed: 0, phase: 'sit', positions: [] })
  const snapshot = useSyncExternalStore(bridge.subscribe, bridge.getSnapshot)
  useEffect(() => bridge.attach(setCommand), [bridge])
  const observe = useCallback((next: CharacterPlayback) => { setPose(next); bridge.observe(next) }, [bridge])
  useEffect(() => {
    if (!cycles.active || !pose || pose.moving || pose.transitioning) return
    if (cycles.phase === 'sit' && pose.posture === 'seated') {
      setCycles(old => ({ ...old, phase: 'stand' })); bridge.requestPose('stand_up')
    } else if (cycles.phase === 'stand' && pose.action === 'Idle' && pose.posture === 'standing') {
      const completed = cycles.completed + 1
      setCycles(old => ({ active: completed < 10, completed, phase: 'sit', positions: [...old.positions, pose.position ?? []] }))
      if (completed < 10) bridge.requestPose('sit_down')
    }
  }, [bridge, cycles, pose])
  const busy = !pose || !!pose.moving || !!pose.transitioning
  return <main className="single-actions-study">
    <section className="single-actions-stage"><Canvas orthographic dpr={[1, 1.5]} camera={{ position: [0, .8, 4], zoom: 290, near: .01, far: 100 }}>
      <color attach="background" args={['#252831']} /><ambientLight intensity={1.6} /><directionalLight position={[-3, 5, 4]} intensity={2.6} /><directionalLight position={[4, 3, -3]} intensity={1.2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.002, 0]}><planeGeometry args={[12, 12]} /><meshStandardMaterial color="#48423f" /></mesh>
      <Suspense fallback={null}><StudyBed visible={showBed} /><group ref={root} position={characterPlacement.position}><ZhuZhuXinCharacter height={characterPlacement.height} rotation={[0, characterPlacement.yaw, 0]} command={command} onPlayback={observe} motionRoot={root} openArmsHoldSeconds={6} /></group></Suspense>
      <OrbitControls makeDefault target={[0, .8, 0]} minDistance={1} maxDistance={7} /><CameraView view={view} pose={pose} root={root} />
    </Canvas></section>
    <aside><a href="/">← 返回房间</a><h1>单角色动作 · 本地验收</h1><p>使用正式角色组件与同一动作桥实现。仅本页延长求抱抱保持至6秒，便于检查。</p>
      <p role="status" data-testid="pose-status">{pose?.action ?? '加载中'} · {pose?.posture} {pose?.moving ? '移动中' : pose?.transitioning ? '过渡中' : '稳定'}<br />{snapshot.message}</p>
      <div className="study-buttons"><button disabled={!pose || cycles.active} onClick={() => bridge.requestPose('sit_down')}>坐下</button><button disabled={!pose || cycles.active} onClick={() => bridge.requestPose('stand_up')}>起身</button><button disabled={!pose || cycles.active} onClick={() => bridge.requestPose('open_arms')}>求抱抱</button><button onClick={() => { setCycles(old => ({ ...old, active: false })); bridge.stop() }}>取消并安全站立</button></div>
      <div className="study-buttons">{(['Idle', 'Wave', 'ListenRap'] as const).map(action => <button key={action} disabled={!pose || cycles.active} onClick={() => bridge.submit({ commands: [{ type: action === 'Wave' ? 'wave' : action === 'ListenRap' ? 'listen_rap' : 'idle' }] })}>{action}</button>)}<button disabled={!pose || cycles.active} onClick={() => bridge.submit({ commands: [{ type: 'walk_to_desk' }] })}>去书桌</button><button disabled={!pose || cycles.active} onClick={() => bridge.submit({ commands: [{ type: 'walk_to_bed' }] })}>回床边</button></div>
      <div className="study-buttons"><button onClick={() => setView('front')}>正面</button><button onClick={() => setView('side')}>侧面</button><button onClick={() => setView('back')}>背面</button></div>
      <div className="study-buttons"><button disabled={!pose || cycles.active} onClick={() => bridge.submitRoot({ type: 'turn_around' })}>转身</button><button disabled={!pose || cycles.active} onClick={() => bridge.submitRoot({ type: 'come_to_me' })}>回到我面前</button></div>
      <div className="study-buttons"><button disabled={!pose || cycles.active} onClick={() => bridge.requestPose('jump')}>跳起来</button><button disabled={!pose || cycles.active} onClick={() => bridge.requestPose('dance')}>跳舞</button><button disabled={!pose || cycles.active} onClick={() => bridge.requestPose('sleep')}>床边打盹</button><button disabled={!pose || cycles.active} onClick={() => bridge.requestPose('wake_up')}>醒来</button></div>
      <label><input type="checkbox" checked={showBed} onChange={event => setShowBed(event.target.checked)} />显示现有床</label>
      <button disabled={busy || cycles.active || pose?.posture !== 'standing'} onClick={() => { setCycles({ active: true, completed: 0, phase: 'sit', positions: [] }); bridge.requestPose('sit_down') }}>连续十次坐下 / 起身</button>
      <p data-testid="cycle-result">已完成 {cycles.completed} / 10 · {cycles.active ? '测试中' : '已停止'}</p>
      <details><summary>只读验收数据</summary><pre data-testid="pose-debug">{JSON.stringify({ pose, cycles, pending: snapshot.pending })}</pre></details>
      <p>35°短腿玩偶坐姿。臀腿纹理存在已说明且用户接受的牵拉；不等同于自然屈膝。没有修改模型或绑定。</p>
    </aside>
  </main>
}
