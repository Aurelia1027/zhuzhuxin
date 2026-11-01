import { Mesh, MeshStandardMaterial, SRGBColorSpace, TextureLoader } from 'three'
import type { Object3D, Texture } from 'three'
import type { CharacterExpression } from '../types/characterExpression.ts'

export interface ExpressionTextureLoader {load:(url:string,onLoad:(texture:Texture)=>void,onError:()=>void)=>void}
/** Extracted from ExpressionPreview: same approved JPEGs, flipY and material-map swap. */
export function createExpressionBinding(root:Object3D,loader:ExpressionTextureLoader={load:(url,onLoad,onError)=>{new TextureLoader().load(url,onLoad,undefined,onError)}}){
 const originals=new Map<MeshStandardMaterial,Texture|null>(),meshes:{mesh:Mesh;original:Mesh['material'];local:Mesh['material']}[]=[],cache=new Map<string,Texture>()
 let revision=0,disposed=false
 root.traverse(object=>{
  if(!(object instanceof Mesh))return
  const original=object.material
  const local=(Array.isArray(original)?original:[original]).map(material=>{
   if(!(material instanceof MeshStandardMaterial))return material
   const own=material.clone();originals.set(own,own.map);return own
  })
  object.material=Array.isArray(original)?local:local[0]
  meshes.push({mesh:object,original,local:object.material})
 })
 const apply=(texture:Texture|null)=>{for(const [material,original] of originals){material.map=texture??original;material.needsUpdate=true}}
 return{
  setExpression:(expression:CharacterExpression)=>{
   if(disposed)return
   const token=++revision
   if(expression==='neutral'){apply(null);return}
   const existing=cache.get(expression)
   if(existing){apply(existing);return}
   loader.load(`/models/shuibuxin-expressions/${expression}.jpg`,texture=>{
    if(disposed){texture.dispose();return}
    const previous=cache.get(expression)
    if(previous){texture.dispose();if(token===revision)apply(previous);return}
    texture.flipY=false;texture.colorSpace=SRGBColorSpace
    cache.set(expression,texture)
    if(token===revision)apply(texture)
   },()=>{if(!disposed&&token===revision)apply(null)})
  },
  dispose:()=>{
   disposed=true;revision++
   for(const {mesh,original,local} of meshes)if(mesh.material===local)mesh.material=original
   for(const material of originals.keys())material.dispose()
   for(const texture of cache.values())texture.dispose()
  },
 }
}

