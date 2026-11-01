import type { RefObject } from 'react'
import type { Group } from 'three'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Html, useCursor } from '@react-three/drei'
import type { Position } from './palette'
import { roomItems } from './roomConfig'
import type { RoomItemId } from './roomConfig'

interface InteractiveObjectProps {
  objectRef?: RefObject<Group | null>
  id: RoomItemId
  position?: Position
  labelPosition?: Position
  selected: RoomItemId | null
  onSelect: (id: RoomItemId) => void
  children: ReactNode
  onActivate?: () => void
  hint?: string
}

export function InteractiveObject({ id, position, labelPosition = [0, 1.6, 0], selected, onSelect, children, objectRef, onActivate, hint }: InteractiveObjectProps) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  return (
    <group ref={objectRef} name={`item-${id}`} position={position}
      onPointerOver={event => { event.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
      onClick={event => { event.stopPropagation(); if (event.delta <= 4) {onSelect(id);onActivate?.()} }}>
      {children}
      {hovered && <Html position={labelPosition} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
        <div className={`object-tooltip ${selected === id ? 'is-selected' : ''}`} role="tooltip"><span />{roomItems[id].name}<small>{hint??'点击查看'}</small></div>
      </Html>}
    </group>
  )
}
