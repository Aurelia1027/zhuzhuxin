import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Object3D, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import type { InstancedMesh } from 'three'
import { Block, Cylinder } from './Primitives'
import type { Position } from './palette'

function Rod({ from, to, radius = 0.015, color = '#3c3e42' }: { from: Position; to: Position; radius?: number; color?: string }) {
  const transform = useMemo(() => {
    const start = new Vector3(...from)
    const end = new Vector3(...to)
    const direction = end.clone().sub(start)
    return {
      position: start.add(end).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()),
      height: direction.length(),
    }
  }, [from, to])
  return <mesh position={transform.position} quaternion={transform.quaternion} castShadow>
    <cylinderGeometry args={[radius, radius, transform.height, 10]} />
    <meshStandardMaterial color={color} metalness={0.6} roughness={0.36} />
  </mesh>
}

function useMonitorTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 600
    const ctx = canvas.getContext('2d')!
    const backdrop = ctx.createLinearGradient(0, 0, 1024, 600)
    backdrop.addColorStop(0, '#07101a')
    backdrop.addColorStop(0.55, '#111018')
    backdrop.addColorStop(1, '#03050b')
    ctx.fillStyle = backdrop
    ctx.fillRect(0, 0, 1024, 600)
    ctx.save()
    ctx.translate(520, 285)
    for (let i = 0; i < 42; i++) {
      const angle = i * 0.15
      const reach = 90 + (i % 7) * 18
      ctx.strokeStyle = i % 3 === 0 ? '#ac7c94' : '#626d82'
      ctx.globalAlpha = 0.25 + (i % 5) * 0.12
      ctx.lineWidth = i % 4 === 0 ? 2 : 1
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * 38, Math.sin(angle) * 22)
      ctx.lineTo(Math.cos(angle + 0.2) * reach * 1.4, Math.sin(angle + 0.2) * reach * 0.75)
      ctx.lineTo(Math.cos(angle + 0.6) * 58, Math.sin(angle + 0.6) * 37)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#ddd9df'
    ctx.lineWidth = 1
    ctx.strokeRect(-78, -39, 156, 78)
    ctx.fillStyle = '#e1dce3'
    ctx.font = 'bold 24px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('NOCTURNE', 0, 8)
    ctx.restore()
    ctx.fillStyle = '#8e9bad'
    ctx.font = '14px monospace'
    ctx.fillText('LUMI / PERSONAL SPACE', 34, 43)
    ctx.fillStyle = '#8097b4'
    ctx.fillRect(28, 560, 968, 1)
    ctx.font = '11px monospace'
    ctx.fillText('SYSTEM 001     ● ONLINE', 34, 582)
    const result = new CanvasTexture(canvas)
    result.colorSpace = SRGBColorSpace
    result.anisotropy = 4
    return result
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function Keyboard() {
  const keys = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const item = new Object3D()
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 14; column++) {
        item.position.set(-0.274 + column * 0.042, 0.022, -0.065 + row * 0.039)
        item.updateMatrix()
        keys.current?.setMatrixAt(row * 14 + column, item.matrix)
      }
    }
    if (keys.current) keys.current.instanceMatrix.needsUpdate = true
  }, [])
  return <group position={[0.18, 0.844, 0.205]}>
    <Block size={[0.65, 0.025, 0.21]} color="#13151a" radius={0.012} />
    <mesh position={[0, 0.002, 0]}><boxGeometry args={[0.646, 0.007, 0.204]} /><meshStandardMaterial color="#5082a3" emissive="#31536e" emissiveIntensity={0.6} /></mesh>
    <instancedMesh ref={keys} args={[undefined, undefined, 56]} castShadow receiveShadow>
      <boxGeometry args={[0.035, 0.016, 0.03]} />
      <meshStandardMaterial color="#34383e" roughness={0.65} />
    </instancedMesh>
    <Block size={[0.22, 0.016, 0.025]} position={[-0.025, 0.023, 0.084]} color="#42464d" radius={0.004} />
  </group>
}

function GamingChair() {
  return <group name="gaming-chair" position={[-0.13, 0, 1.015]} rotation={[0, -0.12, 0]}>
    <Cylinder position={[0, 0.26, 0]} radius={0.035} height={0.31} color="#85868a" />
    {Array.from({ length: 5 }, (_, i) => {
      const angle = i * Math.PI * 2 / 5
      const x = Math.sin(angle) * 0.32
      const z = Math.cos(angle) * 0.32
      return <group key={i}>
        <Rod from={[0, 0.13, 0]} to={[x, 0.075, z]} radius={0.021} color="#414348" />
        <mesh position={[x, 0.043, z]} rotation={[Math.PI / 2, 0, -angle]} castShadow>
          <cylinderGeometry args={[0.044, 0.044, 0.048, 10]} /><meshStandardMaterial color="#121419" roughness={0.85} />
        </mesh>
      </group>
    })}
    <Block size={[0.55, 0.105, 0.51]} position={[0, 0.47, 0]} color="#181a20" radius={0.065} />
    <Block size={[0.41, 0.025, 0.42]} position={[0, 0.53, 0.005]} color="#303238" radius={0.048} />
    <group position={[0, 0.88, 0.23]} rotation={[0.1, 0, 0]}>
      <Block size={[0.54, 0.69, 0.095]} color="#13151b" radius={0.065} />
      <Block size={[0.38, 0.55, 0.035]} position={[0, -0.01, -0.06]} color="#30333a" radius={0.055} />
      {[-1, 1].map(side => <Block key={side} size={[0.045, 0.54, 0.025]} position={[side * 0.22, 0.025, 0.06]} color="#55575f" radius={0.012} />)}
      <Block size={[0.31, 0.13, 0.07]} position={[0, 0.34, -0.025]} color="#292c34" radius={0.04} />
    </group>
    {[-1, 1].map(side => <group key={side}>
      <Rod from={[side * 0.27, 0.47, 0.13]} to={[side * 0.31, 0.67, 0.12]} radius={0.016} />
      <Block size={[0.075, 0.045, 0.32]} position={[side * 0.31, 0.69, 0.015]} color="#25272d" radius={0.02} />
    </group>)}
  </group>
}

export interface GamingDeskProps {
  lampOn: boolean
  onToggleLamp: () => void
}

/** Desktop .78m high, 2.35m wide. Chair reaches z=1.36; all objects are local. */
export function GamingDesk({ lampOn, onToggleLamp }: GamingDeskProps) {
  const monitorTexture = useMonitorTexture()
  return (
    <group name="gaming-desk">
      <Block size={[2.35, 0.075, 0.85]} position={[0, 0.78, 0]} color="#181a1f" radius={0.026} />
      <Block size={[2.31, 0.012, 0.81]} position={[0, 0.823, 0]} color="#27292e" radius={0.009} />
      {[-1.07, 1.07].flatMap(x => [-0.31, 0.31].map(z => <Block key={`${x}-${z}`} size={[0.055, 0.74, 0.055]} position={[x, 0.37, z]} color="#101217" radius={0.01} />))}
      <Block size={[2.13, 0.045, 0.045]} position={[0, 0.19, -0.31]} color="#1c1f25" radius={0.01} />
      <Block size={[0.44, 0.62, 0.65]} position={[0.82, 0.43, 0]} color="#1b1d23" radius={0.025} />
      {[0.29, 0.56].map(y => <group key={y}>
        <Block size={[0.4, 0.24, 0.018]} position={[0.82, y, 0.335]} color="#292b31" radius={0.008} />
        <Block size={[0.16, 0.015, 0.016]} position={[0.82, y + 0.085, 0.35]} color="#737578" radius={0.004} />
      </group>)}
      <Block size={[0.36, 0.026, 0.21]} position={[0.2, 0.842, -0.08]} color="#3b3d44" radius={0.035} />
      <Block size={[0.06, 0.21, 0.06]} position={[0.2, 0.94, -0.14]} color="#555860" radius={0.012} />
      <group name="monitor" position={[0.2, 1.285, -0.14]} rotation={[-0.025, 0, 0]}>
        <Block size={[1.14, 0.68, 0.055]} color="#101218" radius={0.025} />
        <mesh position={[0, 0.011, 0.03]}>
          <planeGeometry args={[1.085, 0.613]} />
          <meshBasicMaterial map={monitorTexture} toneMapped={false} />
        </mesh>
        <mesh position={[0.49, -0.311, 0.031]}><circleGeometry args={[0.004, 8]} /><meshBasicMaterial color="#9ec0df" toneMapped={false} /></mesh>
      </group>
      <Keyboard />
      <Block size={[0.34, 0.008, 0.3]} position={[0.76, 0.834, 0.19]} color="#1c1f28" radius={0.025} />
      <mesh position={[0.75, 0.863, 0.17]} scale={[0.049, 0.031, 0.073]} castShadow>
        <sphereGeometry args={[1, 16, 10]} /><meshStandardMaterial color="#34383f" roughness={0.65} />
      </mesh>
      <Block size={[0.008, 0.006, 0.028]} position={[0.75, 0.893, 0.148]} color="#7797b2" radius={0.002} />
      {[-.96, -.56].map(x => <Block key={x} size={[.035, .115, .075]} position={[x, .884, -.23]} color="#151820" radius={.006} />)}
      <group name="blue-ring-lights" position={[-0.76, 1.04, -0.23]}>
        <Block size={[0.58, 0.205, 0.07]} color="#0b101a" radius={0.02} />
        {[-0.185, 0, 0.185].map(x => <group key={x} position={[x, 0, 0.044]}>
          <mesh><torusGeometry args={[0.07, 0.009, 8, 28]} /><meshStandardMaterial color="#8bd7ff" emissive="#42aaff" emissiveIntensity={3.2} toneMapped={false} /></mesh>
          <mesh position={[0, 0, -0.005]}><circleGeometry args={[0.056, 24]} /><meshStandardMaterial color="#172636" emissive="#16496c" emissiveIntensity={0.65} /></mesh>
          <mesh position={[0, 0, 0.002]}><circleGeometry args={[0.022, 16]} /><meshStandardMaterial color="#8fc7e6" metalness={0.6} roughness={0.25} /></mesh>
        </group>)}
        <pointLight position={[0, 0.05, 0.13]} color="#5bbaff" intensity={0.55} distance={1.65} decay={2} />
      </group>
      <group name="desk-lamp" onClick={event => { event.stopPropagation(); onToggleLamp() }}>
        <Cylinder position={[0.97, 0.848, -0.28]} radius={0.115} height={0.04} color="#3a3d42" />
        <Rod from={[0.97, 0.87, -0.28]} to={[0.97, 1.38, -0.28]} radius={0.013} color="#66666a" />
        <Rod from={[0.97, 1.38, -0.28]} to={[0.59, 1.65, -0.15]} radius={0.013} color="#66666a" />
        <mesh position={[0.97, 1.38, -0.28]} castShadow><sphereGeometry args={[0.029, 12, 8]} /><meshStandardMaterial color="#5c6067" metalness={0.7} roughness={0.35} /></mesh>
        <mesh position={[0.59, 1.6, -0.15]} castShadow>
          <cylinderGeometry args={[0.036, 0.105, 0.15, 16]} /><meshStandardMaterial color="#c0bdb4" metalness={0.45} roughness={0.4} />
        </mesh>
        <mesh position={[0.59, 1.523, -0.15]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.096, 24]} /><meshStandardMaterial color="#f0dfbc" emissive="#ffd28c" emissiveIntensity={lampOn ? 2.2 : 0} side={2} toneMapped={false} />
        </mesh>
      </group>
      {lampOn && <pointLight position={[.59, 1.48, -.15]} color="#ffcf8f" intensity={2.4} distance={3} decay={2} />}
      <group name="desk-speaker" position={[-0.88, 0.94, 0.09]}>
        <Block size={[0.14, 0.22, 0.13]} color="#13161d" radius={0.012} />
        <mesh position={[0, -0.02, 0.068]}><circleGeometry args={[0.042, 20]} /><meshStandardMaterial color="#424752" roughness={0.75} /></mesh>
        <mesh position={[0, 0.065, 0.069]}><circleGeometry args={[0.015, 12]} /><meshStandardMaterial color="#85868b" metalness={0.4} roughness={0.5} /></mesh>
      </group>
      <GamingChair />
    </group>
  )
}
