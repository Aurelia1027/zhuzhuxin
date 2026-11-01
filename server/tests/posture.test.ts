import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AnimationMixer, Bone, Group, Object3D, PropertyBinding, Quaternion } from 'three'
import { PostureState } from '../../src/characters/postureState.ts'
import { bedSeat, createPostureClips, safeSeatApproach, seatPosition } from '../../src/characters/characterPosture.ts'
import { createCharacterClips } from '../../src/characters/characterAnimations.ts'
import { ActionBridge } from '../../src/characters/actionBridge.ts'
import type { CharacterActionCommand } from '../../src/characters/characterAnimations.ts'
import { parseActionPlan, recognizeLocal } from '../../src/types/actionCommands.ts'

const tick = () => new Promise<void>(resolve => queueMicrotask(resolve))
const status = (action: CharacterActionCommand['action'], posture: 'standing' | 'sitting' | 'seated' | 'standing-up' = 'standing', moving = false, dock: 'Bed' | 'Desk' = 'Bed', transitioning = false) => ({ action, posture, moving, dock, transitioning, phase: 'playing' as const, bones: 12 })
function loadRig() {
  const bytes = readFileSync(new URL('../../public/models/shuibuxin-walk.glb', import.meta.url)), document = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)))
  const joints = new Set(document.skins[0].joints)
  const nodes = document.nodes.map((data: { name: string; translation?: number[]; rotation?: number[]; scale?: number[]; extras?: object }, i: number) => {
    const object = joints.has(i) ? new Bone() : new Object3D()
    object.name = PropertyBinding.sanitizeNodeName(data.name); object.userData = data.extras ?? {}
    if (data.translation) object.position.fromArray(data.translation)
    if (data.rotation) object.quaternion.fromArray(data.rotation)
    if (data.scale) object.scale.fromArray(data.scale)
    return object
  }) as Object3D[]
  document.nodes.forEach((data: { children?: number[] }, i: number) => data.children?.forEach(j => nodes[i].add(nodes[j])))
  const root = new Group(); document.scenes[document.scene ?? 0].nodes.forEach((i: number) => root.add(nodes[i]))
  return root
}
test('posture holds seated; duplicate requests and stale finish events do not advance state', () => {
  const state = new PostureState()
  assert.equal(state.standing(), false); assert.equal(state.sit(), true); assert.equal(state.sit(), false)
  assert.equal(state.seated(), true); assert.equal(state.posture, 'seated'); assert.equal(state.seated(), false)
  assert.equal(state.stand(), true); assert.equal(state.stand(), false); assert.equal(state.standing(), true); assert.equal(state.posture, 'standing')
})
test('cancel during sitting completes the transition then safely stands; no half-squat state', () => {
  const state = new PostureState(); state.sit(); state.stand()
  assert.equal(state.posture, 'sitting'); state.seated(); assert.equal(state.posture, 'standing-up'); state.standing(); assert.equal(state.posture, 'standing')
})
test('ten anchor cycles have zero drift and continuous endpoints; local approach is bounded', () => {
  for (let i = 0; i < 10; i++) {
    assert.deepEqual(seatPosition('sitting', 0), bedSeat.approach)
    assert.deepEqual(seatPosition('sitting', bedSeat.transitionSeconds).map(v => +v.toFixed(8)), bedSeat.anchor)
    assert.deepEqual(seatPosition('seated', 1000), bedSeat.anchor)
    assert.deepEqual(seatPosition('standing-up', bedSeat.transitionSeconds), bedSeat.approach)
  }
  assert(safeSeatApproach(-.9, .85)); assert(!safeSeatApproach(0, .85)); assert(!safeSeatApproach(-.9, .9))
})
test('new clips retain rest data, all original clips, independent limbs and bounded hold configuration', () => {
  const rig = loadRig(), before: string[] = []; rig.traverse(o => before.push(JSON.stringify([o.position, o.quaternion, o.scale])))
  const old = createCharacterClips(rig), clips = createPostureClips(rig, 2)
  assert.deepEqual(old.map(c => [c.name, c.duration]), [['Idle', 4.8], ['Wave', 4], ['ListenRap', 2.4], ['Walk', .8]])
  assert.deepEqual(clips.map(c => c.name), ['SitDown', 'Seated', 'StandUp', 'OpenArms']); assert(clips.every(c => c.validate()))
  const after: string[] = []; rig.traverse(o => after.push(JSON.stringify([o.position, o.quaternion, o.scale]))); assert.deepEqual(after, before)
  const bones: Bone[] = []; rig.traverse(o => { if (o instanceof Bone) bones.push(o) })
  for (const name of ['SitDown', 'StandUp']) for (const bone of bones.filter(b => !b.name.startsWith('Leg'))) {
    const track = clips.find(c => c.name === name)!.tracks.find(t => t.name === `${bone.uuid}.quaternion`)!
    for (let i = 0; i < track.values.length; i += 4) assert(bone.quaternion.angleTo(new Quaternion().fromArray(track.values, i)) < .001)
  }
  assert.throws(() => createPostureClips(rig, Infinity)); assert.throws(() => createPostureClips(rig, -1))
  const mixer = new AnimationMixer(rig), action = mixer.clipAction(clips.find(c => c.name === 'OpenArms')!)
  action.play(); mixer.update(4.2); const left = bones.find(b => b.name === 'ArmL')!
  const start = clips.find(c => c.name === 'OpenArms')!.tracks.find(t => t.name === `${left.uuid}.quaternion`)!
  assert(left.quaternion.angleTo(new Quaternion().fromArray(start.values)) < .001); mixer.stopAllAction()
})
test('seated completion releases queue; a later walk waits for actual movement completion', async () => {
  const bridge = new ActionBridge(), sent: CharacterActionCommand[] = [], detach = bridge.attach(c => sent.push(c)); bridge.observe(status('Idle'))
  bridge.requestPose('sit_down'); bridge.requestPose('sit_down'); assert.equal(sent.length, 1)
  bridge.observe(status('SitDown', 'sitting', false, 'Bed', true)); assert.equal(bridge.getSnapshot().pending, 1)
  bridge.observe(status('Seated', 'seated')); await tick(); assert.equal(bridge.getSnapshot().pending, 0)
  bridge.submit({ commands: [{ type: 'walk_to_desk' }] }); assert.equal(sent.at(-1)?.action, 'Walk')
  bridge.observe(status('StandUp', 'standing-up', false, 'Bed', true)); assert.equal(bridge.getSnapshot().pending, 1)
  bridge.observe(status('Walk', 'standing', true)); bridge.observe(status('Idle', 'standing', false, 'Desk')); await tick(); assert.equal(bridge.getSnapshot().pending, 0); detach()
})
test('cancelling active sit drops dependencies and requests safe standing only after seated feedback', async () => {
  const bridge = new ActionBridge(), sent: CharacterActionCommand[] = [], detach = bridge.attach(c => sent.push(c)); bridge.observe(status('Idle'))
  bridge.requestPose('sit_down'); bridge.requestPose('open_arms'); bridge.observe(status('SitDown', 'sitting', false, 'Bed', true)); bridge.stop()
  assert.equal(sent.length, 1); bridge.observe(status('Seated', 'seated')); await tick(); assert.equal(sent.at(-1)?.action, 'Idle')
  bridge.observe(status('StandUp', 'standing-up', false, 'Bed', true)); bridge.observe(status('Walk', 'standing', true)); bridge.observe(status('Idle')); await tick()
  assert(!sent.some(c => c.action === 'OpenArms')); assert.equal(bridge.getSnapshot().pending, 0); detach()
})
test('unknown coordinates, skeleton names, old aliases and legacy commands remain safely validated', () => {
  for (const command of [{ type: 'sit' }, { type: 'sit_down', position: [0, 0, 0] }, { type: 'open_arms', bone: 'Arm.L' }, { type: 'jump' }]) assert.throws(() => parseActionPlan({ commands: [command] }))
  for (const text of ['挥挥手', '去书桌', '回床边', '听Rap', '去书桌听Rap']) assert.equal(recognizeLocal(text).kind, 'plan')
})
