import { Block, Cylinder } from './Primitives'
import { Plant } from './Plant'
import { palette } from './palette'

export function Decor() {
  return (
    <group name="decor">
      <Block size={[2.75, 0.035, 2.72]} position={[0.7, 0.045, 0.75]} color="#e9d9b9" radius={0.14} />
      <Block size={[2.47, 0.012, 2.45]} position={[0.7, 0.069, 0.75]} color="#f0e2c6" radius={0.12} />
      {[-1, 1].flatMap(side => Array.from({ length: 14 }, (_, i) => (
        <Block key={`${side}-${i}`} size={[0.028, 0.014, 0.1]} position={[-0.48 + i * 0.18, 0.052, 0.75 + side * 1.39]} color="#d3bd97" radius={0.008} />
      )))}
      <Plant position={[2.42, 0.04, 1.64]} scale={1.1} />
      <group name="bedside-table" position={[-2.12, 0, -1.91]}>
        <Block size={[0.7, 0.63, 0.66]} position={[0, 0.36, 0]} color={palette.woodLight} radius={0.06} />
        <Block size={[0.57, 0.22, 0.035]} position={[0, 0.44, 0.34]} color={palette.wood} />
        <Cylinder position={[0, 0.75, 0]} radius={0.15} height={0.12} color="#e6d3b6" />
        <Plant position={[0, 0.8, 0]} scale={0.3} potColor="#f3e6ce" />
      </group>
      <group name="wall-art" position={[-2.96, 2.07, -0.4]} rotation={[0, Math.PI / 2, 0]}>
        <Block size={[0.96, 1.18, 0.07]} color={palette.wood} />
        <Block size={[0.83, 1.04, 0.02]} position={[0, 0, 0.045]} color="#f5e9d2" radius={0.005} />
        <mesh position={[0.09, 0.21, 0.062]}><circleGeometry args={[0.19, 24]} /><meshBasicMaterial color="#d9a273" /></mesh>
        <mesh position={[-0.1, -0.24, 0.065]} scale={[1, 0.75, 1]}><circleGeometry args={[0.31, 5]} /><meshBasicMaterial color="#9ca887" /></mesh>
      </group>
      <group name="wall-shelf" position={[1.82, 2.36, -2.32]}>
        <Block size={[1.63, 0.08, 0.35]} color={palette.woodLight} />
        {[0, 1, 2, 3].map(i => <Block key={i} size={[0.12, 0.29 + i % 2 * 0.07, 0.2]} position={[-0.47 + i * 0.14, 0.2, 0]} rotation={[0, 0, i === 3 ? -0.17 : 0]} color={['#9da78b', '#d9b78b', '#bb8d75', '#e5d7b9'][i]} radius={0.01} />)}
        <Plant position={[0.51, 0.05, 0]} scale={0.35} potColor="#ded0b7" />
      </group>
      <group name="ottoman" position={[0.75, 0.02, 1.42]}>
        <Cylinder position={[0, 0.22, 0]} radius={0.44} topRadius={0.47} height={0.42} color="#c6966f" segments={16} />
        <Cylinder position={[0, 0.45, 0]} radius={0.46} height={0.09} color="#d5ab84" segments={16} />
        <Block size={[0.3, 0.045, 0.24]} position={[0.02, 0.52, 0]} rotation={[0, 0.2, 0]} color="#f1e3c8" radius={0.01} />
      </group>
    </group>
  )
}
