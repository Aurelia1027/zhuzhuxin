import Ajv from 'ajv'

export const rootActionTypes = ['turn_around', 'come_to_me'] as const
export type RootActionType = typeof rootActionTypes[number]
export type RootActionName = 'TurnAround' | 'ComeToMe'
export interface RootActionCommand { type: RootActionType }
const validate = new Ajv({ strict: true, coerceTypes: false, removeAdditional: false }).compile<RootActionCommand>({
  type: 'object', required: ['type'], additionalProperties: false,
  properties: { type: { enum: rootActionTypes } },
})
/** Local, closed commands only. No caller-provided coordinates, bone names or scripts. */
export function parseRootAction(value: unknown): RootActionCommand {
  if (!validate(value)) throw new Error('这个转向或返回指令暂不支持。')
  return { type: value.type }
}
export function facingViewerYaw(rootX: number, rootZ: number, viewerX: number, viewerZ: number, modelYaw: number, fallback: number) {
  const dx = viewerX - rootX, dz = viewerZ - rootZ
  return Math.hypot(dx, dz) < .0001 ? fallback : Math.atan2(dx, dz) - modelYaw
}
