import type { Object3D } from 'three'
export function classifyDeskHit(object:Object3D,boundary:Object3D):'lamp'|'chair'|'desk'{
 let current:Object3D|null=object
 while(current&&current!==boundary){
  if(current.name==='DeskLamp')return 'lamp'
  if(current.name==='GamingChair')return 'chair'
  current=current.parent
 }
 return 'desk'
}
