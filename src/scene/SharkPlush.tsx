import { useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Group, Mesh } from 'three'
import { approach, roomInteractions } from '../interactions/roomInteractions.ts'
import type { Position } from './palette'

export interface SharkPlushProps {
  position?: Position
  rotation?: Position
  scale?: number
}

const SHARK_MODEL_URL = '/models/shark.glb'

/** Blender-authored plush: glTF Y-up, metre units, nose along local +X. */
export function SharkPlush({ position, rotation, scale = 1 }: SharkPlushProps) {
  const motion=useRef<Group>(null)
  const state=useSyncExternalStore(roomInteractions.subscribe,roomInteractions.getSnapshot,roomInteractions.getSnapshot)
  useFrame((_,delta)=>{
    if(!motion.current)return
    const target=state.sharkRaised?.28:0
    motion.current.position.y=approach(motion.current.position.y,target,delta)
    motion.current.rotation.z=approach(motion.current.rotation.z,state.sharkRaised?.035:0,delta)
    if(motion.current.position.y===target&&motion.current.rotation.z===(state.sharkRaised?.035:0))roomInteractions.finishShark(state.sharkRaised)
  })
  const { scene } = useGLTF(SHARK_MODEL_URL)
  const model = useMemo(() => {
    // Own the object hierarchy while retaining the loader's cached geometry/materials.
    const instance = scene.clone(true)
    instance.traverse(object => {
      if (object instanceof Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    return instance
  }, [scene])

  return (
    <group name="shark-plush" position={position} rotation={rotation} scale={scale} dispose={null}>
      <group ref={motion} name="SharkInteractionOffset"><primitive object={model} /></group>
    </group>
  )
}

useGLTF.preload(SHARK_MODEL_URL)
