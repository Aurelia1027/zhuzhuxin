import { characterActions } from '../characters/characterAnimations'
import type { CharacterActionName } from '../characters/characterAnimations'
import { Component, Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Mesh, Texture, Vector2, Vector3 } from 'three'
import { ZhuZhuXinCharacter } from '../characters/ZhuZhuXinCharacter'
import './character-preview.css'

type Facts = { meshes: number; triangles: number; materials: number; textures: number; textureSizes: string[]; animations: string[]; sourceSize: number[]; readyMs: number; fetchMs: number | null; transferBytes: number | null }
type Sample = { calls: number; triangles: number; geometries: number; textures: number; resolution: number[]; renderer: string; fps: number; p95FrameMs: number; frames: number; durationMs: number; dpr: number; valid: boolean }
type Run = { id: number; dpr: number; model: boolean }
class PreviewError extends Component<{children: ReactNode}, {message: string}> {
  state = { message: '' }
  static getDerivedStateFromError(error: Error) { return { message: error.message } }
  render() { return this.state.message ? <p role="alert">模型加载失败：{this.state.message}</p> : this.props.children }
}
function AssetFacts({ onReady }: {onReady: (facts: Facts) => void}) {
  const { scene, animations } = useGLTF('/models/shuibuxin-walk.glb')
  useEffect(() => {
    let meshes = 0, triangles = 0
    const materials = new Set(), textures = new Set<Texture>()
    scene.traverse(object => {
      if (!(object instanceof Mesh)) return
      meshes++
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material)
        for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
      }
    })
    const resource = performance.getEntriesByName(new URL('/models/shuibuxin-walk.glb', location.href).href).at(-1) as PerformanceResourceTiming | undefined
    const size = new Box3().setFromObject(scene).getSize(new Vector3())
    onReady({ meshes, triangles, materials: materials.size, textures: textures.size,
      textureSizes: [...textures].map(t => `${t.image?.width}×${t.image?.height}`), animations: animations.map(a => a.name), sourceSize: size.toArray(), readyMs: performance.now(), fetchMs: resource?.duration ?? null, transferBytes: resource?.transferSize ?? null })
  }, [scene, animations, onReady])
  return null
}
function Meter({ run, onFinish }: {run: Run | null; onFinish: (sample: Sample) => void}) {
  const { gl } = useThree()
  const state = useRef({ id: -1, start: 0, last: 0, frames: [] as number[], hidden: false, done: false })
  useEffect(() => {
    const visibility = () => { if (document.hidden) state.current.hidden = true }
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])
  useFrame(() => {
    if (!run) return
    const now = performance.now(), s = state.current
    if (s.id !== run.id) Object.assign(s, { id: run.id, start: now + 2000, last: 0, frames: [], hidden: document.hidden, done: false })
    if (s.done || now < s.start) return
    if (s.last) s.frames.push(now - s.last)
    s.last = now
    if (now - s.start < 10000 || s.frames.length === 0) return
    s.done = true
    const sorted = [...s.frames].sort((a,b) => a-b), total = s.frames.reduce((a,b) => a+b, 0)
    const context = gl.getContext(), extension = context.getExtension('WEBGL_debug_renderer_info')
    // Read previous completed frame: no manual render and no render-priority override.
    onFinish({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
      resolution: gl.getDrawingBufferSize(new Vector2()).toArray(), renderer: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      fps: 1000 * s.frames.length / total, p95FrameMs: sorted[Math.floor((sorted.length-1)*.95)], frames: s.frames.length, durationMs: total, dpr: gl.getPixelRatio(), valid: !s.hidden })
  })
  return null
}
export default function CharacterPreview() {
  const [previewAction,setPreviewAction] = useState<CharacterActionName>(new URLSearchParams(location.search).get('action')==='Walk'?'Walk':'Idle')
  const [facts, setFacts] = useState<Facts | null>(null)
  const [dpr, setDpr] = useState(1)
  const [model, setModel] = useState(true)
  const [view, setView] = useState(0)
  const [run, setRun] = useState<Run | null>(null)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<(Sample & Run)[]>([])
  const finish = (sample: Sample) => { if (run) setResults(old => [...old, {...sample, ...run}]); setBusy(false) }
  return <main className="character-preview">
    <section className="preview-stage">
      <PreviewError><Canvas dpr={dpr} camera={{ position: [0, .48, 1.65], fov: 36 }} gl={{ antialias: true }}>
        <color attach="background" args={['#20242b']} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[2, 4, 4]} intensity={2.3} />
        <directionalLight position={[-3, 1, -2]} intensity={1.1} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0,-.002,0]}><planeGeometry args={[5,5]} /><meshStandardMaterial color="#373d46" roughness={1} /></mesh>
        <Suspense fallback={null}>
          <AssetFacts onReady={setFacts} />
          <group visible={model} rotation={[0,view,0]}><ZhuZhuXinCharacter height={.8} command={{action:previewAction,sequence:0}} /></group>
        </Suspense>
        <OrbitControls makeDefault target={[0,.4,0]} minDistance={.5} maxDistance={3.5} enablePan={false} />
        <Meter run={run} onFinish={finish} />
      </Canvas></PreviewError>
      <span className="preview-caption">SHUIBUXIN / MOTION STUDY · 鼠标旋转，滚轮缩放</span>
    </section>
    <aside>
      <a href="/">← 返回 Lumi Room</a><p className="eyebrow">WEEK 03 · CHARACTER LAB</p>
      <h1>猪猪心 · 角色预览</h1><label>预览动作<select aria-label="预览动作" value={previewAction} onChange={e=>setPreviewAction(e.target.value as CharacterActionName)}>{characterActions.map(a=><option key={a} value={a}>{a}</option>)}</select></label><p>验收版本 · 12 根骨骼 / 4 个运行时动作<br />独立测试场景，房间布局保持原样。</p>
      <p role="status">{facts ? '角色 GLB 已加载' : '正在加载 12 骨骼 GLB…'}</p>
      <dl><dt>三角面</dt><dd>{facts?.triangles.toLocaleString() ?? '—'}</dd><dt>Mesh / 材质 / 纹理</dt><dd>{facts ? `${facts.meshes} / ${facts.materials} / ${facts.textures}` : '—'}</dd><dt>纹理尺寸</dt><dd>{facts?.textureSizes.join(', ') ?? '—'}</dd><dt>GLB</dt><dd>shuibuxin-walk.glb</dd><dt>显示高度</dt><dd>0.8 房间单位 · 脚底 Y=0</dd></dl>
      <fieldset disabled={busy}><legend>观察方向</legend><button onClick={()=>setView(0)}>正面</button><button onClick={()=>setView(Math.PI/2)}>侧面</button><button onClick={()=>setView(Math.PI)}>背面</button></fieldset>
      <fieldset disabled={busy}><legend>性能测试条件</legend>
        <label>像素比例 <select value={dpr} onChange={e=>setDpr(Number(e.target.value))}><option value={1}>DPR 1</option><option value={1.5}>DPR 1.5</option></select></label>
        <label><input type="checkbox" checked={model} onChange={e=>setModel(e.target.checked)} />显示角色（关闭测空场景基线）</label>
      </fieldset>
      <button className="measure" disabled={!facts || busy} onClick={()=>{setBusy(true);setRun({id:Date.now(),dpr,model})}}>{busy ? '预热 2 秒 + 采样 10 秒…' : '开始性能采样'}</button>
      <p className="note">采样期间保持页面可见、视角不动。无阴影、无后期。FPS 为帧间隔实测，受屏幕刷新率及浏览器调度影响，不是 GPU 耗时。空场景只隐藏角色，已加载的资源仍在内存。</p>
      {results.map(r=><article key={r.id}><strong>{r.model ? '角色' : '空场景'} · DPR {r.dpr}</strong><p>{r.fps.toFixed(1)} FPS · P95 {r.p95FrameMs.toFixed(1)} ms<br />{r.calls} Draw Calls · {r.triangles.toLocaleString()} triangles<br />{r.resolution.join(' × ')} px · {r.valid ? '全程前台' : '曾进入后台，结果无效'}</p></article>)}
      <details><summary>原始测量数据</summary><pre id="character-metrics">{JSON.stringify({facts,results,userAgent:navigator.userAgent},null,2)}</pre></details>
    </aside>
  </main>
}
