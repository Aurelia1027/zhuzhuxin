import { actionBridge } from '../characters/actionBridge'
import { Component, Suspense, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import { RoomScene } from '../scene/RoomScene'
import type { RoomSceneProps } from '../scene/RoomScene'

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { actionBridge.fail('角色场景发生错误，后续动作已取消。'); console.error('Lumi Room renderer:', error, info.componentStack) }
  render() {
    if (this.state.failed) return <div className="scene-message" role="alert">房间暂时无法加载。请使用支持 WebGL 的浏览器，并开启硬件加速后刷新。</div>
    return this.props.children
  }
}

export function RoomViewport(props: RoomSceneProps) {
  const [ready, setReady] = useState(false)
  return (
    <div className="room-viewport" aria-label="可拖动旋转、缩放和点击家具的 3D 潮流卧室">
      {!ready && <div className="scene-message" role="status">正在点亮你的小房间…</div>}
      <SceneBoundary>
        <Canvas camera={{ position: [-7.7, 7.6, 9.7], fov: 45, near: .06, far: 80 }} shadows dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.15 }} onCreated={() => setReady(true)}
          fallback={<div className="scene-message" role="alert">浏览器不支持 WebGL，请开启硬件加速或更换浏览器。</div>}>
          <Suspense fallback={null}><RoomScene {...props} /></Suspense>
        </Canvas>
      </SceneBoundary>
    </div>
  )
}
