import { characterIdentity } from './characterIdentity.ts'
import Ajv from 'ajv'

export const actions = ['idle', 'wave', 'sit', 'read'] as const
export type CharacterAction = typeof actions[number]
export type DialogueMode = 'demo' | 'ai'
export interface EnvironmentState {
  lighting: 'day' | 'warm' | 'night'
  weather: 'clear' | 'rain'
  music: 'off' | 'lofi' | 'ambient'
}
export interface RelationshipConfig {
  mode: 'rules-default' | 'user-defined'
  description: string
  addressAs: string
}
export interface ConversationMessage { role: 'user' | 'assistant'; content: string }
export interface DialogueRequest {
  mode: DialogueMode
  message: string
  history: ConversationMessage[]
  relationship: RelationshipConfig
  environment: EnvironmentState
}
export interface RulesMetadata { characterId: typeof characterIdentity.id; version: string; sha256: string }
export interface DialogueResponse {
  requestId: string
  mode: DialogueMode
  reply: string
  mood?: 'calm' | 'happy' | 'sad' | 'thoughtful'
  action: CharacterAction
  environment: EnvironmentState
  rules: RulesMetadata
}
export interface CharacterMetadata extends RulesMetadata { demoAvailable: true; aiAvailable: boolean }
export const defaultRelationship: RelationshipConfig = { mode: 'rules-default', description: '', addressAs: '' }
export const initialEnvironment: EnvironmentState = { lighting: 'warm', weather: 'clear', music: 'off' }

const environmentSchema = {
  type: 'object', additionalProperties: false, required: ['lighting', 'weather', 'music'],
  properties: {
    lighting: { enum: ['day', 'warm', 'night'] }, weather: { enum: ['clear', 'rain'] }, music: { enum: ['off', 'lofi', 'ambient'] },
  },
} as const
const relationshipSchema = {
  type: 'object', additionalProperties: false, required: ['mode', 'description', 'addressAs'],
  properties: {
    mode: { enum: ['rules-default', 'user-defined'] },
    description: { type: 'string', maxLength: 280 }, addressAs: { type: 'string', maxLength: 40 },
  },
  allOf: [
    { if: { properties: { mode: { const: 'rules-default' } } }, then: { properties: { description: { const: '' }, addressAs: { const: '' } } } },
    { if: { properties: { mode: { const: 'user-defined' } } }, then: { properties: { description: { type: 'string', minLength: 1, pattern: '\\S' } } } },
  ],
} as const
const rulesSchema = {
  type: 'object', additionalProperties: false, required: ['characterId', 'version', 'sha256'],
  properties: { characterId: { const: characterIdentity.id }, version: { type: 'string', pattern: '^\\d+\\.\\d+(?:\\.\\d+)?$' }, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' } },
} as const
export const dialogueRequestSchema = {
  type: 'object', additionalProperties: false, required: ['mode', 'message', 'history', 'relationship', 'environment'],
  properties: {
    mode: { enum: ['demo', 'ai'] }, message: { type: 'string', minLength: 1, maxLength: 2000, pattern: '\\S' },
    history: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['role', 'content'], properties: {
      role: { enum: ['user', 'assistant'] }, content: { type: 'string', minLength: 1, maxLength: 4000 },
    } } },
    relationship: relationshipSchema, environment: environmentSchema,
  },
} as const
/** Shared public contract only. Character prose and prompts must stay on the server. */
export const modelReplySchema = {
  type: 'object', additionalProperties: false, required: ['reply', 'action', 'environment'],
  properties: { reply: { type: 'string', minLength: 1, maxLength: 4000, pattern: '\\S' }, action: { enum: actions }, environment: environmentSchema },
} as const
export const dialogueResponseSchema = {
  type: 'object', additionalProperties: false, required: ['requestId', 'mode', 'reply', 'action', 'environment', 'rules'],
  properties: {
    ...modelReplySchema.properties, mood: { enum: ['calm', 'happy', 'sad', 'thoughtful'] }, requestId: { type: 'string', minLength: 1, maxLength: 80 }, mode: { enum: ['demo', 'ai'] }, rules: rulesSchema,
  },
} as const

const ajv = new Ajv({ allErrors: true, strict: true, coerceTypes: false, removeAdditional: false })
export const isDialogueRequest = ajv.compile<DialogueRequest>(dialogueRequestSchema)
export const isDialogueResponse = ajv.compile<DialogueResponse>(dialogueResponseSchema)
export const isEnvironmentState = ajv.compile<EnvironmentState>(environmentSchema)
export const isRelationshipConfig = ajv.compile<RelationshipConfig>(relationshipSchema)
export const isCharacterAction = ajv.compile<CharacterAction>({ enum: actions })
export const isModelReply = ajv.compile<Pick<DialogueResponse, 'reply' | 'action' | 'environment'>>(modelReplySchema)
export const isCharacterMetadata = ajv.compile<CharacterMetadata>({
  ...rulesSchema, required: [...rulesSchema.required, 'demoAvailable', 'aiAvailable'],
  properties: { ...rulesSchema.properties, demoAvailable: { const: true }, aiAvailable: { type: 'boolean' } },
})

export function parseDialogueResponse(value: unknown): DialogueResponse {
  if (!isDialogueResponse(value)) throw new Error('服务返回的数据格式不正确，未应用任何房间动作。')
  return value
}

export type SceneInstruction = Pick<DialogueResponse, 'reply' | 'action' | 'environment'> & { mood: NonNullable<DialogueResponse['mood']> }
export const isSceneInstruction = ajv.compile<SceneInstruction>({ ...modelReplySchema, required: [...modelReplySchema.required, 'mood'], properties: { ...modelReplySchema.properties, mood: { enum: ['calm', 'happy', 'sad', 'thoughtful'] } } })
