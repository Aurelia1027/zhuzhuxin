import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeElements } from '@react-three/fiber'
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Mesh, Vector3 } from 'three'
import type { AnimationAction } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { characterPlacement, createCharacterClips } from './characterAnimations'
import type { CharacterActionCommand, CharacterActionName } from './characterAnimations'
import { createFootGrounding, safeWalkPoint, walkSpeed, walkStops } from './characterWalk'
import type { WalkStop } from './characterWalk'
import { bedSeat, createPostureClips, openArmsSettings, safeSeatApproach, seatPosition } from './characterPosture'
import type { Posture } from './characterPosture'
import { PostureState } from './postureState'
import { createGestureClips } from './characterGestures'
import { facingViewerYaw } from './characterRootActions'
import type { RootActionType } from './characterRootActions'
import { activityLift, createActivityClips } from './characterActivities'
import { useCharacterExpression } from './useCharacterExpression'

export interface CharacterPlayback { action: CharacterActionName; phase: 'playing' | 'ready'; bones: number; moving?: boolean; dock?: WalkStop; posture?: Posture; transitioning?: boolean; position?: [number, number, number]; completedRoot?: RootActionType; completedSequence?: number; error?: string; sleeping?: boolean }
export type ZhuZhuXinCharacterProps = Omit<ThreeElements['group'], 'children' | 'scale'> & { height?: number; command?: CharacterActionCommand; onPlayback?: (s: CharacterPlayback) => void; motionRoot?: RefObject<Group | null>; openArmsHoldSeconds?: number }
const defaultCommand: CharacterActionCommand = { action: 'Idle', sequence: 0 }
type Movement = { goal: readonly number[]; destination?: WalkStop; localSeat: boolean; turning: boolean; arrived: () => void }

export function ZhuZhuXinCharacter({ height = .8, command = defaultCommand, onPlayback, motionRoot, openArmsHoldSeconds = openArmsSettings.holdSeconds as number, ...props }: ZhuZhuXinCharacterProps) {
  const { scene } = useGLTF('/models/shuibuxin-walk.glb')
  const camera = useThree(state => state.camera)
  const setup = useMemo(() => {
    const instance = clone(scene)
    instance.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true } }); instance.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(instance), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3()), ground = createFootGrounding(instance)
    if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Invalid character bounds')
    const mixer = new AnimationMixer(instance), clips = [...createCharacterClips(instance), ...createPostureClips(instance, openArmsHoldSeconds), ...createGestureClips(instance), ...createActivityClips(instance)]
    const actions = Object.fromEntries(clips.map(c => [c.name, mixer.clipAction(c)])) as Record<CharacterActionName, AnimationAction>
    return { instance, mixer, actions, ground, sourceHeight: size.y, offset: new Vector3(-center.x, -bounds.min.y, -center.z) }
  }, [scene, openArmsHoldSeconds])
  const [displayAction, setDisplayAction] = useState<CharacterActionName>('Idle')
  useCharacterExpression(setup.instance, displayAction === 'Sleep' || displayAction === 'SleepDown' ? 'blink' : undefined)
  const lift = useRef<Group>(null), current = useRef<AnimationAction | null>(null), latest = useRef(onPlayback)
  const movement = useRef<Movement | null>(null), alignment = useRef<{ yaw: number; done: () => void } | null>(null), dock = useRef<WalkStop>('Bed')
  const posture = useRef(new PostureState()), leavingSeat = useRef(false), afterStand = useRef<CharacterActionCommand | null>(null)
  const sleepStage = useRef<'none' | 'entering' | 'sleeping' | 'waking'>('none'), afterSit = useRef(false), afterWake = useRef<CharacterActionCommand | null>(null), visualLift = useRef(0)
  const playRef = useRef<(name: CharacterActionName) => void>(() => {}), executeRef = useRef<(next: CharacterActionCommand) => void>(() => {}), standRef = useRef<() => void>(() => {})
  latest.current = onPlayback
  const moving = () => !!movement.current || !!alignment.current
  const report = (action: CharacterActionName, completedRoot?: RootActionType, completedSequence?: number, error?: string) => latest.current?.({ action, phase: 'playing', bones: 12, moving: moving(), dock: dock.current, posture: posture.current.posture, sleeping: sleepStage.current !== 'none', transitioning: leavingSeat.current || posture.current.posture === 'sitting' || posture.current.posture === 'standing-up' || sleepStage.current === 'entering' || sleepStage.current === 'waking', position: motionRoot?.current?.position.toArray(), completedRoot, completedSequence, error })

  useEffect(() => {
    const play = (name: CharacterActionName) => {
      const next = setup.actions[name], previous = current.current
      for (const a of Object.values(setup.actions)) if (a !== previous) a.stop()
      const once = name === 'Wave' || name === 'SitDown' || name === 'StandUp' || name === 'OpenArms' || name === 'Nod' || name === 'ShakeHead' || name === 'Jump' || name === 'SleepDown' || name === 'WakeUp'
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity)
      next.clampWhenFinished = once; next.play()
      if (previous && previous !== next) next.crossFadeFrom(previous, .28, false)
      current.current = next; setDisplayAction(name); report(name)
    }
    playRef.current = play
    const finished = (event: { action: AnimationAction }) => {
      if (current.current !== event.action) return
      if (event.action === setup.actions.SitDown) {
        motionRoot?.current?.position.set(...bedSeat.anchor)
        posture.current.seated()
        if (posture.current.posture === 'standing-up') play('StandUp')
        else if (afterSit.current) { afterSit.current = false; sleepStage.current = 'entering'; play('SleepDown') }
        else play('Seated')
      } else if (event.action === setup.actions.StandUp) {
        posture.current.standing(); leavingSeat.current = true
        motionRoot?.current?.position.set(...bedSeat.approach)
        // Exit to the original Bed stop before reusing the unchanged validated Walk corridor.
        movement.current = { goal: walkStops.Bed, localSeat: true, turning: true, arrived: () => {
          leavingSeat.current = false; dock.current = 'Bed'
          const pending = afterStand.current; afterStand.current = null
          play('Idle'); if (pending) executeRef.current(pending)
        } }
        play('Idle')
      } else if (event.action === setup.actions.SleepDown) { sleepStage.current = 'sleeping'; play('Sleep') }
      else if (event.action === setup.actions.WakeUp) {
        sleepStage.current = 'none'; const pending = afterWake.current; afterWake.current = null
        play('Seated'); if (pending) executeRef.current(pending)
      } else if (event.action === setup.actions.Wave || event.action === setup.actions.OpenArms || event.action === setup.actions.Nod || event.action === setup.actions.ShakeHead || event.action === setup.actions.Jump) play('Idle')
    }
    setup.mixer.addEventListener('finished', finished)
    return () => { setup.mixer.removeEventListener('finished', finished); setup.mixer.stopAllAction(); current.current = null }
    // All mutable playback values live in refs; one mixer per cloned model.
  }, [setup])

  const startWalk = (destination: WalkStop, arrived: () => void) => {
    if (destination === dock.current) { arrived(); return }
    movement.current = { goal: walkStops[destination], destination, localSeat: false, turning: true, arrived }
    playRef.current('Idle')
  }
  const sitNearBed = () => {
    if (!motionRoot?.current) { playRef.current('Idle'); return }
    movement.current = { goal: bedSeat.approach, localSeat: true, turning: true, arrived: () => {
      alignment.current = { yaw: bedSeat.yaw - characterPlacement.yaw, done: () => {
        if (posture.current.sit()) playRef.current('SitDown')
      } }
      playRef.current('Idle')
    } }
    playRef.current('Idle')
  }
  standRef.current = () => { if (posture.current.stand()) playRef.current('StandUp') }
  executeRef.current = next => {
    if (sleepStage.current !== 'none') {
      if (next.action === 'Sleep' || next.action === 'SleepDown') { report('Sleep'); return }
      afterWake.current = next.action === 'WakeUp' ? null : next
      if (sleepStage.current !== 'waking') { sleepStage.current = 'waking'; playRef.current('WakeUp') }
      return
    }
    if (next.action === 'WakeUp') { playRef.current(posture.current.posture === 'seated' ? 'Seated' : 'Idle'); return }
    if (next.action === 'Sleep') {
      if (!motionRoot?.current) { report('Idle', undefined, undefined, '睡觉需要房间中的床边锚点。'); return }
      if (posture.current.posture === 'seated') { sleepStage.current = 'entering'; playRef.current('SleepDown') }
      else { afterSit.current = true; startWalk('Bed', sitNearBed) }
      return
    }
    if (posture.current.posture !== 'standing') {
      if (next.action === 'SitDown' || next.action === 'Seated') { report(current.current?.getClip().name as CharacterActionName ?? 'Seated'); return }
      afterStand.current = next.action === 'StandUp' ? null : next
      standRef.current(); return
    }
    if (next.action === 'SitDown') startWalk('Bed', sitNearBed)
    else if (next.action === 'StandUp') playRef.current('Idle')
    else if (next.action === 'TurnAround' || next.action === 'ComeToMe') {
      const root = motionRoot?.current
      if (!root) { report('Idle', undefined, undefined, '当前预览没有可移动的角色根节点。'); return }
      const type = next.action === 'TurnAround' ? 'turn_around' : 'come_to_me'
      const align = () => {
        const viewer = camera.getWorldPosition(new Vector3())
        const yaw = next.action === 'TurnAround' ? root.rotation.y + Math.PI : facingViewerYaw(root.position.x, root.position.z, viewer.x, viewer.z, characterPlacement.yaw, root.rotation.y)
        alignment.current = { yaw, done: () => { playRef.current('Idle'); report('Idle', type, next.sequence) } }
        playRef.current('Idle'); report(next.action)
      }
      if (next.action === 'ComeToMe') startWalk('Bed', align)
      else align()
    }
    else if (next.destination && motionRoot?.current) startWalk(next.destination, () => playRef.current('Idle'))
    else if (next.action === 'OpenArms' && motionRoot?.current) {
      const root = motionRoot.current, viewer = camera.getWorldPosition(new Vector3())
      alignment.current = { yaw: Math.atan2(viewer.x - root.position.x, viewer.z - root.position.z) - characterPlacement.yaw, done: () => playRef.current('OpenArms') }
      playRef.current('Idle')
    }
    else playRef.current(next.action)
  }
  useEffect(() => {
    if (movement.current || alignment.current || leavingSeat.current) return
    executeRef.current(command)
  }, [command.action, command.sequence, command.destination, motionRoot])

  useFrame((_, delta) => {
    const dt = Math.min(delta, .1), root = motionRoot?.current, move = movement.current
    if (root && move) {
      const goal = move.goal, dx = goal[0] - root.position.x, dz = goal[2] - root.position.z, distance = Math.hypot(dx, dz)
      if (distance > .00001) {
        const heading = Math.atan2(dx, dz) - characterPlacement.yaw, angle = Math.atan2(Math.sin(heading - root.rotation.y), Math.cos(heading - root.rotation.y))
        root.rotation.y += angle * (1 - Math.exp(-dt * 8))
        if (move.turning && Math.abs(angle) < .06) { move.turning = false; playRef.current('Walk') }
        if (!move.turning) {
          const step = Math.min(distance, walkSpeed * dt), x = root.position.x + dx / distance * step, z = root.position.z + dz / distance * step
          if (!(move.localSeat ? safeSeatApproach(x, z) : safeWalkPoint(x, z))) throw new Error('Walk left the validated route')
          root.position.x = x; root.position.z = z
        }
      } else move.turning = false
      if (distance <= walkSpeed * dt && !move.turning) {
        root.position.set(goal[0], goal[1], goal[2]); if (move.destination) dock.current = move.destination
        movement.current = null; move.arrived()
      }
    }
    const align = alignment.current
    if (root && align) {
      const angle = Math.atan2(Math.sin(align.yaw - root.rotation.y), Math.cos(align.yaw - root.rotation.y))
      root.rotation.y += angle * (1 - Math.exp(-dt * 8))
      if (Math.abs(angle) < .015) { root.rotation.y = align.yaw; alignment.current = null; align.done() }
    }
    setup.mixer.update(dt)
    const pose = posture.current.posture
    if (root && pose !== 'standing') root.position.set(...seatPosition(pose, current.current?.time ?? 0))
    const liftTarget = pose === 'standing' ? activityLift(current.current?.getClip().name ?? '', current.current?.time ?? 0, height) : 0
    visualLift.current += (liftTarget - visualLift.current) * (1 - Math.exp(-dt * 18))
    if (Math.abs(visualLift.current) < .00001) visualLift.current = 0
    if (lift.current) lift.current.position.y = pose === 'standing' ? setup.ground.lift() * height / setup.sourceHeight + visualLift.current : 0
  })
  return <group {...props} name="ZhuZhuXinCharacter"><group ref={lift}><group scale={height / setup.sourceHeight}><group position={setup.offset}><primitive object={setup.instance} dispose={null} /></group></group></group></group>
}
