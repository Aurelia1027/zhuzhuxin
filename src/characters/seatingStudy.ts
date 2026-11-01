import { AnimationClip, Bone, Object3D, PropertyBinding, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three'

/** Isolated seating candidate. Never changes rest transforms, skin weights or the GLB. */
export const seatingStudy = {
  approved: false,
  duration: 1.6,
  approach: [-1.15, .005, .85] as const,
  anchor: [.08, .49, .85] as const,
  yaw: -Math.PI / 2,
  angles: [35, 55, 65] as const,
}
export type SeatingStudyAction = 'SitDown' | 'Seated' | 'StandUp'
type Axes = Record<string, { primary: number[] }>
export function createSeatingStudyClips(instance: Object3D, degrees: number) {
  if (!seatingStudy.angles.some(angle => angle === degrees)) throw new Error('Unsupported seating study angle')
  let axes: Axes | undefined
  const bones: Bone[] = []
  instance.traverse(object => {
    if (object instanceof Bone) bones.push(object)
    if (typeof object.userData.lumi_animation_axes === 'string') axes = JSON.parse(object.userData.lumi_animation_axes)
  })
  if (!axes || bones.length !== 12) throw new Error('Seating study requires the approved 12-bone rig')
  const metadata = axes
  const clips = (['SitDown', 'Seated', 'StandUp'] as const).map(name => {
    const duration = name === 'Seated' ? 1 : seatingStudy.duration
    const times = Array.from({ length: 33 }, (_, i) => i * duration / 32)
    const tracks = bones.map(bone => {
      const logical = Object.keys(metadata).find(key => PropertyBinding.sanitizeNodeName(key) === bone.name)
      const values = times.flatMap(time => {
        const t = time / duration, eased = t * t * (3 - 2 * t)
        const amount = name === 'Seated' ? 1 : name === 'StandUp' ? 1 - eased : eased
        const q = bone.quaternion.clone()
        if (logical === 'Leg.L' || logical === 'Leg.R') q.multiply(new Quaternion().setFromAxisAngle(new Vector3().fromArray(metadata[logical].primary).normalize(), amount * degrees * Math.PI / 180))
        return q.toArray()
      })
      return new QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, values)
    })
    const spine = bones.find(bone => bone.name === 'Spine')!
    return new AnimationClip(name, duration, [...tracks, new VectorKeyframeTrack(`${spine.uuid}.scale`, times, times.flatMap(() => spine.scale.toArray()))])
  })
  return clips
}
