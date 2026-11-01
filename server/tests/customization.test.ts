import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm,rmdir,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,dirname,resolve} from 'node:path'
import {createServer} from 'node:http'
import {once} from 'node:events'
import type {AddressInfo} from 'node:net'
import {CustomCharacterLoader,MAX_CUSTOM_BYTES} from '../character/CustomCharacterLoader.ts'
import {CharacterRulesLoader} from '../character/CharacterRulesLoader.ts'
import {CharacterPromptBuilder} from '../prompts/CharacterPromptBuilder.ts'
import {characterRulesPath} from '../character/config.ts'
import {parseActionOutput} from '../llm/ActionOutputProtocol.ts'
import {createApiRateLimit} from '../security/PublicApiPolicy.ts'
import {createDialogueHandler} from '../http.ts'
import {StreamingDialogue} from '../llm/StreamingDialogue.ts'
import {ActionIntent} from '../llm/ActionIntent.ts'
import {getQwenConfig} from '../llm/config.ts'
import {defaultRelationship,initialEnvironment,isDialogueRequest} from '../../src/types/dialogue.ts'
const request={mode:'ai' as const,message:'你好',history:[],relationship:defaultRelationship,environment:initialEnvironment}
const valid='# Lumi Room Custom Character\n\n## Personality\nI like jazz and quiet, concise conversations.\n'
async function fixture(run:(root:string,file:string)=>Promise<void>){
 const root=await mkdtemp(join(tmpdir(),'lumi-custom-test-')),folder=join(root,'docs','character')
 try{await mkdir(folder,{recursive:true});await run(root,join(folder,'character.custom.md'))}
 finally{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert(root.split(/[\\/]/).at(-1)!.startsWith('lumi-custom-test-'));await rm(root,{recursive:true,force:true})}
}
test('owner opt-in, missing fallback, official source and full custom prompt composition',async()=>{
 const official=await readFile(characterRulesPath)
 await fixture(async(root,file)=>{
  assert.equal((await new CustomCharacterLoader(root,true).load()).status,'missing')
  await writeFile(file,valid)
  assert.equal((await new CustomCharacterLoader(root,false).load()).status,'disabled')
  const rules=await new CharacterRulesLoader(characterRulesPath,new CustomCharacterLoader(root,true)).load()
  assert.equal(rules.custom?.content,valid);assert.equal(rules.content,official.toString())
  const prompt=new CharacterPromptBuilder().build(request,rules,'action')
  assert.equal(prompt.messages[1].content,official.toString());assert.equal(prompt.messages[1].role,'system')
  assert.equal(prompt.messages[2].role,'user');assert.equal(JSON.parse(prompt.messages[2].content).preferences,valid)
  assert.match(prompt.messages[0].content,/配置数据/);assert.match(prompt.messages[0].content,/不能覆盖/)
  assert.throws(()=>parseActionOutput('{"reply":"yes","commands":[{"type":"jump"}]}'))
  assert.equal(isDialogueRequest({...request,customPath:'../../.env'}),false)
 })
 assert.deepEqual(await readFile(characterRulesPath),official)
})
test('empty, oversized, malformed and invalid UTF8 custom files safely fall back',async()=>{
 await fixture(async(root,file)=>{
  const loader=new CustomCharacterLoader(root,true)
  for(const input of ['',Buffer.from([0xff,0xfe,0x80]),'x'.repeat(MAX_CUSTOM_BYTES+1),'<script>bad</script>','# Lumi Room Custom Character\n\0']){
   await writeFile(file,input);const result=await loader.load();assert.equal(result.status,'invalid');assert.equal(result.custom,undefined)
   const official=await new CharacterRulesLoader(characterRulesPath,loader).load();assert.equal(official.custom,undefined);assert.equal(official.metadata.version,'0.2')
  }
 })
})
test('custom filename is fixed and directories or symlinks cannot redirect reads',async(t)=>{
 await fixture(async(root,file)=>{
  await writeFile(join(root,'secret.md'),valid);assert.equal((await new CustomCharacterLoader(root,true).load()).status,'missing')
  await mkdir(file);assert.equal((await new CustomCharacterLoader(root,true).load()).status,'invalid');await rmdir(file)
  try{await symlink(join(root,'secret.md'),file)}catch(error){if(error&&typeof error==='object'&&'code'in error&&['EPERM','EACCES'].includes(String(error.code))){t.diagnostic('OS denied symlink creation; directory/fixed-path checks still exercised');return}throw error}
  assert.equal((await new CustomCharacterLoader(root,true).load()).status,'invalid')
 })
})
test('production API never calls paid providers, keeps Demo/metadata/health and rejects cross-origin requests',async()=>{
 const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';let calls=0
 const provider={id:'qwen' as const,async *stream(){calls++;yield 'never'}}
 const config={...getQwenConfig({}),enabled:true,apiKey:'mock-only'}
 const server=createServer(createDialogueHandler(undefined,new StreamingDialogue(config,provider),new ActionIntent(config,provider)))
 server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`
 try{
  const metadata=await (await fetch(base+'/api/character')).json() as {aiAvailable:boolean};assert.equal(metadata.aiAvailable,false)
  assert.equal((await fetch(base+'/api/health')).status,200)
  for(const route of ['/api/action-intent','/api/dialogue/stream','/api/dialogue']){
   const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)})
   assert.equal(response.status,503);assert.equal((await response.json() as {code:string}).code,'PUBLIC_AI_DISABLED')
  }
  const demo=await fetch(base+'/api/dialogue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,mode:'demo'})});assert.equal(demo.status,200)
  const rejected=await fetch(base+'/api/action-intent',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.invalid'},body:'{}'});assert.equal(rejected.status,403)
  assert.equal(calls,0);assert(!JSON.stringify(metadata).includes('mock-only'))
 }finally{server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous}
})
test('bounded global rate limit resets by actual window, not user identity or chat content',()=>{
 let clock=0;const accept=createApiRateLimit(2,1000,()=>clock)
 assert(accept());assert(accept());assert.equal(accept(),false);clock=1000;assert(accept())
})
