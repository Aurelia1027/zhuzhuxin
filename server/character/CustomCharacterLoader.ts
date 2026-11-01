import { lstat, open, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { projectRoot } from './config.ts'

export const MAX_CUSTOM_BYTES=16_384
export const MAX_CUSTOM_CHARS=8_000
export interface CustomCharacter {content:string}
export interface CustomCharacterResult {status:'disabled'|'missing'|'applied'|'invalid';reason?:string;custom?:CustomCharacter}

/** Deployment-owner configuration only. No HTTP path, URL or arbitrary file-path setting. */
export class CustomCharacterLoader {
 private root:string
 private enabled:boolean
 constructor(root=projectRoot,enabled=process.env.CHARACTER_CUSTOM_ENABLED==='true'){this.root=resolve(root);this.enabled=enabled}
 async load():Promise<CustomCharacterResult>{
  if(!this.enabled)return{status:'disabled'}
  try{
   const base=await realpath(this.root)
   for(const directory of [join(base,'docs'),join(base,'docs','character')]){
    const stat=await lstat(directory)
    if(stat.isSymbolicLink()||!stat.isDirectory())return{status:'invalid',reason:'UNSAFE_DIRECTORY'}
   }
   const file=join(base,'docs','character','character.custom.md'),stat=await lstat(file)
   if(stat.isSymbolicLink()||!stat.isFile()||await realpath(file)!==file)return{status:'invalid',reason:'UNSAFE_FILE'}
   if(stat.size>MAX_CUSTOM_BYTES)return{status:'invalid',reason:'TOO_LONG'}
   const handle=await open(file,'r')
   let bytes:Buffer
   try{
    if(!(await handle.stat()).isFile())return{status:'invalid',reason:'UNSAFE_FILE'}
    const buffer=Buffer.alloc(MAX_CUSTOM_BYTES+1),read=await handle.read(buffer,0,buffer.length,0)
    if(read.bytesRead>MAX_CUSTOM_BYTES)return{status:'invalid',reason:'TOO_LONG'}
    bytes=buffer.subarray(0,read.bytesRead)
   }finally{await handle.close()}
   let content:string
   try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return{status:'invalid',reason:'UTF8_REQUIRED'}}
   if(!content.trim())return{status:'invalid',reason:'EMPTY'}
   if(content.length>MAX_CUSTOM_CHARS)return{status:'invalid',reason:'TOO_LONG'}
   if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content)||!/^# Lumi Room Custom Character\r?\n[\s\S]*^## /m.test(content))return{status:'invalid',reason:'MARKDOWN_FORMAT'}
   return{status:'applied',custom:{content}}
  }catch(error){return error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT'?{status:'missing'}:{status:'invalid',reason:'READ_FAILED'}}
 }
}
