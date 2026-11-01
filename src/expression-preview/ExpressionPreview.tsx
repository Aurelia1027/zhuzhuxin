import { Component, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { CharacterExpressionControls } from '../components/CharacterExpressionControls'
import { useExpressionStore } from '../stores/expressionStore'
import { ZhuZhuXinCharacter } from '../characters/ZhuZhuXinCharacter'
import type { CharacterPlayback } from '../characters/ZhuZhuXinCharacter'
import type { CharacterActionCommand, CharacterActionName } from '../characters/characterAnimations'
import './expression-preview.css'

class PreviewBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(error: Error) { return { error: error.message } }
  render() { return this.state.error ? <p role="alert">预览加载失败：{this.state.error}</p> : this.props.children }
}
function View({side}:{side:boolean}) {
  const {camera} = useThree()
  useEffect(() => {
    camera.position.set(side ? 1.6 : 0,.78,side ? 0 : 1.6)
    camera.lookAt(0,.64,0)

  },[camera,side])
  return null
}
export default function ExpressionPreview(){
  const {expression}=useExpressionStore()
  const [side,setSide]=useState(false),[playback,setPlayback]=useState<CharacterPlayback|null>(null)
  const [command,setCommand]=useState<CharacterActionCommand>({action:'Idle',sequence:0})
  const action=(name:CharacterActionName)=>setCommand(c=>({action:name,sequence:c.sequence+1}))
  return <main className="expression-preview"><aside><p className="eyebrow">LUMI ROOM · EXPRESSION LAB</p><h1>猪猪心 · 刺绣表情</h1><p>拖动旋转，滚轮缩放。表情贴图与身体动作可以同时切换。</p><CharacterExpressionControls /><h2>动作组合检查</h2><div className="actions">{(['Idle','Walk','Wave','ListenRap'] as const).map(name=><button key={name} aria-pressed={command.action===name} onClick={()=>action(name)}>{({Idle:'待机',Walk:'原地步态',Wave:'挥手',ListenRap:'听 Rap'})[name]}</button>)}</div><div className="actions"><button onClick={()=>setSide(false)}>正面</button><button onClick={()=>setSide(true)}>侧面</button></div><p role="status">{expression} · {playback ? `${playback.bones} 骨骼 / ${playback.action}` : '模型加载中'}</p><small>独立测试页使用原 shuibuxin-walk.glb；房间布局和原有互动入口保持原样。</small></aside><section aria-label="角色三维预览"><PreviewBoundary><Canvas shadows camera={{position:[0,.78,1.6],fov:36}} dpr={[1,1.5]}><color attach="background" args={['#242932']}/><ambientLight intensity={1.5}/><directionalLight position={[2,3,4]} intensity={2.2} castShadow/><directionalLight position={[-3,1,1]} intensity={1}/><Suspense fallback={null}><ZhuZhuXinCharacter height={1} command={command} onPlayback={setPlayback}/></Suspense><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.005,0]} receiveShadow><planeGeometry args={[5,5]}/><meshStandardMaterial color="#343a43" roughness={1}/></mesh><OrbitControls makeDefault target={[0,.64,0]} minDistance={.65} maxDistance={3.5}/><View side={side}/></Canvas></PreviewBoundary></section></main>
}


