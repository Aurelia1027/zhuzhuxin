import { useEffect, useMemo } from 'react'
import { CanvasTexture, DoubleSide, FrontSide, SRGBColorSpace } from 'three'
import type { Position, ViewMode } from './palette'
import { Block, Cylinder } from './Primitives'

function woodTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1536; canvas.height = 1024
  const ctx = canvas.getContext('2d')!
  let seed = 417
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  ctx.fillStyle = '#241a16'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  const rows = 18, rowHeight = canvas.height / rows
  for (let row = 0; row < rows; row++) {
    for (let col = -1; col < 5; col++) {
      const x = col * 384 + (row % 3) * 128, y = row * rowHeight
      const light = 19 + random() * 9
      ctx.fillStyle = `hsl(23, 35%, ${light}%)`
      ctx.fillRect(x + 1.2, y + 1.1, 382, rowHeight - 2.2)
      for (let grain = 0; grain < 30; grain++) {
        const gy = y + random() * rowHeight
        ctx.strokeStyle = random() > .5 ? 'rgba(9,5,2,.13)' : 'rgba(216,163,102,.09)'
        ctx.lineWidth = .5 + random()
        ctx.beginPath(); ctx.moveTo(x, gy)
        ctx.bezierCurveTo(x + 100, gy - 3, x + 250, gy + 4, x + 384, gy + random() * 3)
        ctx.stroke()
      }
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = 8
  return texture
}

function Wall({ width, height, position, rotation = [0, 0, 0], color = '#8b8a8c' }: {
  width: number; height: number; position: Position; rotation?: Position; color?: string
}) {
  return <mesh position={position} rotation={rotation} receiveShadow castShadow>
    <planeGeometry args={[width, height]} />
    {/* Interior-facing surfaces give a cutaway from outside and a complete shell inside. */}
    <meshStandardMaterial color={color} side={FrontSide} shadowSide={DoubleSide} roughness={.95} />
  </mesh>
}

export function RoomShell({ view }: { view: ViewMode }) {
  const floor = useMemo(woodTexture, [])
  useEffect(() => () => floor.dispose(), [floor])
  return <group name="complete-room-shell">
    <Block size={[8.12, .22, 6.12]} position={[0, -.125, 0]} color="#181719" radius={.04} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .003, 0]} receiveShadow>
      <planeGeometry args={[8, 6]} /><meshStandardMaterial map={floor} roughness={.52} metalness={.06} />
    </mesh>
    <Wall width={.1} height={3.25} position={[-3.95, 1.625, -3]} />
    <Wall width={6.9} height={3.25} position={[.55, 1.625, -3]} />
    <Wall width={1} height={.9} position={[-3.4, 2.8, -3]} />
    <Wall width={8} height={3.25} position={[0, 1.625, 3]} rotation={[0, Math.PI, 0]} color="#77767b" />
    <Wall width={6} height={3.25} position={[-4, 1.625, 0]} rotation={[0, Math.PI / 2, 0]} color="#727276" />
    {/* Structural window aperture on the right wall. */}
    <Wall width={.4} height={3.25} position={[4, 1.625, -2.8]} rotation={[0, -Math.PI / 2, 0]} />
    <Wall width={3.25} height={3.25} position={[4, 1.625, 1.375]} rotation={[0, -Math.PI / 2, 0]} />
    <Wall width={2.35} height={.9} position={[4, .45, -1.425]} rotation={[0, -Math.PI / 2, 0]} />
    <Wall width={2.35} height={.4} position={[4, 3.05, -1.425]} rotation={[0, -Math.PI / 2, 0]} />
    <Wall width={8} height={6} position={[0, 3.25, 0]} rotation={[Math.PI / 2, 0, 0]} color="#aaa5a1" />
    {[-3, 3].map(z => <Block key={z} size={[8, .12, .055]} position={[0, .08, z > 0 ? 2.97 : -2.97]} color="#49464a" radius={.008} />)}
    {[-4, 4].map(x => <Block key={x} size={[.055, .12, 6]} position={[x > 0 ? 3.97 : -3.97, .08, 0]} color="#49464a" radius={.008} />)}
    <Wall width={8} height={.075} position={[0, 3.19, -2.985]} color="#b4aca4" />
    <Wall width={8} height={.075} position={[0, 3.19, 2.985]} rotation={[0, Math.PI, 0]} color="#b4aca4" />
    <Wall width={6} height={.075} position={[-3.985, 3.19, 0]} rotation={[0, Math.PI / 2, 0]} color="#b4aca4" />
    <Wall width={6} height={.075} position={[3.985, 3.19, 0]} rotation={[0, -Math.PI / 2, 0]} color="#b4aca4" />
    {view === 'inside' && <group name="ceiling-fixture">
      <Cylinder position={[0, 3.14, .15]} radius={.4} height={.15} color="#141417" segments={32} />
      <mesh position={[0, 3.055, .15]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[.36, 32]} /><meshStandardMaterial color="#ffe4b3" emissive="#ffce8c" emissiveIntensity={2} />
      </mesh>
    </group>}
  </group>
}

export function Door() {
  return <group name="walnut-door" position={[-3.4, 0, -2.96]}>
    <Block size={[.96, 2.35, .09]} position={[0, 1.175, 0]} color="#43271e" radius={.01} />
    {[-.49, .49].map(x => <Block key={x} size={[.075, 2.43, .14]} position={[x, 1.21, .03]} color="#583429" radius={.008} />)}
    <Block size={[1.06, .075, .14]} position={[0, 2.39, .03]} color="#583429" radius={.008} />
    {[-.23, .23].flatMap(x => [.47, 1.2, 1.92].map(y => <group key={`${x}-${y}`}>
      <Block size={[.35, .58, .035]} position={[x, y, .062]} color="#64402d" radius={.01} />
      <Block size={[.29, .5, .025]} position={[x, y, .085]} color="#452b22" radius={.006} />
    </group>))}
    <Block size={[.045, .24, .025]} position={[.35, 1.02, .074]} color="#18181a" radius={.008} />
    <Block size={[.16, .035, .045]} position={[.29, 1.07, .115]} color="#242326" radius={.012} />
  </group>
}
