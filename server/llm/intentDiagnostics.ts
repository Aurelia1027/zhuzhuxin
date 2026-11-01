export interface IntentDiagnostic {
 stage:string
 issues:{path:string;errorType:string}[]
 promptTokens:number|null
 completionTokens:number|null
 latencyMs:number
}
// Bounded, in-memory metadata only. No user messages, model output, prompts or keys.
const records:IntentDiagnostic[]=[]
export function recordIntentDiagnostic(record:IntentDiagnostic){records.push(structuredClone(record));if(records.length>32)records.shift()}
export function getIntentDiagnostics(){return structuredClone(records)}
