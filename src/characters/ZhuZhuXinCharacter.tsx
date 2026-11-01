import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { ThreeElements } from '@react-three/fiber'
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Mesh, Vector3 } from 'three'
import type { AnimationAction } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { characterPlacement, createCharacterClips } from './characterAnimations'
import type { CharacterActionCommand, CharacterActionName } from './characterAnimations'
import { createFootGrounding, safeWalkPoint, walkSpeed, walkStops } from './characterWalk'
import type { WalkStop } from './characterWalk'
import { useCharacterExpression } from './useCharacterExpression'
export interface CharacterPlayback { action:CharacterActionName;phase:'playing'|'ready';bones:number;moving?:boolean;dock?:WalkStop }
export type ZhuZhuXinCharacterProps = Omit<ThreeElements['group'],'children'|'scale'> & {height?:number;command?:CharacterActionCommand;onPlayback?:(s:CharacterPlayback)=>void;motionRoot?:RefObject<Group|null>}
const defaultCommand:CharacterActionCommand={action:'Idle',sequence:0}
export function ZhuZhuXinCharacter({height=.8,command=defaultCommand,onPlayback,motionRoot,...props}:ZhuZhuXinCharacterProps){
  const {scene}=useGLTF('/models/shuibuxin-walk.glb')
  const setup=useMemo(()=>{
    const instance=clone(scene);instance.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true}});instance.updateMatrixWorld(true)
    const bounds=new Box3().setFromObject(instance),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3()),ground=createFootGrounding(instance)
    if(!Number.isFinite(size.y)||size.y<=0)throw new Error('Invalid character bounds')
    const mixer=new AnimationMixer(instance),clips=createCharacterClips(instance),actions=Object.fromEntries(clips.map(c=>[c.name,mixer.clipAction(c)])) as Record<CharacterActionName,AnimationAction>
    return{instance,mixer,actions,ground,sourceHeight:size.y,offset:new Vector3(-center.x,-bounds.min.y,-center.z)}
  },[scene])
  useCharacterExpression(setup.instance)
  const lift=useRef<Group>(null),current=useRef<AnimationAction|null>(null),latest=useRef(onPlayback),movement=useRef<{destination:WalkStop;turning:boolean}|null>(null),dock=useRef<WalkStop>('Bed'),playRef=useRef<(name:CharacterActionName)=>void>(()=>{})
  latest.current=onPlayback
  useEffect(()=>{
    const play=(name:CharacterActionName)=>{
      const next=setup.actions[name],previous=current.current
      for(const a of Object.values(setup.actions))if(a!==previous)a.stop()
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).setLoop(name==='Wave'?LoopOnce:LoopRepeat,name==='Wave'?1:Infinity);next.clampWhenFinished=name==='Wave';next.play()
      if(previous&&previous!==next)next.crossFadeFrom(previous,.28,false)
      current.current=next;latest.current?.({action:name,phase:'playing',bones:12,moving:movement.current!==null,dock:dock.current})
    }
    playRef.current=play
    const finished=(e:{action:AnimationAction})=>{if(e.action===setup.actions.Wave&&current.current===e.action)play('Idle')}
    setup.mixer.addEventListener('finished',finished)
    return()=>{setup.mixer.removeEventListener('finished',finished);setup.mixer.stopAllAction();current.current=null}
  },[setup])
  useEffect(()=>{
    if(movement.current)return
    if(command.destination&&motionRoot?.current){
      if(command.destination===dock.current)return
      movement.current={destination:command.destination,turning:true};playRef.current('Idle')
    }else playRef.current(command.action)
  },[command.action,command.sequence,command.destination,motionRoot])
  useFrame((_,delta)=>{
    const dt=Math.min(delta,.1),root=motionRoot?.current,move=movement.current
    if(root&&move){
      const goal=walkStops[move.destination],dx=goal[0]-root.position.x,dz=goal[2]-root.position.z,distance=Math.hypot(dx,dz)
      if(distance>.00001){
        const heading=Math.atan2(dx,dz)-characterPlacement.yaw,angle=Math.atan2(Math.sin(heading-root.rotation.y),Math.cos(heading-root.rotation.y));root.rotation.y+=angle*(1-Math.exp(-dt*8))
        if(move.turning&&Math.abs(angle)<.06){move.turning=false;playRef.current('Walk')}
        if(!move.turning){const step=Math.min(distance,walkSpeed*dt),x=root.position.x+dx/distance*step,z=root.position.z+dz/distance*step
          if(!safeWalkPoint(x,z))throw new Error('Walk left the validated corridor')
          root.position.x=x;root.position.z=z}
      }
      if(distance<=walkSpeed*dt&&!move.turning){root.position.set(goal[0],goal[1],goal[2]);dock.current=move.destination;movement.current=null;playRef.current('Idle')}
    }
    setup.mixer.update(dt)
    if(lift.current)lift.current.position.y=setup.ground.lift()*height/setup.sourceHeight
  })
  return <group {...props} name="ZhuZhuXinCharacter"><group ref={lift}><group scale={height/setup.sourceHeight}><group position={setup.offset}><primitive object={setup.instance} dispose={null}/></group></group></group></group>
}
