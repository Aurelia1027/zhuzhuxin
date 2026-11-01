import { Box3, Matrix4, PropertyBinding, SkinnedMesh, Vector3 } from 'three'
import type { Object3D } from 'three'
export const walkStops = { Bed: [-1.15,.005,.85], Desk: [-1.15,.005,-1.45] } as const
export const walkSpeed = .21
export type WalkStop = keyof typeof walkStops
export function safeWalkPoint(x:number,z:number) { return Math.abs(x+1.15)<.001 && z>=-1.451 && z<=.851 }
/** Select rigid-foot hull extrema once; evaluate only these against the blended skin. */
export function createFootGrounding(instance:Object3D) {
  instance.updateMatrixWorld(true)
  const bounds=new Box3().setFromObject(instance),height=bounds.max.y-bounds.min.y
  const samples:{mesh:SkinnedMesh;indices:number[]}[]=[],point=new Vector3(),inverse=new Matrix4()
  instance.traverse(object=>{
    if(!(object instanceof SkinnedMesh))return
    const pos=object.geometry.attributes.position,indices=object.geometry.attributes.skinIndex,weights=object.geometry.attributes.skinWeight,picked=new Set<number>()
    for(const side of ['L','R']){
      const joint=object.skeleton.bones.findIndex(b=>b.name===PropertyBinding.sanitizeNodeName(`Leg.${side}`))
      if(joint<0)throw new Error('Missing independent leg skin')
      const candidates:{index:number;y:number;z:number}[]=[]
      for(let i=0;i<pos.count;i++){
        const js=[indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)],ws=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)]
        if(!js.some((j,c)=>j===joint&&ws[c]>.999))continue
        object.getVertexPosition(i,point).applyMatrix4(object.matrixWorld)
        if(point.y<bounds.min.y+height*.045)candidates.push({index:i,y:point.y,z:point.z})
      }
      if(!candidates.length)throw new Error('No rigid foot vertices')
      for(let degrees=-14;degrees<=14;degrees+=.5){const angle=degrees*Math.PI/180;let best=Infinity,bestIndex=0
        for(const c of candidates){const y=c.y*Math.cos(angle)+c.z*Math.sin(angle);if(y<best){best=y;bestIndex=c.index}}picked.add(bestIndex)}
    }
    samples.push({mesh:object,indices:[...picked]})
  })
  if(!samples.length)throw new Error('Walk requires a skinned mesh')
  return {sourceHeight:height,sampleCount:samples.reduce((n,s)=>n+s.indices.length,0),lift(){
    instance.updateWorldMatrix(true,true);inverse.copy(instance.matrixWorld).invert();let lowest=Infinity
    for(const s of samples){s.mesh.skeleton.update();for(const i of s.indices){s.mesh.getVertexPosition(i,point).applyMatrix4(s.mesh.matrixWorld).applyMatrix4(inverse);lowest=Math.min(lowest,point.y)}}
    return bounds.min.y-lowest
  }}
}
