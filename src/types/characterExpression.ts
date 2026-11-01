import Ajv from 'ajv'

// IDs and labels moved verbatim from the approved ExpressionPreview UI.
export const characterExpressions = [['neutral','日常困倦'],['happy','开心微笑'],['laugh','开心大笑'],['surprised','惊讶'],['shy','害羞'],['sad','委屈哭'],['angry','生气'],['love','温柔喜欢'],['blink','眨眼']] as const
export type CharacterExpression = typeof characterExpressions[number][0]
export const defaultExpression: CharacterExpression = 'neutral'
export const expressionSchema = {type:'string',enum:characterExpressions.map(([id])=>id)} as const
const validate = new Ajv({strict:true,coerceTypes:false}).compile<CharacterExpression>(expressionSchema)
export function normalizeExpression(value:unknown):CharacterExpression {return validate(value)?value:defaultExpression}
