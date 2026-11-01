import { AnimationClip, Bone, Object3D, PropertyBinding, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three'
import type { KeyframeTrack } from 'three'

export const gestureActions = ['Nod', 'ShakeHead'] as const
export type GestureAction = typeof gestureActions[number]

/** Small, one-shot gestures on the approved Head axes; no rest-pose or mesh edits. */
export function createGestureClips(instance: Object3D) {
  const bones: Bone[] = []
  let axes: Record<string, { primary: number[]; yaw: number[] }> | undefined
  instance.traverse(object => {
    if (object instanceof Bone) bones.push(object)
    if (typeof object.userData.lumi_animation_axes === 'string') axes = JSON.parse(object.userData.lumi_animation_axes)
  })
  const headAxes = axes?.Head
  if (!headAxes || !bones.some(bone => bone.name === PropertyBinding.sanitizeNodeName('Head'))) throw new Error('Head gesture axes unavailable')
  const duration = 1.8, times = Array.from({ length: 49 }, (_, i) => i * duration / 48)
  return gestureActions.map(name => {
    const axis = new Vector3().fromArray(name === 'Nod' ? headAxes.primary : headAxes.yaw).normalize()
    const tracks: KeyframeTrack[] = bones.map(bone => new QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, times.flatMap(time => {
      const q = bone.quaternion.clone(), t = time / duration
      if (bone.name === 'Head') {
        const degrees = name === 'Nod' ? 6 * Math.sin(2 * Math.PI * t) ** 2 : 8 * Math.sin(4 * Math.PI * t) * Math.sin(Math.PI * t) ** 2
        q.multiply(new Quaternion().setFromAxisAngle(axis, degrees * Math.PI / 180))
      }
      return q.toArray()
    })))
    const spine = bones.find(bone => bone.name === 'Spine')
    if (spine) tracks.push(new VectorKeyframeTrack(`${spine.uuid}.scale`, times, times.flatMap(() => spine.scale.toArray())))
    return new AnimationClip(name, duration, tracks)
  })
}
