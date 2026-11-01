import { isCharacterAction, isEnvironmentState } from '../../types/dialogue.ts'
import type { CharacterAction, EnvironmentState } from '../../types/dialogue.ts'

export interface CharacterActionRequest { type: 'character.action.requested'; requestId: string; action: CharacterAction }
export interface RoomEnvironmentRequest { type: 'room.environment.requested'; requestId: string; environment: EnvironmentState }
export type RoomDialogueEvent = CharacterActionRequest | RoomEnvironmentRequest
const listeners = new Set<(event: RoomDialogueEvent) => void>()

/** Animation adapters subscribe independently; emitting a request never claims animation completion. */
export function subscribeRoomDialogueEvents(listener: (event: RoomDialogueEvent) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function publishRoomDialogueEvent(event: RoomDialogueEvent) {
  if (!event || typeof event.requestId !== 'string' || !event.requestId || event.requestId.length > 80 ||
    (event.type === 'character.action.requested' ? !isCharacterAction(event.action)
      : event.type === 'room.environment.requested' ? !isEnvironmentState(event.environment) : true)) {
    throw new Error('Invalid room dialogue event')
  }
  for (const listener of listeners) {
    // An optional animation adapter cannot invalidate a successfully validated chat response.
    try { listener(structuredClone(event)) } catch { console.warn('Room dialogue adapter failed; no animation completion was reported.') }
  }
}
