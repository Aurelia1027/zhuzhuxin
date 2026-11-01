import { Block, Cylinder } from './Primitives'
import type { Position } from './palette'

const graphite = '#18191c'
const edge = '#303136'

/** Small, deliberately unbranded sneaker; front/toe points toward +Z. */
function Sneaker({ position, color = '#d8d6d0', accent = '#777984', rotation = 0 }: {
  position: Position; color?: string; accent?: string; rotation?: number
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Block size={[0.132, 0.037, 0.292]} position={[0, 0.025, 0.008]} color="#cecdc6" radius={0.018} />
      <Block size={[0.134, 0.009, 0.283]} position={[0, 0.013, 0.008]} color="#55565a" radius={0.004} />
      <Block size={[0.116, 0.079, 0.245]} position={[0, 0.077, 0.002]} color={color} radius={0.033} />
      <Block size={[0.108, 0.11, 0.105]} position={[0, 0.109, -0.075]} color={color} radius={0.028} />
      <mesh position={[0, 0.157, -0.076]} scale={[0.038, 0.009, 0.035]}>
        <sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#16171b" roughness={1} />
      </mesh>
      <Block size={[0.072, 0.021, 0.098]} position={[0, 0.128, -0.014]} rotation={[-0.25, 0, 0]} color={accent} radius={0.008} />
      {[0, 1, 2, 3].map(index => <Block key={index} size={[0.077, 0.007, 0.008]} position={[0, 0.134 - index * 0.006, -0.038 + index * 0.022]} color="#e9e7df" radius={0.003} />)}
      {[-1, 1].map(side => <Block key={side} size={[0.006, 0.025, 0.105]} position={[side * 0.059, 0.078, 0.006]} rotation={[0.2, 0, 0]} color={accent} radius={0.003} />)}
      <Block size={[0.055, 0.025, 0.007]} position={[0, 0.117, -0.129]} color={accent} radius={0.003} />
    </group>
  )
}

function ShoePair({ position, color, accent, rotation = 0 }: {
  position: Position; color?: string; accent?: string; rotation?: number
}) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <Sneaker position={[-0.083, 0, 0]} color={color} accent={accent} rotation={-0.06} />
    <Sneaker position={[0.083, 0, 0]} color={color} accent={accent} rotation={0.09} />
  </group>
}

/** Carcass: 1.35m wide × .48m deep × 1.35m tall. Shoes add .17m. */
export function ShoeCabinet() {
  return (
    <group name="shoe-cabinet">
      <Block size={[1.32, 1.27, 0.025]} position={[0, 0.685, -0.227]} color="#111216" radius={0.008} />
      {[-0.651, 0.651].map(x => <Block key={x} size={[0.048, 1.3, 0.48]} position={[x, 0.68, 0]} color={graphite} radius={0.013} />)}
      {[0.07, 0.45, 0.88, 1.32].map(y => <Block key={y} size={[1.35, 0.055, 0.48]} position={[0, y, 0]} color={y === 1.32 ? '#24252a' : graphite} radius={0.015} />)}
      <Block size={[0.038, 0.82, 0.44]} position={[0.03, 0.89, 0]} color={graphite} radius={0.008} />
      {/* A closed left compartment and two open right bays mirror the reference's mix of storage and display. */}
      <Block size={[0.63, 0.8, 0.029]} position={[-0.316, 0.897, 0.237]} color="#24252a" radius={0.012} />
      <Block size={[0.2, 0.016, 0.024]} position={[-0.315, 1.265, 0.263]} color="#8a8985" radius={0.005} />
      <Block size={[0.06, 0.105, 0.004]} position={[-0.525, 1.17, 0.254]} color="#dedbd3" radius={0.002} />
      <Block size={[0.042, 0.064, 0.005]} position={[-0.525, 1.18, 0.257]} color="#3e566a" radius={0.001} />
      <ShoePair position={[-0.33, 0.101, 0.045]} color="#dddcd4" accent="#4a4c53" rotation={0.08} />
      <ShoePair position={[0.33, 0.101, 0.045]} color="#24262d" accent="#a75558" rotation={-0.1} />
      <ShoePair position={[0.33, 0.48, 0.025]} color="#9e9f9b" accent="#353a3f" />
      <ShoePair position={[0.33, 0.91, 0.035]} color="#202329" accent="#bcbab0" rotation={0.1} />
      <ShoePair position={[-0.43, 1.35, 0.04]} color="#202329" accent="#dedbd2" rotation={-0.08} />
      <ShoePair position={[0, 1.35, 0.02]} color="#deddd5" accent="#9b9d99" rotation={-0.08} />
      <ShoePair position={[0.43, 1.35, 0.02]} color="#202329" accent="#bcb9ae" rotation={0.1} />
      {[-0.57, 0.57].flatMap(x => [-0.17, 0.17].map(z => <Cylinder key={`${x}-${z}`} position={[x, 0.028, z]} radius={0.029} height={0.055} color="#0d0e12" />))}
    </group>
  )
}

function Book({ position, height, color, width = 0.07 }: { position: Position; height: number; color: string; width?: number }) {
  return <group position={position}>
    <Block size={[width, height, 0.23]} position={[0, height / 2, 0]} color={color} radius={0.006} />
    <Block size={[width * 0.62, 0.01, 0.003]} position={[0, height * 0.78, 0.117]} color="#b8b7af" radius={0.001} />
    <Block size={[width * 0.62, 0.006, 0.003]} position={[0, height * 0.24, 0.117]} color="#a8a79f" radius={0.001} />
  </group>
}

/** Tall display unit: .9m wide × .5m deep × 2.65m tall. */
export function TallShelf() {
  return (
    <group name="tall-display-shelf">
      <Block size={[0.9, 2.65, 0.025]} position={[0, 1.325, -0.237]} color="#101115" radius={0.008} />
      {[-0.419, 0.419].map(x => <Block key={x} size={[0.062, 2.65, 0.5]} position={[x, 1.325, 0]} color={graphite} radius={0.014} />)}
      {[0.055, 0.57, 1.085, 1.6, 2.115, 2.62].map((y, index) => <group key={y}>
        <Block size={[0.9, 0.06, 0.5]} position={[0, y, 0]} color={index === 5 ? edge : graphite} radius={0.014} />
        {index > 0 && <mesh position={[0, y - 0.035, 0.14]}><boxGeometry args={[0.73, 0.008, 0.012]} /><meshStandardMaterial color="#d4ab70" emissive="#ffa64b" emissiveIntensity={1.35} toneMapped={false} /></mesh>}
      </group>)}
      <Block size={[0.31, 0.25, 0.3]} position={[-0.195, 0.21, 0.01]} color="#33343b" radius={0.013} />
      <Block size={[0.08, 0.023, 0.004]} position={[-0.195, 0.23, 0.164]} color="#aaa9a2" radius={0.003} />
      {[0, 1, 2].map(i => <Book key={i} position={[0.08 + i * 0.07, 0.09, 0.02]} height={0.33 + i % 2 * 0.03} color={['#3a3b40', '#c0bdb3', '#3c4249'][i]} width={0.055} />)}
      <ShoePair position={[-0.14, 0.605, 0.02]} color="#1d2027" accent="#a57768" rotation={0.2} />
      <Block size={[0.22, 0.08, 0.29]} position={[0.24, 0.64, -0.01]} color="#77736c" radius={0.009} />
      <Block size={[0.225, 0.018, 0.3]} position={[0.24, 0.69, -0.01]} color="#bcb8ad" radius={0.007} />
      <ShoePair position={[-0.16, 1.12, 0.03]} color="#d9d5c9" accent="#49464b" rotation={-0.1} />
      <Sneaker position={[0.245, 1.12, 0.015]} color="#282b33" accent="#d6cbc0" rotation={0.1} />
      {Array.from({ length: 8 }, (_, i) => <Book key={i} position={[-0.3 + i * 0.085, 1.635, 0]} height={0.31 + (i % 3) * 0.018} color={['#d4d0c4', '#393c42', '#bbb9b0', '#666b71'][i % 4]} />)}
      <Block size={[0.22, 0.29, 0.2]} position={[-0.24, 2.29, 0.03]} color="#28282d" radius={0.013} />
      <mesh position={[-0.24, 2.32, 0.134]}><circleGeometry args={[0.032, 16]} /><meshStandardMaterial color="#8b7f68" metalness={0.55} roughness={0.4} /></mesh>
      <Book position={[0.005, 2.15, 0]} height={0.34} color="#c9c5b9" width={0.09} />
      <Book position={[0.105, 2.15, 0]} height={0.3} color="#6b6a68" width={0.07} />
      {/* A tiny abstract collectible, deliberately free of licensed character details. */}
      <group position={[0.28, 2.155, 0.02]}>
        <Cylinder position={[0, 0.025, 0]} radius={0.065} height={0.04} color="#4e453b" />
        <mesh position={[0, 0.16, 0]} castShadow><icosahedronGeometry args={[0.08, 0]} /><meshStandardMaterial color="#9e8d70" metalness={0.55} roughness={0.5} /></mesh>
        <Cylinder position={[0, 0.08, 0]} radius={0.023} height={0.09} color="#9e8d70" />
      </group>
    </group>
  )
}
