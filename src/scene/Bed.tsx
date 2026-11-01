import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { RoundedBox } from '@react-three/drei'
import { CanvasTexture, DoubleSide, Float32BufferAttribute, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from 'three'
import { Block } from './Primitives'

function smoothstep(low: number, high: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

/** A continuous cloth surface: top, rounded mattress edge, then hanging sides. */
function makeCloth(xMin: number, xMax: number, halfDepth: number, lift: number) {
  const segmentsX = 42
  const segmentsZ = 48
  const geometry = new PlaneGeometry(1, 1, segmentsX, segmentsZ)
  const coordinates = new Float32Array((segmentsX + 1) * (segmentsZ + 1) * 3)
  for (let row = 0; row <= segmentsZ; row++) {
    for (let col = 0; col <= segmentsX; col++) {
      const x = xMin + col / segmentsX * (xMax - xMin)
      const z = -halfDepth + row / segmentsZ * 2 * halfDepth
      const sideDrop = smoothstep(0.98, halfDepth, Math.abs(z))
      const footDrop = smoothstep(1.48, 1.72, -x)
      const folds = Math.sin(x * 12 + z * 5) * 0.014 + Math.sin(z * 18 - x * 4) * 0.012 + Math.cos(x * 23 + z * 9) * 0.006
      const y = 0.685 + lift - sideDrop * 0.37 - footDrop * 0.22 + folds * (1 + sideDrop * 0.7)
      const offset = (row * (segmentsX + 1) + col) * 3
      coordinates[offset] = x
      coordinates[offset + 1] = y
      coordinates[offset + 2] = z + sideDrop * Math.sin(x * 14) * 0.018
    }
  }
  geometry.setAttribute('position', new Float32BufferAttribute(coordinates, 3))
  // The parametrized surface faces up, with draped edges remaining continuous.
  geometry.computeVertexNormals()
  return geometry
}

function makeFabric() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')!
  context.fillStyle = '#808080'
  context.fillRect(0, 0, 128, 128)
  for (let y = 0; y < 128; y += 2) {
    for (let x = 0; x < 128; x += 2) {
      const value = 105 + ((x * 17 + y * 31) % 48)
      context.fillStyle = `rgb(${value},${value},${value})`
      context.fillRect(x, y, 1, 2)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(5, 5)
  return texture
}

function makeChecker() {
  const canvas = document.createElement('canvas')
  canvas.width = 500
  canvas.height = 1000
  const context = canvas.getContext('2d')!
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 5; col++) {
      context.fillStyle = (row + col) % 2 === 0 ? '#d1cec7' : '#16171b'
      context.fillRect(col * 100, row * 100, 100, 100)
      context.strokeStyle = (row + col) % 2 === 0 ? '#c6c3bd' : '#202125'
      for (let line = 0; line < 100; line += 5) {
        context.beginPath()
        context.moveTo(col * 100, row * 100 + line)
        context.lineTo((col + 1) * 100, row * 100 + line)
        context.stroke()
      }
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function Pillow({ position, rotation, color, size = [0.55, 0.23, 0.82] }: {
  position: [number, number, number]
  rotation: [number, number, number]
  color: string
  size?: [number, number, number]
}) {
  return (
    <RoundedBox args={size} radius={0.1} smoothness={4} position={position} rotation={rotation} castShadow receiveShadow>
      <meshPhysicalMaterial color={color} roughness={0.98} sheen={0.7} sheenRoughness={0.8} />
    </RoundedBox>
  )
}

/** Black upholstered bed, long axis X, headboard at +X. Children can hold separately interactive bedding. */
export function Bed({ children }: { children?: ReactNode }) {
  const duvet = useMemo(() => makeCloth(-1.72, 1.35, 1.22, 0), [])
  const throwCloth = useMemo(() => makeCloth(-1.46, -0.35, 1.26, 0.025), [])
  const fabric = useMemo(makeFabric, [])
  const checker = useMemo(makeChecker, [])
  useEffect(() => () => {
    duvet.dispose()
    throwCloth.dispose()
    fabric.dispose()
    checker.dispose()
  }, [duvet, throwCloth, fabric, checker])

  return (
    <group name="bed">
      {[-1.4, 1.4].flatMap(x => [-0.89, 0.89].map(z => <Block key={`${x}-${z}`} size={[0.12, 0.22, 0.12]} position={[x, 0.14, z]} color="#141519" radius={0.015} />))}
      <Block size={[3.3, 0.22, 2.15]} position={[0, 0.3, 0]} color="#191a1e" radius={0.08} />
      <Block size={[3.15, 0.27, 2.03]} position={[0, 0.485, 0]} color="#b7b4ae" radius={0.11} />
      <Block size={[0.16, 1.26, 2.24]} position={[1.66, 0.66, 0]} color="#121316" radius={0.065} />
      {[-0.73, 0, 0.73].map(z => (
        <Block key={z} size={[0.055, 0.94, 0.71]} position={[1.55, 0.79, z]} color="#24252b" radius={0.035} />
      ))}
      <mesh geometry={duvet} castShadow receiveShadow>
        <meshPhysicalMaterial color="#303136" roughness={0.95} bumpMap={fabric} bumpScale={0.009}
          side={DoubleSide} sheen={0.8} sheenColor="#64646a" sheenRoughness={0.9} />
      </mesh>
      <mesh geometry={throwCloth} castShadow receiveShadow>
        <meshPhysicalMaterial map={checker} roughness={0.94} bumpMap={fabric} bumpScale={0.006}
          side={DoubleSide} sheen={0.45} sheenRoughness={0.9} />
      </mesh>
      <Pillow position={[1.19, 0.84, -0.51]} rotation={[0.03, 0.03, 0.23]} color="#737375" />
      <Pillow position={[1.17, 0.85, 0.5]} rotation={[-0.03, -0.05, 0.21]} color="#b7b0a5" />
      <Pillow position={[0.84, 0.795, -0.54]} rotation={[0.06, 0.1, 0.08]} color="#414248" size={[0.49, 0.18, 0.69]} />
      <Pillow position={[0.85, 0.8, 0.51]} rotation={[-0.04, -0.1, 0.06]} color="#505057" size={[0.47, 0.18, 0.68]} />
      {children}
    </group>
  )
}
