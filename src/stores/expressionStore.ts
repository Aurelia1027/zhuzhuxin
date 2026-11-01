import { useSyncExternalStore } from 'react'
import { defaultExpression, normalizeExpression } from '../types/characterExpression.ts'
import type { CharacterExpression } from '../types/characterExpression.ts'

export function createExpressionStore(){
 let state:{expression:CharacterExpression;mode:'ai'|'manual'}={expression:defaultExpression,mode:'ai'}
 let revision=0
 const listeners=new Set<()=>void>()
 const update=(next:typeof state)=>{state=next;listeners.forEach(listener=>listener())}
 return {
  getSnapshot:()=>state,
  subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}},
  beginAIRequest:()=>++revision,
  invalidateAI:()=>{revision++},
  applyAI:(value:unknown,token:number)=>{
   if(token!==revision||state.mode!=='ai')return false
   update({expression:normalizeExpression(value),mode:'ai'});return true
  },
  setManual:(value:CharacterExpression)=>{revision++;update({expression:normalizeExpression(value),mode:'manual'})},
  followChat:()=>{revision++;update({...state,mode:'ai'})},
 }
}
export const expressionStore=createExpressionStore()
export function useExpressionStore(){return useSyncExternalStore(expressionStore.subscribe,expressionStore.getSnapshot,expressionStore.getSnapshot)}
