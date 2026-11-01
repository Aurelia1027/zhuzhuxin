import { useRef } from 'react'
import type { ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three'
import type { Object3D } from 'three'
import type { ViewMode } from '../../scene/palette'
import { characterPlacement } from '../../characters/characterAnimations'

type Controls = ComponentRef<typeof OrbitControls>
/** Reframe the existing camera while the mobile sheet is open. No second Canvas/model. */
export function MobileChatCamera({ view }: { view: ViewMode }) {
  const { camera, controls, scene, size } = useThree()
  const state = useRef({
    active: false, restore: 0, initialized: false, character: null as Object3D | null,
    center: new Vector3(), lastTarget: new Vector3(), lastPosition: new Vector3(), width: 0, height: 0,
    saved: { position: new Vector3(), target: new Vector3(), width: 0, fov: 45, minDistance: 8, maxDistance: 19,
      minPolarAngle: .5, maxPolarAngle: 1.15, minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, autoRotate: false, enableDamping: true },
  })
  useFrame(() => {
    if (!(camera instanceof PerspectiveCamera) || !controls) return
    const orbit = controls as Controls, current = state.current, saved = current.saved
    const active = document.body.dataset.mobileChatOpen === 'true'
    if (!active) {
      if (current.active) { current.active = false; current.restore = 8 }
      if (current.restore > 0 && current.initialized) {
        current.restore--
        camera.position.copy(saved.position)
        camera.fov = (saved.width < 650) === (size.width < 650) ? saved.fov : view === 'inside' ? (size.width < 650 ? 86 : 74) : (size.width < 650 ? 63 : 45)
        orbit.target.copy(saved.target)
        Object.assign(orbit, { minDistance: saved.minDistance, maxDistance: saved.maxDistance, minPolarAngle: saved.minPolarAngle,
          maxPolarAngle: saved.maxPolarAngle, minAzimuthAngle: saved.minAzimuthAngle, maxAzimuthAngle: saved.maxAzimuthAngle,
          autoRotate: saved.autoRotate, enableDamping: false })
        camera.updateProjectionMatrix(); orbit.update(); orbit.enableDamping = saved.enableDamping
        return
      }
      saved.position.copy(camera.position); saved.target.copy(orbit.target); saved.fov = camera.fov; saved.width = size.width
      for (const key of ['minDistance', 'maxDistance', 'minPolarAngle', 'maxPolarAngle', 'minAzimuthAngle', 'maxAzimuthAngle', 'autoRotate', 'enableDamping'] as const)
        Object.assign(saved, { [key]: orbit[key] })
      current.initialized = true
      return
    }
    current.character ??= scene.getObjectByName('ZhuZhuXinCharacter') ?? null
    if (current.character) current.character.getWorldPosition(current.center)
    else current.center.set(...characterPlacement.position)
    current.center.y += characterPlacement.height * .52
    if (!current.active) {
      if (!current.initialized) {
        saved.position.copy(camera.position); saved.target.copy(orbit.target); saved.fov = camera.fov; saved.width = size.width
        for (const key of ['minDistance', 'maxDistance', 'minPolarAngle', 'maxPolarAngle', 'minAzimuthAngle', 'maxAzimuthAngle', 'autoRotate', 'enableDamping'] as const)
          Object.assign(saved, { [key]: orbit[key] })
        current.initialized = true
      }
      current.active = true; current.restore = 0
      orbit.enableDamping = false; orbit.autoRotate = false
      orbit.minDistance = 2.2; orbit.maxDistance = 6
      orbit.minPolarAngle = .65; orbit.maxPolarAngle = 1.6
      orbit.minAzimuthAngle = view === 'inside' ? -.98 : -Infinity
      orbit.maxAzimuthAngle = view === 'inside' ? -.65 : Infinity
      camera.position.copy(current.center).add(view === 'inside' ? current.lastPosition.set(-1.6, .8, 1.8) : current.lastPosition.set(-1.8, 1, 2.8))
    } else {
      // RoomScene retains its resize/reset logic. Preserve the user's mobile orbit across keyboard resizes.
      if (current.width !== size.width || current.height !== size.height) { camera.position.copy(current.lastPosition); orbit.target.copy(current.lastTarget) }
      camera.position.add(current.lastTarget.subVectors(current.center, orbit.target))
    }
    camera.fov = view === 'inside' ? 50 : 42
    orbit.target.copy(current.center); camera.updateProjectionMatrix(); orbit.update()
    current.lastPosition.copy(camera.position); current.lastTarget.copy(orbit.target)
    current.width = size.width; current.height = size.height
  })
  return null
}
