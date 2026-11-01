import { AnimationClip, Bone, Object3D, PropertyBinding, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three'

export const characterActions = ['Idle', 'Wave', 'ListenRap', 'Walk'] as const
export type CharacterActionName = typeof characterActions[number]
export interface CharacterActionCommand { action: CharacterActionName; sequence: number; destination?: 'Desk' | 'Bed' }
export const characterPlacement = { position: [-1.15, .005, .85] as [number, number, number], height: 1.45, yaw: -.64 }
type AxisData = Record<string, {primary: number[]; sway: number[]; yaw: number[]}>

/** Compile once per cloned rig. Every clip owns the same quaternion channels. */
export function createCharacterClips(instance: Object3D) {
  let axes: AxisData | undefined
  const bones: Bone[] = []
  instance.traverse(object => {
    if (object instanceof Bone) bones.push(object)
    if (typeof object.userData.lumi_animation_axes === 'string') axes = JSON.parse(object.userData.lumi_animation_axes) as AxisData
  })
  if (!axes || bones.length !== 12 || !axes['Leg.L'] || !axes['Leg.R']) throw new Error('Character requires the approved 12-bone walk rig')
  const metadata = axes
  const logicalName = (bone: Bone) => Object.keys(metadata).find(name => PropertyBinding.sanitizeNodeName(name) === bone.name) ?? bone.name
  const durations = { Idle: 4.8, Wave: 4, ListenRap: 2.4, Walk: .8 }
  const waveTimes = [0,.5,.9,1.2,1.5,1.8,2.1,2.4,2.7,3.1,3.55,4]
  const waveAngles = [0,24,38,42,34,38,42,34,38,26,8,0]
  return characterActions.map(action => {
    const duration = durations[action]
    const times = action === 'Wave' ? waveTimes : Array.from({length:49},(_,i)=>i*duration/48)
    const tracks = bones.map(bone => {
      const name = logicalName(bone), axis = metadata[name], values: number[] = []
      for (let i=0;i<times.length;i++) {
        const phase = times[i]/duration*Math.PI*2, q = bone.quaternion.clone()
        let primary=0,sway=0,yaw=0
        if (action === 'Idle') {
          if(name==='Head'){sway=.65*Math.sin(phase);yaw=.6*Math.sin(phase)}
          if(name==='Spine')sway=.15*Math.sin(phase)
        } else if(action==='Wave') {
          if(name==='Arm.R')primary=waveAngles[i]
          if(name==='Head')sway=.5*Math.sin(phase)
        } else if(action==='Walk') {
          if(name==='Leg.L')primary=10*2/Math.PI*Math.asin(Math.sin(phase))
          if(name==='Leg.R')primary=-10*2/Math.PI*Math.asin(Math.sin(phase))
          if(name==='Head')sway=.5*Math.sin(phase)
          if(name==='Spine')sway=.15*Math.sin(2*phase)
        } else {
          // Original fixed rhythm: four quiet nods in 2.4 seconds, no audio dependency.
          if(name==='Head')primary=1.4*Math.sin(4*phase)
          if(name==='Spine'){primary=.22*Math.sin(4*phase);sway=.3*Math.sin(2*phase)}
          if(name.startsWith('Shoulder.'))primary=.2*Math.sin(4*phase)
        }
        if(axis)for(const [degrees,vector] of [[primary,axis.primary],[sway,axis.sway],[yaw,axis.yaw]] as [number,number[]][]) {
          q.multiply(new Quaternion().setFromAxisAngle(new Vector3().fromArray(vector).normalize(),degrees*Math.PI/180))
        }
        values.push(...q.toArray())
      }
      // UUID avoids glTF's sanitized dot names and ambiguous node matching.
      return new QuaternionKeyframeTrack(`${bone.uuid}.quaternion`,times,values)
    })
    const spine = bones.find(b=>b.name==='Spine')!
    const scales = times.flatMap(t=>{
      const breath = action==='Idle' ? .0012*Math.sin(t/duration*Math.PI*2) : 0
      return [spine.scale.x,spine.scale.y*(1+breath),spine.scale.z]
    })
    return new AnimationClip(action,duration,[...tracks,new VectorKeyframeTrack(`${spine.uuid}.scale`,times,scales)])
  })
}
