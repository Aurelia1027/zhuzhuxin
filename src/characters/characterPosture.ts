import { AnimationClip, Bone, Object3D, PropertyBinding, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three'

export const postureActions = ['SitDown', 'Seated', 'StandUp', 'OpenArms'] as const
export const openArmsSettings = { liftDegrees: 30, forwardDegrees: 8, holdSeconds: 2, rampSeconds: 1.1 } as const
export type PostureAction = typeof postureActions[number]
export type Posture = 'standing' | 'sitting' | 'seated' | 'standing-up'
export const bedSeat = {
  approach: [-.74, .005, .85] as [number, number, number],
  anchor: [.08, .49, .85] as [number, number, number],
  yaw: -Math.PI / 2,
  legDegrees: 35,
  transitionSeconds: 2.2,
}
export function smoothProgress(time: number, duration: number) {
  const t = Math.max(0, Math.min(time / duration, 1))
  return t * t * (3 - 2 * t)
}
/** Absolute anchors: repeated cycles cannot accumulate translation. */
export function seatPosition(posture: Exclude<Posture, 'standing'>, time: number): [number, number, number] {
  const t = smoothProgress(time, bedSeat.transitionSeconds)
  const amount = posture === 'seated' ? 1 : posture === 'standing-up' ? 1 - t : t
  if (amount === 0) return [...bedSeat.approach]
  if (amount === 1) return [...bedSeat.anchor]
  const point = bedSeat.approach.map((v, i) => v + (bedSeat.anchor[i] - v) * amount) as [number, number, number]
  // A small plush-doll hop settles onto the low bed; never pulls the mesh by scaling.
  point[1] += posture === 'seated' ? 0 : .06 * Math.sin(Math.PI * amount)
  return point
}
export function safeSeatApproach(x: number, z: number) { return x >= -1.151 && x <= -.739 && Math.abs(z - .85) < .001 }

type Axes = Record<string, { primary: number[]; yaw: number[] }>
export function createPostureClips(instance: Object3D, openArmsHoldSeconds: number = openArmsSettings.holdSeconds) {
  if (!Number.isFinite(openArmsHoldSeconds) || openArmsHoldSeconds < .2 || openArmsHoldSeconds > 10) throw new Error('Invalid open-arms hold duration')
  const bones: Bone[] = []; let axes: Axes | undefined
  instance.traverse(object => {
    if (object instanceof Bone) bones.push(object)
    if (typeof object.userData.lumi_animation_axes === 'string') axes = JSON.parse(object.userData.lumi_animation_axes)
  })
  if (!axes || bones.length !== 12 || !axes['Leg.L'] || !axes['Leg.R']) throw new Error('Posture requires approved 12-bone rig')
  const metadata = axes
  return postureActions.map(name => {
    const duration = name === 'Seated' ? 1 : name === 'OpenArms' ? 2.2 + openArmsHoldSeconds : bedSeat.transitionSeconds
    const times = name === 'OpenArms' ? [0, .275, .55, .825, 1.1, 1.1 + openArmsHoldSeconds, 1.375 + openArmsHoldSeconds, 1.65 + openArmsHoldSeconds, 1.925 + openArmsHoldSeconds, duration] : Array.from({ length: 49 }, (_, i) => i * duration / 48)
    const tracks = bones.map(bone => {
      const logical = Object.keys(metadata).find(key => PropertyBinding.sanitizeNodeName(key) === bone.name)
      const values = times.flatMap(time => {
        const q = bone.quaternion.clone()
        if (logical && metadata[logical]) {
          let primary = 0, yaw = 0
          if (name === 'OpenArms') {
            const envelope = time < 1.1 ? smoothProgress(time, 1.1) : time <= 1.1 + openArmsHoldSeconds ? 1 : 1 - smoothProgress(time - 1.1 - openArmsHoldSeconds, 1.1)
            if (logical === 'Arm.L' || logical === 'Arm.R') { primary = openArmsSettings.liftDegrees * envelope; yaw = (logical === 'Arm.L' ? -1 : 1) * openArmsSettings.forwardDegrees * envelope }
          } else if (logical === 'Leg.L' || logical === 'Leg.R') {
            const t = smoothProgress(time, duration)
            primary = bedSeat.legDegrees * (name === 'Seated' ? 1 : name === 'StandUp' ? 1 - t : t)
          }
          for (const [degrees, axis] of [[primary, metadata[logical].primary], [yaw, metadata[logical].yaw]] as [number, number[]][]) q.multiply(new Quaternion().setFromAxisAngle(new Vector3().fromArray(axis).normalize(), degrees * Math.PI / 180))
        }
        return q.toArray()
      })
      return new QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, values)
    })
    const spine = bones.find(bone => bone.name === 'Spine')!
    return new AnimationClip(name, duration, [...tracks, new VectorKeyframeTrack(`${spine.uuid}.scale`, times, times.flatMap(() => spine.scale.toArray()))])
  })
}
