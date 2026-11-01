import { useEffect, useMemo } from 'react'
import { CanvasTexture, DoubleSide, PlaneGeometry, SRGBColorSpace } from 'three'
import { Block } from './Primitives'
import type { Mood } from './palette'

function makeSkyTexture(evening: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 768
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, 0, 768)
  gradient.addColorStop(0, evening ? '#101b32' : '#adc3d0')
  gradient.addColorStop(0.7, evening ? '#384459' : '#e5ddd0')
  gradient.addColorStop(1, evening ? '#56494e' : '#c2beb4')
  context.fillStyle = gradient
  context.fillRect(0, 0, 768, 768)
  context.fillStyle = evening ? '#dce6eb' : '#f7f0da'
  context.beginPath()
  context.arc(560, 150, evening ? 24 : 43, 0, Math.PI * 2)
  context.fill()
  const buildings = [192, 253, 205, 315, 247, 184, 280, 219, 329, 260, 208]
  buildings.forEach((height, index) => {
    const x = index * 76 - 20
    context.fillStyle = evening ? (index % 2 ? '#25303f' : '#1c2937') : (index % 2 ? '#929ea3' : '#a7acaa')
    context.fillRect(x, 768 - height, 64, height)
    if (evening) {
      context.fillStyle = '#b9a77c'
      for (let row = 0; row < Math.floor(height / 35); row += 1) {
        for (let col = 0; col < 3; col += 1) {
          if ((row * 3 + col + index) % 3 === 0) context.fillRect(x + 10 + col * 17, 780 - height + row * 32, 5, 9)
        }
      }
    }
  })
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function Curtain({ x }: { x: number }) {
  const geometry = useMemo(() => {
    const result = new PlaneGeometry(0.63, 3.02, 28, 24)
    const positions = result.attributes.position
    for (let i = 0; i < positions.count; i += 1) {
      const u = (positions.getX(i) + 0.315) / 0.63
      const v = (positions.getY(i) + 1.51) / 3.02
      positions.setZ(i, Math.sin(u * Math.PI * 10) * 0.048 + Math.sin(u * Math.PI * 20) * 0.008)
      positions.setX(i, positions.getX(i) + Math.sin(v * Math.PI) * 0.018 * Math.cos(u * Math.PI))
      positions.setY(i, positions.getY(i) - (1 - v) * Math.cos(u * Math.PI * 10) * 0.018)
    }
    result.computeVertexNormals()
    return result
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group position={[x, -0.295, 0.22]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#1b1c20" roughness={0.98} side={DoubleSide} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => (
        <mesh key={index} position={[-0.27 + index * 0.108, 1.53, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.033, 0.007, 6, 12]} />
          <meshStandardMaterial color="#585456" roughness={0.38} metalness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

export function Window({ mood }: { mood: Mood }) {
  const texture = useMemo(() => makeSkyTexture(mood === 'evening'), [mood])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group name="window-and-curtains" position={[3.97, 1.875, -1.425]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0, -0.085]}>
        <planeGeometry args={[2.35, 1.95]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.015]}>
        <planeGeometry args={[2.3, 1.9]} />
        <meshStandardMaterial color="#b4c8d5" transparent opacity={0.12} roughness={0.15} metalness={0.2} depthWrite={false} />
      </mesh>
      {[-1.2, 1.2].map(x => <Block key={x} position={[x, 0, 0.025]} size={[0.07, 2.06, 0.12]} color="#8c8d89" radius={0.008} />)}
      {[-1.005, 1.005].map(y => <Block key={y} position={[0, y, 0.025]} size={[2.46, 0.07, 0.12]} color="#8c8d89" radius={0.008} />)}
      <Block position={[0, 0, 0.04]} size={[0.055, 1.95, 0.1]} color="#a9aba7" radius={0.006} />
      <Block position={[0, -1.055, 0.08]} size={[2.62, 0.08, 0.33]} color="#696b6d" radius={0.012} />
      <mesh position={[0, 1.255, 0.22]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 3.18, 12]} />
        <meshStandardMaterial color="#343337" roughness={0.4} metalness={0.7} />
      </mesh>
      <Curtain x={-1.15} />
      <Curtain x={1.15} />
    </group>
  )
}

/** The frame and curtains now come from Blender; only the changing sky remains procedural. */
export function WindowSky({ mood }: { mood: Mood }) {
  const texture = useMemo(() => makeSkyTexture(mood === 'evening'), [mood])
  useEffect(() => () => texture.dispose(), [texture])
  return <group name="dynamic-window-sky" position={[3.97, 1.875, -1.425]} rotation={[0, -Math.PI / 2, 0]}>
    <mesh position={[0, 0, -0.15]}>
      <planeGeometry args={[2.35, 1.95]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
    <mesh position={[0, 0, -0.015]}>
      <planeGeometry args={[2.3, 1.9]} />
      <meshStandardMaterial color="#b4c8d5" transparent opacity={0.12} roughness={0.15} metalness={0.2} depthWrite={false} />
    </mesh>
  </group>
}
