import { CharacterRulesLoader } from '../character/CharacterRulesLoader.ts'
import { CharacterPromptBuilder } from '../prompts/CharacterPromptBuilder.ts'
import { getQwenConfig } from './config.ts'
import { QwenProvider } from './QwenProvider.ts'
import { DisclosureGuard, historyWindow } from './StreamingDialogue.ts'
import { ProviderError } from './LLMProvider.ts'
import type { LLMProvider } from './LLMProvider.ts'
import { isDialogueRequest } from '../../src/types/dialogue.ts'
import { parseActionOutput } from './ActionOutputProtocol.ts'
import { recordIntentDiagnostic } from './intentDiagnostics.ts'
export class ActionIntent {
 constructor(privateConfig=getQwenConfig(),privateProvider?:LLMProvider,loader=new CharacterRulesLoader()){this.config=privateConfig;this.provider=privateProvider;this.loader=loader}
 private loader:CharacterRulesLoader
 private config:ReturnType<typeof getQwenConfig>;private provider?:LLMProvider
 async respond(value:unknown,signal:AbortSignal){
  if(!isDialogueRequest(value)||value.mode!=='ai')throw new ProviderError('INVALID_REQUEST','对话请求无效。')
  const started=performance.now()
  let promptTokens:number|null=null,completionTokens:number|null=null,stage='SUCCESS',issues:{path:string;errorType:string}[]=[]
  try {
   const rules=await this.loader.load(),request={...value,history:historyWindow(value,this.config)},prompt=new CharacterPromptBuilder().build(request,rules,'action')
   const guard=new DisclosureGuard([rules.content.trim(),rules.custom?.content??'',this.config.apiKey,...(rules.sections.get(10)??'').split(/\r?\n/).filter(s=>s.length>24)])
   let text=''
   for await(const chunk of (this.provider??new QwenProvider(this.config)).stream({request,prompt,signal,maxTokens:600,jsonMode:true,onUsage:usage=>{promptTokens=usage.promptTokens;completionTokens=usage.completionTokens}})){
    signal.throwIfAborted();text+=guard.push(chunk)
    if(text.length>3000)throw new ProviderError('INVALID_PLAN_LENGTH','意图回复过长，未执行动作。',{stage:'LENGTH',issues:[{path:'',errorType:'maxLength'}]})
   }
   text+=guard.push('',true);signal.throwIfAborted()
   if(text.length>3000)throw new ProviderError('INVALID_PLAN_LENGTH','意图回复过长，未执行动作。',{stage:'LENGTH',issues:[{path:'',errorType:'maxLength'}]})
   return parseActionOutput(text)
  }catch(error){
   stage=error instanceof ProviderError?error.diagnostics?.stage??error.code:signal.aborted?'CANCELLED':'INTERNAL'
   issues=error instanceof ProviderError?error.diagnostics?.issues??[]:[]
   throw error
  }finally{recordIntentDiagnostic({stage,issues,promptTokens,completionTokens,latencyMs:performance.now()-started})}
 }
}
