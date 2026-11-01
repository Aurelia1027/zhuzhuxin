import { useEffect, useRef } from 'react'
import type { Object3D } from 'three'
import { useExpressionStore } from '../stores/expressionStore.ts'
import { createExpressionBinding } from './expressionBinding.ts'
import type { CharacterExpression } from '../types/characterExpression.ts'

export function useCharacterExpression(root:Object3D,contextExpression?:CharacterExpression){
 const {expression,mode}=useExpressionStore()
 const binding=useRef<ReturnType<typeof createExpressionBinding>|null>(null)
 useEffect(()=>{
  const current=createExpressionBinding(root);binding.current=current
  return()=>{current.dispose();if(binding.current===current)binding.current=null}
 },[root])
 useEffect(()=>{binding.current?.setExpression(mode==='manual'?expression:contextExpression??expression)},[root,expression,mode,contextExpression])
}

