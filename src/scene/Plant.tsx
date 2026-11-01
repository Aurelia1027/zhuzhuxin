import { Cylinder } from './Primitives'
import { palette } from './palette'
import type { Position } from './palette'

export function Plant({ position, scale = 1, potColor = palette.terra }: { position: Position; scale?: number; potColor?: string }) {
  return (
    <group name="plant" position={position} scale={scale}>
      <Cylinder position={[0, 0.23, 0]} radius={0.19} topRadius={0.27} height={0.46} color={potColor} />
      <Cylinder position={[0, 0.46, 0]} radius={0.255} height={0.035} color="#675345" />
      <Cylinder position={[0, 0.86, 0]} radius={0.018} height={0.8} color="#71815b" segments={6} />
      {Array.from({ length: 7 }, (_, i) => {
        const angle = i * 2.4
        const length = 0.28 + (i % 3) * 0.06
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.2, 0.7 + i * 0.1, Math.sin(angle) * 0.2]}
            rotation={[Math.sin(angle) * 0.6, -angle, -Math.cos(angle) * 0.65]} scale={[0.12, length, 0.055]} castShadow>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={['#71865c', '#8ca274', '#a0ad7d'][i % 3]} roughness={0.9} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}
