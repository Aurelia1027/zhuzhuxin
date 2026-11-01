import { RoundedBox } from '@react-three/drei'
import type { Position } from './palette'

interface BlockProps {
  position?: Position
  size: Position
  color: string
  radius?: number
  rotation?: Position
}

export function Block({ position, size, color, radius = 0.035, rotation }: BlockProps) {
  return (
    <RoundedBox args={size} position={position} rotation={rotation} radius={radius} smoothness={2} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.86} />
    </RoundedBox>
  )
}

export function Cylinder({ position, radius, height, color, topRadius = radius, segments = 12 }: {
  position: Position; radius: number; height: number; color: string; topRadius?: number; segments?: number
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={[topRadius, radius, height, segments]} />
      <meshStandardMaterial color={color} roughness={0.8} flatShading />
    </mesh>
  )
}
