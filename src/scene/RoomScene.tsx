import type { Group } from 'three'
import { characterPlacement } from '../characters/characterAnimations'
import type { CharacterActionCommand } from '../characters/characterAnimations'
import type { CharacterPlayback } from '../characters/ZhuZhuXinCharacter'
import { ZhuZhuXinCharacter } from '../characters/ZhuZhuXinCharacter'
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { roomInteractions } from '../interactions/roomInteractions.ts'
import type { ComponentRef } from 'react'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from 'three'
import { SharkPlush } from './SharkPlush'
import { RoomDecorativeOverlays } from './Decorations'
import { RoomAsset, RoomFixtureLights } from './BlenderRoom'
import { TypographyWall } from './TypographyWall'
import { InteractiveObject } from './InteractiveObject'
import { Lighting } from './Lighting'
import { WindowSky } from './Window'
import { layout } from './roomConfig'
import type { RoomItemId } from './roomConfig'
import type { Mood, ViewMode } from './palette'

export interface RoomSceneProps {
  characterCommand: CharacterActionCommand
  onCharacterPlayback: (state: CharacterPlayback) => void
  mood: Mood
  lampOn: boolean
  autoRotate: boolean
  resetKey: number
  view: ViewMode
  selected: RoomItemId | null
  onSelect: (id: RoomItemId) => void
  onToggleLamp: () => void
}

export function RoomScene({ mood, lampOn, autoRotate, resetKey, view, selected, onSelect, characterCommand, onCharacterPlayback }: RoomSceneProps) {
  const characterRoot = useRef<Group>(null)
  const furniture=useSyncExternalStore(roomInteractions.subscribe,roomInteractions.getSnapshot,roomInteractions.getSnapshot)
  useEffect(()=>roomInteractions.syncLampPreset(lampOn),[lampOn])
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const direction = useRef(1)
  const { camera, size } = useThree()
  const inside = view === 'inside'
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const narrow = size.width < 650
    camera.fov = inside ? (narrow ? 86 : 74) : (narrow ? 63 : 45)
    if (inside) camera.position.set(-3.35, 2.25, 2.4)
    else camera.position.set(-7.7, 7.6, 9.7)
    camera.updateProjectionMatrix()
    if (inside) controls.current?.target.set(.25, 1.1, -.8)
    else controls.current?.target.set(0, 1.05, 0)
    controls.current?.update()
  }, [camera, size.width, size.height, resetKey, inside])

  useFrame(() => {
    if (!autoRotate || !controls.current) return
    if (inside) {
      const angle = controls.current.getAzimuthalAngle()
      if (angle < -.96) direction.current = -1
      if (angle > -.74) direction.current = 1
    } else direction.current = 1
    controls.current.autoRotateSpeed = (inside ? .18 : .4) * direction.current
  })

  const interaction = { selected, onSelect }
  return <>
    <Lighting mood={mood} />
    <RoomAsset name="RoomShell" view={view} />
    <InteractiveObject id="typography" labelPosition={[-3.35, 2.65, -2.9]} {...interaction}><TypographyWall /></InteractiveObject>
    <InteractiveObject id="door" labelPosition={[-3.4, 1.5, -2.7]} {...interaction}><RoomAsset name="Door" /></InteractiveObject>
    <InteractiveObject id="cabinet" position={layout.cabinet} labelPosition={[0, 1.75, .1]} {...interaction}><RoomAsset name="ShoeCabinet" localOrigin /></InteractiveObject>
    <InteractiveObject id="shelf" position={layout.shelf} labelPosition={[0, 2.8, .1]} {...interaction}><RoomAsset name="Bookshelf" localOrigin /></InteractiveObject>
    <InteractiveObject id="desk" position={layout.desk} labelPosition={[0, 1.75, .2]} {...interaction} hint="点击：去书桌挥手" onActivate={()=>roomInteractions.request('desk')}><RoomAsset name="GamingDesk" localOrigin lampOn={furniture.deskLampOn} onToggleLamp={()=>roomInteractions.request('deskLamp')} /></InteractiveObject>
    <InteractiveObject id="bed" position={layout.bed} labelPosition={[0, 1.4, .9]} {...interaction} hint="点击：回到床边" onActivate={()=>roomInteractions.request('bed')}>
      <RoomAsset name="Bed" localOrigin /><InteractiveObject id="shark" position={[-.1, 1.08, .15]} labelPosition={[0, .7, 0]} {...interaction} hint="点击：浮起 / 放回" onActivate={()=>roomInteractions.request('shark')}><SharkPlush rotation={[0, -.85, 0]} scale={1.05} /></InteractiveObject>
    </InteractiveObject>
    <InteractiveObject id="window" labelPosition={[3.7, 2.1, -1.4]} {...interaction}><RoomAsset name="Window" /><WindowSky mood={mood} /></InteractiveObject>
    <RoomAsset name="Lamps" view={view} lampOn={lampOn} />
    <RoomAsset name="Plants" />
    <RoomFixtureLights lampOn={lampOn} deskLampOn={furniture.deskLampOn} mood={mood} />
    <InteractiveObject id="character" objectRef={characterRoot} position={characterPlacement.position} labelPosition={[0, 1.65, 0]} {...interaction}>
      <ZhuZhuXinCharacter height={characterPlacement.height} rotation={[0, characterPlacement.yaw, 0]} command={characterCommand} onPlayback={onCharacterPlayback} motionRoot={characterRoot} />
    </InteractiveObject>
    <RoomDecorativeOverlays />
    {!inside && <ContactShadows position={[0, -.25, 0]} scale={18} opacity={.45} blur={2.2} far={6} resolution={256} frames={1} color="#000000" />}
    <OrbitControls ref={controls} makeDefault enablePan={false}
      minPolarAngle={inside ? 1.26 : .5} maxPolarAngle={inside ? 1.5 : 1.15}
      minAzimuthAngle={inside ? -.98 : -Infinity} maxAzimuthAngle={inside ? -.72 : Infinity}
      minDistance={inside ? 2.2 : 8} maxDistance={inside ? 4.8 : 19}
      enableDamping dampingFactor={.08} rotateSpeed={inside ? .3 : .6} zoomSpeed={.7}
      autoRotate={autoRotate} autoRotateSpeed={.4} />
  </>
}
