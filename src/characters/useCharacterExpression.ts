import { useEffect, useRef } from 'react'
import type { Object3D } from 'three'
import { useExpressionStore } from '../stores/expressionStore.ts'
import { createExpressionBinding } from './expressionBinding.ts'

export function useCharacterExpression(root:Object3D){
 const {expression}=useExpressionStore()
 const binding=useRef<ReturnType<typeof createExpressionBinding>|null>(null)
 useEffect(()=>{
  const current=createExpressionBinding(root);binding.current=current
  return()=>{current.dispose();if(binding.current===current)binding.current=null}
 },[root])
 useEffect(()=>{binding.current?.setExpression(expression)},[root,expression])
}

