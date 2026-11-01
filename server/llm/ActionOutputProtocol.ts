import { actionPlanSchema, executableActions, parseActionPlan, ActionValidationError } from '../../src/types/actionCommands.ts'
import { ProviderError } from './LLMProvider.ts'
import { characterExpressions, normalizeExpression } from '../../src/types/characterExpression.ts'

/** Output protocol is separate from the immutable character rules. */
export function actionOutputProtocol(): string {
 return [
  '只返回一个合法 JSON 对象，必需 reply 和 commands，可选 expression；不要其它字段、Markdown、代码围栏或解释。',
  `expression 只能是 ${characterExpressions.map(([id,label])=>`${id}（${label}）`).join('、')}。`,
  '根据完整角色原稿的人物性格、对话上下文和你自己的回复选择表情，不照搬用户的情绪词。普通聊天自然使用 neutral；关心和安慰可用 love，不必与用户一起哭。害羞用 shy，开心可用 happy。不要捏造表情名；不确定使用 neutral。',
  'reply 必须是非空的自然中文字符串，最多1200字符；commands 必须是数组，最多6项。',
  `commands 严格遵循：${JSON.stringify(actionPlanSchema.properties.commands)}`,
  `动作 type 仅允许：${executableActions.join(', ')}。不要输出大小写变体或其它动作。`,
  '每项必需 type。destination 可选，只允许 bed 或 desk，且必须与 walk_to_bed 或 walk_to_desk 一致。',
  'followUpAction 可选，只能用于 walk_to_bed、walk_to_desk，值只能是 idle、wave、listen_rap，表示真实抵达后才执行。',
  '不需要的可选字段必须省略，绝不可填写 null、空字符串或 undefined。不要添加 mood、action、environment 等字段。',
  '普通聊天返回 commands=[]；只在用户明确要求动作时生成指令。否定、引用和询问能力不构成动作要求。',
  '未知动作或未知位置温和说明且 commands=[]，不得编造 sit、read、jump、dance、run。',
  '复合命令优先用一个移动指令加 followUpAction。去书桌听歌理解为 walk_to_desk + listen_rap（不播放音乐）。等我来找你只是对话内容，不是新动作。',
  '不要声称已经抵达或已经完成尚未执行的动作。不要冒充现实人物本人。',
  '最小聊天示例：{"reply":"嗯，我听着呢。","expression":"neutral","commands":[]}',
  '挥手示例：{"reply":"好呀，跟你打个招呼。","commands":[{"type":"wave"}]}',
  '先去书桌再听Rap示例：{"reply":"嗯，我先走过去，到了再听会Rap，等你。","commands":[{"type":"walk_to_desk","followUpAction":"listen_rap"}]}',
 ].join('\n')
}

export function parseActionOutput(text: string) {
 const invalid = (stage: string, path: string, errorType: string) => new ProviderError('INVALID_PLAN_'+stage, '这次动作指令不够明确，先不执行，请换一种说法。', {stage,issues:[{path,errorType}]})
 let result: unknown
 try { result=JSON.parse(text) } catch { throw invalid('JSON','','syntax') }
 if(!result || typeof result!=='object' || Array.isArray(result))throw invalid('ROOT','','type')
 const envelope=result as Record<string,unknown>
 for(const name of ['reply','commands'])if(!Object.hasOwn(envelope,name))throw invalid('MISSING_FIELD','/'+name,'required')
 if(Object.keys(envelope).some(key=>key!=='reply'&&key!=='commands'&&key!=='expression'))throw invalid('UNKNOWN_FIELD','/<unknown>','additionalProperties')
 if(typeof envelope.reply!=='string'||!envelope.reply.trim()||envelope.reply.length>1200)throw invalid('REPLY','/reply','stringConstraint')
 try { return {reply:envelope.reply,...parseActionPlan({commands:envelope.commands}),expression:normalizeExpression(envelope.expression)} }
 catch(error){
  if(error instanceof ActionValidationError)throw new ProviderError('INVALID_PLAN_'+error.stage,'这次动作指令不够明确，先不执行，请换一种说法。',{stage:error.stage,issues:error.issues})
  throw error
 }
}
