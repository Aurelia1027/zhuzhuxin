import Ajv from 'ajv'
import type { ErrorObject } from 'ajv'
export const executableActions=['idle','wave','listen_rap','walk_to_bed','walk_to_desk'] as const
export type ExecutableAction=typeof executableActions[number]
export interface ActionCommand {type:ExecutableAction;destination?:'bed'|'desk';followUpAction?:'idle'|'wave'|'listen_rap'}
export interface ActionPlan {commands:ActionCommand[]}
export const actionPlanSchema={type:'object',additionalProperties:false,required:['commands'],properties:{commands:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,required:['type'],properties:{type:{enum:executableActions},destination:{enum:['bed','desk']},followUpAction:{enum:['idle','wave','listen_rap']}}}}}} as const
const validate=new Ajv({strict:true,allErrors:true,coerceTypes:false,removeAdditional:false}).compile<ActionPlan>(actionPlanSchema)
export interface ActionValidationIssue {path:string;errorType:string}
export class ActionValidationError extends Error {
 readonly stage:string;readonly issues:ActionValidationIssue[]
 constructor(stage:string,issues:ActionValidationIssue[]){super('这个动作或位置目前还不支持，先不执行。');this.stage=stage;this.issues=issues}
}
/** Do not log arbitrary property names: they may contain private model text. */
export function safeValidationPath(path:string){return path.split('/').map((s,i)=>i===0?'':/^(commands|reply|type|destination|followUpAction|\d{1,3})$/.test(s)?s:'<unknown>').join('/')}
function issueFor(error:ErrorObject,value:unknown):{stage:string;issue:ActionValidationIssue}{
 let path=error.instancePath
 if(error.keyword==='required')path+='/'+String(error.params.missingProperty)
 if(error.keyword==='additionalProperties')path+='/<unknown>'
 let current:unknown=value
 for(const part of error.instancePath.split('/').slice(1))current=current&&typeof current==='object'?(current as Record<string,unknown>)[part]:undefined
 const stage=error.keyword==='required'?'MISSING_FIELD':error.keyword==='additionalProperties'?'UNKNOWN_FIELD'
  :current===null&&/\/(destination|followUpAction)$/.test(path)?'OPTIONAL_NULL'
  :error.keyword==='enum'&&path.endsWith('/type')?'ACTION_NAME'
  :error.keyword==='enum'&&path.endsWith('/destination')?'DESTINATION'
  :error.keyword==='enum'&&path.endsWith('/followUpAction')?'FOLLOWUP':'FIELD_TYPE'
 return{stage,issue:{path:safeValidationPath(path),errorType:error.keyword}}
}
export function parseActionPlan(value:unknown):ActionPlan {
 if(!validate(value)){const failures=(validate.errors??[]).map(e=>issueFor(e,value));throw new ActionValidationError(failures[0]?.stage??'FIELD_TYPE',failures.map(f=>f.issue))}
 for(const [i,c] of value.commands.entries()){
  if(c.destination&&c.type!==`walk_to_${c.destination}`)throw new ActionValidationError('DESTINATION_MISMATCH',[{path:`/commands/${i}/destination`,errorType:'semantic'}])
  if(c.followUpAction&&!c.type.startsWith('walk_to_'))throw new ActionValidationError('FOLLOWUP',[{path:`/commands/${i}/followUpAction`,errorType:'semantic'}])
 }
 return structuredClone(value)
}
export type LocalIntent={kind:'plan';plan:ActionPlan}|{kind:'stop'}|{kind:'unsupported'}|{kind:'chat'}
export function recognizeLocal(input:string):LocalIntent {
 const text=input.trim().replace(/[，,。！!？?\s]/g,'').replace(/^(猪猪心|朱朱|猪猪)[啊呀]?/,'').replace(/^(请|麻烦你|帮我)/,'').replace(/(吧|一下|好吗|好不好)$/,'').toLowerCase()
 if(/^(停下来|停一下|停|别动了|停止|取消后续动作|取消动作)$/.test(text))return{kind:'stop'}
 if(/^(转身|转个身|跳起来|跳一下|跳|坐下|坐|读书|看书|跳舞|跑起来|跑步)$/.test(text))return{kind:'unsupported'}
 const move=text.match(/^(?:走到|走去|去|到)(?:书桌|桌子)(?:旁边|旁|边)?(听(?:会|一会)?(?:rap|歌))?$/)
 if(move)return{kind:'plan',plan:{commands:[{type:'walk_to_desk'},...(move[1]?[{type:'listen_rap' as const}]:[])]}}
 if(/^(?:回|回到|走到|去)(?:床边|床旁|床旁边)$/.test(text))return{kind:'plan',plan:{commands:[{type:'walk_to_bed'}]}}
 if(/^(挥挥手|挥手|招招手|招手)$/.test(text))return{kind:'plan',plan:{commands:[{type:'wave'}]}}
 if(/^(听rap|听会rap|听一会rap)$/.test(text))return{kind:'plan',plan:{commands:[{type:'listen_rap'}]}}
 if(/^(待机|休息一下|安静待着)$/.test(text))return{kind:'plan',plan:{commands:[{type:'idle'}]}}
 return{kind:'chat'}
}
