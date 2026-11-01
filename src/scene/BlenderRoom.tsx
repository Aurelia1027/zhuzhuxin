import { useEffect, useMemo, useRef, useState } from 'react'
import { Html, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Mesh, MeshStandardMaterial } from 'three'
import type { PointLight } from 'three'
import { approach, roomInteractions } from '../interactions/roomInteractions.ts'
import { classifyDeskHit } from '../interactions/assetHit.ts'
import type { Mood, ViewMode } from './palette'

const ROOM_URL = '/models/cozy-room.glb'
export type RoomAssetName = 'RoomShell' | 'Door' | 'Bed' | 'ShoeCabinet' | 'Bookshelf' | 'GamingDesk' | 'Window' | 'Lamps' | 'Plants'

interface RoomAssetProps {
  name: RoomAssetName
  localOrigin?: boolean
  view?: ViewMode
  lampOn?: boolean
  onToggleLamp?: () => void
}

/** Named Blender groups retain local furniture origins; cached GPU resources are shared. */
export function RoomAsset({ name, localOrigin = false, view = 'overview', lampOn = true, onToggleLamp }: RoomAssetProps) {
  const [lampHover,setLampHover]=useState(false)
  const { scene } = useGLTF(ROOM_URL)
  const { instance, lampMaterials, cutaway, ceilingFixture } = useMemo(() => {
    const source = scene.getObjectByName(name)
    if (!source) throw new Error(`cozy-room.glb is missing required furniture node: ${name}`)
    const instance = source.clone(true)
    if (localOrigin) instance.position.set(0, 0, 0)
    const materials = new Map<MeshStandardMaterial, { material: MeshStandardMaterial; intensity: number }>()
    instance.traverse(object => {
      if (!(object instanceof Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      const cloneLampMaterial = (material: MeshStandardMaterial) => {
        if (!(material instanceof MeshStandardMaterial) || !/(?:^|_)Lamp(?:Glow|Shade)$/.test(material.name)) return material
        if (!materials.has(material)) materials.set(material, { material: material.clone(), intensity: material.emissiveIntensity })
        return materials.get(material)!.material
      }
      object.material = Array.isArray(object.material)
        ? object.material.map(material => cloneLampMaterial(material as MeshStandardMaterial))
        : cloneLampMaterial(object.material as MeshStandardMaterial)
    })
    return {
      instance,
      lampMaterials: [...materials.values()],
      cutaway: ['North', 'South', 'West', 'East', 'Ceiling'].map(side => instance.getObjectByName(`Cutaway_${side}`)),
      ceilingFixture: instance.getObjectByName('CeilingFixture'),
    }
  }, [scene, name, localOrigin])

  useEffect(() => () => { for (const entry of lampMaterials) entry.material.dispose() }, [lampMaterials])

  useFrame(({ camera },delta) => {
    for(const entry of lampMaterials)entry.material.emissiveIntensity=approach(entry.material.emissiveIntensity,lampOn?entry.intensity:0,delta)
    // Real, thick Blender walls use a runtime cutaway only for the overview camera.
    const show = view === 'inside'
      ? [true, true, true, true, true]
      : [camera.position.z > -3, camera.position.z < 3, camera.position.x > -4, camera.position.x < 4, camera.position.y < 3.25]
    cutaway.forEach((object, index) => { if (object) object.visible = show[index] })
    if (ceilingFixture) ceilingFixture.visible = view === 'inside'
  })

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onToggleLamp || event.delta > 4) return
    const hit=classifyDeskHit(event.object,instance)
    if(hit==='lamp'){event.stopPropagation();onToggleLamp()}
    if(hit==='chair'){event.stopPropagation();roomInteractions.notice('电竞椅暂未开放坐姿；点击桌面可以走到书桌旁。')}
  }

  return <group><primitive object={instance} dispose={null} onClick={handleClick}
    onPointerOver={(event:ThreeEvent<PointerEvent>)=>{if(onToggleLamp&&classifyDeskHit(event.object,instance)==='lamp'){event.stopPropagation();setLampHover(true)}}}
    onPointerOut={()=>setLampHover(false)}/>
    {lampHover&&<Html position={[.6,1.9,-.15]} center style={{pointerEvents:'none'}}><div className="object-tooltip" role="tooltip">桌面台灯<small>点击：单独开关桌灯</small></div></Html>}
  </group>
}

/** Runtime lights remain dynamic; no preview lights are embedded in the room GLB. */
export function RoomFixtureLights({ lampOn, deskLampOn, mood }: { lampOn: boolean; deskLampOn:boolean; mood: Mood }) {
  const desk=useRef<PointLight>(null)
  useFrame((_,delta)=>{
    if(!desk.current)return
    const target=deskLampOn?2.4:0
    desk.current.intensity=approach(desk.current.intensity,target,delta)
    if(desk.current.intensity===target)roomInteractions.finishLamp(deskLampOn)
  })
  return <>
    <pointLight position={[.29, 1.09, -2.5]} color="#5bbaff" intensity={.55} distance={1.65} decay={2} />
    <pointLight ref={desk} position={[1.64, 1.48, -2.55]} color="#ffcf8f" intensity={2.4} distance={3} decay={2} />
    {lampOn && <>
      <pointLight position={[3.4, 1.55, -.25]} color="#ffca85" intensity={mood === 'evening' ? 5 : 2.8} distance={4.5} decay={2} />
    </>}
  </>
}

useGLTF.preload(ROOM_URL)
