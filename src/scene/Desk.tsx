import { Block, Cylinder } from './Primitives'
import { Plant } from './Plant'
import { palette } from './palette'

export function Desk({ lampOn, onToggleLamp }: { lampOn: boolean; onToggleLamp: () => void }) {
  return (
    <group name="desk" position={[1.62, 0, -1.7]}>
      <Block size={[2, 0.13, 0.9]} position={[0, 1.13, 0]} color={palette.woodLight} radius={0.055} />
      {[-0.82, 0.82].flatMap(x => [-0.31, 0.31].map(z => <Block key={`${x}-${z}`} size={[0.1, 1.07, 0.1]} position={[x, 0.55, z]} color={palette.wood} />))}
      <Block size={[0.65, 0.28, 0.72]} position={[0.58, 0.91, 0]} color={palette.wood} />
      <Block size={[0.24, 0.035, 0.035]} position={[0.58, 0.91, 0.38]} color={palette.woodDark} radius={0.01} />
      <Block size={[0.49, 0.045, 0.34]} position={[-0.11, 1.23, 0.1]} rotation={[0, -0.14, 0]} color="#a6ad90" radius={0.01} />
      <Block size={[0.44, 0.025, 0.3]} position={[-0.11, 1.26, 0.1]} rotation={[0, -0.14, 0]} color="#f8ecd8" radius={0.005} />
      <Cylinder position={[0.48, 1.29, 0.19]} radius={0.09} height={0.18} color={palette.cream} />
      <mesh position={[0.59, 1.3, 0.19]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.06, 0.018, 6, 12]} />
        <meshStandardMaterial color={palette.cream} />
      </mesh>
      <Plant position={[0.72, 1.2, -0.22]} scale={0.32} potColor="#e8ddc4" />
      <group name="clickable-desk-lamp" position={[-0.66, 1.2, -0.15]} onClick={event => { event.stopPropagation(); onToggleLamp() }}>
        <Cylinder position={[0, 0.04, 0]} radius={0.18} height={0.075} color="#967c54" />
        <Cylinder position={[0, 0.28, 0]} radius={0.025} height={0.49} color="#8d7753" />
        <mesh position={[0, 0.58, 0]} castShadow>
          <coneGeometry args={[0.28, 0.31, 16, 1, true]} />
          <meshStandardMaterial color="#efd9a5" emissive="#ffd190" emissiveIntensity={lampOn ? 0.55 : 0} side={2} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.51, 0]}>
          <sphereGeometry args={[0.065, 12, 8]} />
          <meshStandardMaterial color="#fff3cc" emissive="#ffc979" emissiveIntensity={lampOn ? 3 : 0} />
        </mesh>
        {lampOn && <pointLight position={[0, 0.48, 0.08]} color="#ffc274" intensity={3} distance={4} decay={2} />}
      </group>
      <group name="chair" position={[0.08, 0, 1.02]} rotation={[0, -0.15, 0]}>
        <Block size={[0.69, 0.12, 0.64]} position={[0, 0.61, 0]} color={palette.woodLight} radius={0.07} />
        <Block size={[0.59, 0.08, 0.54]} position={[0, 0.7, 0]} color="#c5c6a5" radius={0.055} />
        {[-0.26, 0.26].flatMap(x => [-0.23, 0.23].map(z => <Block key={`${x}-${z}`} size={[0.065, 0.58, 0.065]} position={[x, 0.3, z]} color={palette.wood} />))}
        {[-0.27, 0.27].map(x => <Block key={x} size={[0.06, 0.62, 0.06]} position={[x, 0.95, 0.26]} color={palette.wood} />)}
        <Block size={[0.66, 0.32, 0.075]} position={[0, 1.15, 0.26]} color={palette.woodLight} radius={0.045} />
      </group>
    </group>
  )
}
