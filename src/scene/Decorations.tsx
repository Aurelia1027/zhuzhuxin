import { useEffect, useMemo } from 'react'
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three'
import { Block, Cylinder } from './Primitives'
import { Plant } from './Plant'
import type { Mood, Position } from './palette'

function makePosterTexture(variant: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 1024
  const context = canvas.getContext('2d')!
  context.fillStyle = '#101014'
  context.fillRect(0, 0, 768, 1024)
  const pink = variant === 0 ? '#b87891' : '#c896ab'
  context.strokeStyle = '#5b3b50'
  context.lineWidth = 3
  for (let i = 0; i < 14; i += 1) {
    context.beginPath()
    context.moveTo(50 + i * 54, 35)
    context.lineTo(690 - i * 48, 985)
    context.stroke()
  }
  context.fillStyle = pink
  if (variant === 0) {
    context.beginPath()
    context.moveTo(460, 95)
    context.lineTo(165, 530)
    context.lineTo(365, 495)
    context.lineTo(210, 920)
    context.lineTo(654, 350)
    context.lineTo(430, 412)
    context.lineTo(608, 95)
    context.closePath()
    context.fill()
    context.strokeStyle = '#d9a4b9'
    context.lineWidth = 10
    context.beginPath()
    context.moveTo(61, 735)
    context.lineTo(701, 511)
    context.moveTo(63, 824)
    context.lineTo(697, 615)
    context.stroke()
  } else {
    context.save()
    context.translate(384, 455)
    for (let i = 0; i < 15; i += 1) {
      context.rotate(Math.PI * 2 / 15)
      context.beginPath()
      context.moveTo(5, 65)
      context.lineTo(72, 115)
      context.lineTo(17, 310)
      context.lineTo(-27, 100)
      context.closePath()
      context.fill()
    }
    context.restore()
  }
  context.fillStyle = '#e0b6c7'
  context.font = '900 59px Arial, sans-serif'
  context.fillText(variant === 0 ? 'AFTER HOURS' : 'NIGHT CULTURE', 49, 963, 665)
  context.font = '18px monospace'
  context.fillText('LUMI / INDEPENDENT EXPRESSION / 001', 49, 39, 665)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function Poster({ position, width, height, variant = 0 }: { position: Position; width: number; height: number; variant?: number }) {
  const texture = useMemo(() => makePosterTexture(variant), [variant])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group name="black-pink-poster" position={position}>
      <Block size={[width, height, 0.055]} color="#111214" radius={0.008} />
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[width - 0.055, height - 0.055]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
    </group>
  )
}

function makeRugTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 768
  const context = canvas.getContext('2d')!
  context.fillStyle = '#48484a'
  context.fillRect(0, 0, 1024, 768)
  let seed = 31
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  for (let i = 0; i < 26000; i += 1) {
    const value = 45 + Math.floor(random() * 65)
    context.fillStyle = `rgb(${value}, ${value}, ${value + 2})`
    context.fillRect(random() * 1024, random() * 768, 1 + random() * 3, 1 + random() * 5)
  }
  context.strokeStyle = '#79797a'
  context.lineWidth = 13
  context.strokeRect(30, 30, 964, 708)
  context.strokeStyle = '#252628'
  context.lineWidth = 28
  context.strokeRect(55, 55, 914, 658)
  context.strokeStyle = '#777675'
  context.lineWidth = 2
  for (let i = 0; i < 5; i += 1) context.strokeRect(92 + i * 11, 87 + i * 11, 840 - i * 22, 594 - i * 22)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function Rug() {
  const texture = useMemo(makeRugTexture, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group name="bedroom-rug">
      <Block position={[1.3, 0.025, 1]} size={[4.2, 0.035, 2.8]} color="#333436" radius={0.015} />
      <mesh position={[1.3, 0.044, 1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.17, 2.77]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
    </group>
  )
}

export function Decorations({ lampOn, mood = 'evening' }: { lampOn: boolean; mood?: Mood }) {
  return (
    <group name="bedroom-decorations">
      <Rug />
      <Poster position={[-2.12, 2.2, -2.954]} width={0.66} height={0.86} />
      <Poster position={[0.75, 2.25, -2.954]} width={1.15} height={0.83} variant={1} />
      <Poster position={[1.77, 2.14, -2.954]} width={0.57} height={0.88} />
      <Poster position={[1.82, 2.84, -2.954]} width={0.36} height={0.38} variant={1} />
      <Block position={[-2.12, 1.727, -2.84]} size={[0.9, 0.045, 0.25]} color="#161719" radius={0.012} />
      <Plant position={[3.46, 0.055, -1.25]} scale={0.66} potColor="#252729" />
      <Plant position={[3.83, 0.86, -1.05]} scale={0.33} potColor="#222426" />
      <group name="warm-floor-lamp" position={[3.4, 0, -0.25]}>
        <Cylinder position={[0, 0.045, 0]} radius={0.205} height={0.06} color="#242427" segments={24} />
        <Cylinder position={[0, 0.81, 0]} radius={0.018} height={1.55} color="#7b7060" segments={12} />
        <mesh position={[0, 1.72, 0]} castShadow>
          <cylinderGeometry args={[0.19, 0.265, 0.36, 28, 1, true]} />
          <meshStandardMaterial color="#ead8b7" roughness={0.88} emissive="#ffd392" emissiveIntensity={lampOn ? 0.48 : 0} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 1.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.247, 28]} />
          <meshStandardMaterial color="#f8e6c7" emissive="#ffc780" emissiveIntensity={lampOn ? 1.4 : 0} side={DoubleSide} />
        </mesh>
        {lampOn && <pointLight position={[0, 1.55, 0]} color="#ffca85" intensity={mood === 'evening' ? 5 : 2.8} distance={4.5} decay={2} />}
      </group>
    </group>
  )
}

/** Canvas artwork and rug are deliberate overlays; all lamps/plants are Blender assets. */
export function RoomDecorativeOverlays() {
  return <group name="canvas-art-and-rug">
    <Rug />
    <Poster position={[-2.12, 2.2, -2.954]} width={0.66} height={0.86} />
    <Poster position={[0.75, 2.25, -2.954]} width={1.15} height={0.83} variant={1} />
    <Poster position={[1.77, 2.14, -2.954]} width={0.57} height={0.88} />
    <Poster position={[1.82, 2.84, -2.954]} width={0.36} height={0.38} variant={1} />
    <Block position={[-2.12, 1.727, -2.84]} size={[0.9, 0.045, 0.25]} color="#161719" radius={0.012} />
  </group>
}
