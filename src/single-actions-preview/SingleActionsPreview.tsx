import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Mesh, Vector3 } from 'three'
import type { AnimationAction } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { createCharacterClips } from '../characters/characterAnimations'
import { createSeatingStudyClips, seatingStudy } from '../characters/seatingStudy'
import './single-actions-preview.css'

type StudyState = 'Idle' | 'SitDown' | 'Seated' | 'StandUp'
type Command = { type: 'sit' | 'stand'; sequence: number }
const captions: Record<StudyState, string> = { Idle: '站立', SitDown: '试坐过渡中', Seated: '试坐保持 · 尚未验收', StandUp: '安全回到站立' }
function StudyCharacter({ command, degrees, onState }: { command: Command; degrees: number; onState: (state: StudyState) => void }) {
  const { scene } = useGLTF('/models/shuibuxin-walk.glb')
  const setup = useMemo(() => {
    const instance = clone(scene)
    instance.traverse(object => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true } })
    const bounds = new Box3().setFromObject(instance), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3())
    const mixer = new AnimationMixer(instance)
    const clips = [...createCharacterClips(instance).filter(clip => clip.name === 'Idle'), ...createSeatingStudyClips(instance, degrees)]
    const actions = Object.fromEntries(clips.map(clip => [clip.name, mixer.clipAction(clip)])) as Record<StudyState, AnimationAction>
    return { instance, mixer, actions, scale: 1.45 / size.y, offset: [-center.x, -bounds.min.y, -center.z] as [number, number, number] }
  }, [scene, degrees])
  const root = useRef<Group>(null), state = useRef<StudyState>('Idle'), play = useRef<(next: StudyState) => void>(() => {}), callback = useRef(onState), pendingStand = useRef(false)
  callback.current = onState
  useEffect(() => {
    const start = (name: StudyState) => {
      const action = setup.actions[name]
      // Candidate clips share the complete quaternion channel set; never sum poses.
      for (const other of Object.values(setup.actions)) other.stop()
      action.reset().setLoop(name === 'SitDown' || name === 'StandUp' ? LoopOnce : LoopRepeat, name === 'SitDown' || name === 'StandUp' ? 1 : Infinity)
      action.clampWhenFinished = true
      action.play(); state.current = name; callback.current(name)
    }
    play.current = start
    const finished = (event: { action: AnimationAction }) => {
      if (event.action === setup.actions.SitDown) { start('Seated'); if (pendingStand.current) { pendingStand.current = false; start('StandUp') } }
      else if (event.action === setup.actions.StandUp) start('Idle')
    }
    setup.mixer.addEventListener('finished', finished); pendingStand.current = false; start('Idle')
    return () => { setup.mixer.removeEventListener('finished', finished); setup.mixer.stopAllAction() }
  }, [setup])
  useEffect(() => {
    if (command.type === 'sit' && state.current === 'Idle') play.current('SitDown')
    else if (command.type === 'stand') {
      if (state.current === 'SitDown') pendingStand.current = true
      else if (state.current === 'Seated') play.current('StandUp')
    }
  }, [command])
  useFrame((_, delta) => {
    setup.mixer.update(Math.min(delta, .1))
    const s = state.current, action = setup.actions[s]
    const t = Math.min(action.time / seatingStudy.duration, 1), eased = t * t * (3 - 2 * t)
    const amount = s === 'Seated' ? 1 : s === 'SitDown' ? eased : s === 'StandUp' ? 1 - eased : 0
    // Absolute anchors avoid accumulated offsets. This is a pose study, NOT a released walk route.
    if (root.current) root.current.position.set(...seatingStudy.approach).lerp(new Vector3(...seatingStudy.anchor), amount)
  })
  return <group ref={root} rotation={[0, seatingStudy.yaw, 0]}><group scale={setup.scale}><group position={setup.offset}><primitive object={setup.instance} dispose={null} /></group></group></group>
}
function StudyBed() {
  const { scene } = useGLTF('/models/cozy-room.glb')
  const bed = useMemo(() => scene.getObjectByName('Bed')!.clone(true), [scene])
  return <primitive object={bed} dispose={null} />
}
function CameraView({ view }: { view: 'front' | 'side' | 'back' }) {
  const { camera, controls } = useThree()
  useEffect(() => {
    const positions = { front: [-4.6, 1.1, .85], side: [-.25, 1.1, 5.3], back: [4, 1.1, .85] }
    camera.position.fromArray(positions[view]); camera.lookAt(-.25, 1.1, .85)
    if (controls && 'target' in controls) (controls.target as Vector3).set(-.25, 1.1, .85)
  }, [camera, controls, view])
  return null
}
export default function SingleActionsPreview() {
  const [degrees, setDegrees] = useState(55), [state, setState] = useState<StudyState>('Idle'), [view, setView] = useState<'front' | 'side' | 'back'>('front')
  const [showBed, setShowBed] = useState(true)
  const [command, setCommand] = useState<Command>({ type: 'stand', sequence: 0 })
  const request = (type: Command['type']) => setCommand(old => ({ type, sequence: old.sequence + 1 }))
  const observe = useCallback((next: StudyState) => setState(next), [])
  return <main className="single-actions-study">
    <section className="single-actions-stage"><Canvas orthographic dpr={[1, 1.5]} camera={{ position: [-4.6, 1.1, .85], zoom: 290, near: .01, far: 100 }}>
      <color attach="background" args={['#252831']} /><ambientLight intensity={1.6} /><directionalLight position={[-3, 5, 4]} intensity={2.6} /><directionalLight position={[4, 3, -3]} intensity={1.2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.002, 0]}><planeGeometry args={[12, 12]} /><meshStandardMaterial color="#48423f" /></mesh>
      <Suspense fallback={null}><group visible={showBed}><StudyBed /></group><StudyCharacter command={command} degrees={degrees} onState={observe} /></Suspense>
      <OrbitControls makeDefault target={[-.25, 1.1, .85]} minDistance={1} maxDistance={7} /><CameraView view={view} />
    </Canvas></section>
    <aside><a href="/">← 返回房间</a><h1>床边坐姿 · 独立候选</h1><p>尚未验收，不向 AI 开放。不修改正式模型或房间。</p>
      <p role="status" data-testid="seating-status">{captions[state]}</p>
      <div className="study-buttons"><button onClick={() => request('sit')}>试坐</button><button onClick={() => request('stand')}>起身 / 安全取消</button></div>
      <label>整腿前摆角度<select aria-label="试坐角度" value={degrees} onChange={event => { request('stand'); setDegrees(Number(event.target.value)) }}>{seatingStudy.angles.map(angle => <option key={angle} value={angle}>{angle}°</option>)}</select></label>
      <div className="study-buttons"><button onClick={() => setView('front')}>正面</button><button onClick={() => setView('side')}>侧面</button><button onClick={() => setView('back')}>背面</button></div>
      <label><input type="checkbox" checked={showBed} onChange={event => setShowBed(event.target.checked)} />显示现有床</label><p>仅测试整腿玩偶式坐姿和固定锚点。过渡采用绝对位置；当前不是已验收的走近床边流程。</p><p>重点检查：裤裆牵拉、臀部与床沿接触、脚部位置。发现明显变形即停止正式接入。</p>
    </aside>
  </main>
}
