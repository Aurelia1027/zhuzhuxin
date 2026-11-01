import { AnimationClip, Bone, Object3D, PropertyBinding, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three'
import { bedSeat, smoothProgress } from './characterPosture.ts'

export const activityActions = ['Jump', 'Dance', 'SleepDown', 'Sleep', 'WakeUp'] as const
export type ActivityAction = typeof activityActions[number]
export const activityDurations = { Jump: 1.2, Dance: 3.2, SleepDown: 1.4, Sleep: 4.8, WakeUp: 1.4 } as const
type Axes = Record<string, { primary: number[]; sway: number[]; yaw: number[] }>

/** Small toy movements on the existing rig. Sleep is seated dozing, not a lying pose. */
export function createActivityClips(instance: Object3D) {
  const bones: Bone[] = []; let axes: Axes | undefined
  instance.traverse(object => {
    if (object instanceof Bone) bones.push(object)
    if (typeof object.userData.lumi_animation_axes === 'string') axes = JSON.parse(object.userData.lumi_animation_axes)
  })
  if (!axes?.Head || !axes['Leg.L'] || !axes['Leg.R']) throw new Error('Activity requires the approved cartoon rig')
  const metadata = axes
  return activityActions.map(name => {
    const duration = activityDurations[name], times = Array.from({ length: 65 }, (_, i) => i * duration / 64)
    const tracks = bones.map(bone => {
      const logical = Object.keys(metadata).find(key => PropertyBinding.sanitizeNodeName(key) === bone.name)
      return new QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, times.flatMap(time => {
        const t = time / duration, phase = 2 * Math.PI * t, q = bone.quaternion.clone()
        let primary = 0, sway = 0, yaw = 0
        if (name === 'Jump') {
          if (logical?.startsWith('Arm.')) primary = 12 * Math.sin(Math.PI * t) ** 2
          if (logical === 'Spine') primary = 1.5 * Math.sin(phase)
        } else if (name === 'Dance') {
          if (logical?.startsWith('Arm.')) { primary = 18 + 8 * Math.cos(phase + (logical === 'Arm.L' ? 0 : Math.PI)); yaw = (logical === 'Arm.L' ? -1 : 1) * 3 * Math.sin(phase) }
          if (logical === 'Leg.L') primary = 6 * Math.sin(phase)
          if (logical === 'Leg.R') primary = -6 * Math.sin(phase)
          if (logical === 'Spine') { primary = .5 * Math.sin(2 * phase); sway = 1.2 * Math.sin(phase) }
          if (logical === 'Head') { primary = Math.sin(2 * phase); sway = 1.2 * Math.sin(phase); yaw = .8 * Math.sin(phase) }
        } else {
          const amount = name === 'SleepDown' ? smoothProgress(time, duration) : name === 'WakeUp' ? 1 - smoothProgress(time, duration) : 1
          if (logical?.startsWith('Leg.')) primary = bedSeat.legDegrees
          if (logical === 'Head') primary = 6 * amount + (name === 'Sleep' ? .3 * Math.sin(phase) : 0)
          if (logical === 'Spine') primary = 2 * amount
        }
        if (logical && metadata[logical]) for (const [degrees, axis] of [[primary, metadata[logical].primary], [sway, metadata[logical].sway], [yaw, metadata[logical].yaw]] as [number, number[]][]) q.multiply(new Quaternion().setFromAxisAngle(new Vector3().fromArray(axis).normalize(), degrees * Math.PI / 180))
        return q.toArray()
      }))
    })
    const spine = bones.find(bone => bone.name === 'Spine')!
    return new AnimationClip(name, duration, [...tracks, new VectorKeyframeTrack(`${spine.uuid}.scale`, times, times.flatMap(time => [spine.scale.x, spine.scale.y * (name === 'Sleep' ? 1 + .0009 * Math.sin(time / duration * 2 * Math.PI) : 1), spine.scale.z]))])
  })
}
/** Visual displacement in scene units. The existing source-unit foot correction is separate. */
export function activityLift(name: string, time: number, height: number) {
  if (name === 'Jump') {
    const t = (time - .2) / .65
    return t > 0 && t < 1 ? height * .12 * 4 * t * (1 - t) : 0
  }
  if (name === 'Dance') return height * .006 * (1 - Math.cos(time / activityDurations.Dance * 8 * Math.PI))
  return 0
}
