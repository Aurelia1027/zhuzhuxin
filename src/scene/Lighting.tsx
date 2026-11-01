import { useMemo } from 'react'
import { Object3D } from 'three'
import type { Mood } from './palette'

export function Lighting({ mood }: { mood: Mood }) {
  const night = mood === 'evening'
  const windowTarget = useMemo(() => { const target = new Object3D(); target.position.set(-1, 0, 1); return target }, [])
  return <>
    <ambientLight intensity={night ? .32 : .6} color={night ? '#c8cfdd' : '#e8ecf3'} />
    <hemisphereLight args={['#e5e7f2', '#4f3526', night ? .52 : .95]} />
    <spotLight position={[-.3, 3.08, .3]} color="#ffe0b5" intensity={night ? 52 : 38}
      angle={1.25} penumbra={.9} distance={12} decay={2} castShadow
      shadow-mapSize={[1024, 1024]} shadow-bias={-.00015} shadow-normalBias={.025} shadow-radius={3} />
    <pointLight position={[-2, 2.5, 1.2]} intensity={night ? 9 : 6} color="#ffd5a7" distance={8} decay={2} />
    <primitive object={windowTarget} />
    <spotLight position={[3.82, 2.5, -1.3]} target={windowTarget} intensity={night ? 5 : 36}
      color={night ? '#7b9acb' : '#d7e6ff'} angle={1.15} penumbra={.65} distance={12} decay={2}
      castShadow={!night} shadow-mapSize={[1024, 1024]} shadow-normalBias={.03} />
  </>
}
