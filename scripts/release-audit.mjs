import {execFileSync} from 'node:child_process';
import {readdir,readFile,stat,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const fixed=['docs/mobile-chat-experience.md','docs/single-character-actions.md','netlify.toml','docs/week07-netlify-qwen.md','.gitignore','.env.example','index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json','README.md','LICENSE','ASSET_LICENSE.md','PRIVACY.md','CONTRIBUTING.md','SECURITY.md','docs/character/zhuzhuxin.md','docs/character/character.custom.example.md','docs/character-customization.md','docs/github-and-deployment.md','docs/release-v1-checklist.md','docs/week05-furniture-interactions.md','docs/week05-furniture/final.jpg','public/favicon.svg','public/models/cozy-room.glb','public/models/shark.glb','public/models/shuibuxin-walk.glb','scripts/release-audit.mjs','scripts/prepare-release.mjs'];
async function filesIn(folder){const result=[];for(const entry of await readdir(join(root,folder),{withFileTypes:true})){const p=folder+'/'+entry.name;if(entry.isSymbolicLink())throw new Error('Release symlink rejected');if(entry.isDirectory())result.push(...await filesIn(p));else if(entry.isFile())result.push(p)}return result}
export async function releaseFiles(){
 const paths=[...fixed];for(const folder of ['src','server','deployment','.github','netlify','docs/mobile-chat-experience','docs/single-character-actions'])paths.push(...await filesIn(folder));
 for(const entry of await readdir(join(root,'public/models/shuibuxin-expressions'))){if(/^[a-z]+\.jpg$/.test(entry))paths.push('public/models/shuibuxin-expressions/'+entry)}
 for(const path of paths){const metadata=await lstat(join(root,path));if(!metadata.isFile()||metadata.isSymbolicLink())throw new Error('Release file missing or unsafe: '+path)}
 return [...new Set(paths)].sort();
}
export function secretKinds(text){
 const kinds=[];
 if(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/.test(text))kinds.push('API_KEY_PATTERN');
 if(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(text))kinds.push('CLOUD_KEY_PATTERN');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))kinds.push('PRIVATE_KEY');
 if(/(?:DASHSCOPE_API_KEY|OPENAI_API_KEY)\s*[:=]\s*["']?[A-Za-z0-9_-]{24,}/.test(text))kinds.push('ASSIGNED_API_KEY');
 return kinds;
}
const textFile=path=>/\.(?:tsx?|m?js|json|md|html|css|toml|ya?ml|conf|service|example)$/.test(path)||['LICENSE','.gitignore'].includes(path.split('/').at(-1));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
export async function audit(){
 const files=await releaseFiles(),findings=[];let textFiles=0,historyBlobs=0;const commits=git('rev-list','--all').trim().split(/\r?\n/).filter(Boolean),seen=new Set();
 for(const path of files){const size=(await stat(join(root,path))).size;if(size>=95*1024*1024)findings.push({scope:'candidate',path,kind:'LARGE_FILE'});if(textFile(path)){textFiles++;for(const kind of secretKinds(await readFile(join(root,path),'utf8')))findings.push({scope:'candidate',path,kind})}}
 for(const commit of commits)for(const entry of git('ls-tree','-r','-l','-z',commit).split('\0').filter(Boolean)){
  const [meta,path]=entry.split('\t'),parts=meta.trim().split(/\s+/),hash=parts[2],size=Number(parts[3]);
  if(/(^|\/)\.env(?:$|\.(?!example$))|character\.custom\.md$|\.(?:pem|key|p12|pfx)$/.test(path))findings.push({scope:'history',revision:commit.slice(0,12),path,kind:'PRIVATE_FILE_PATH'});
  if(!seen.has(hash)&&textFile(path)&&size<=2*1024*1024){seen.add(hash);historyBlobs++;for(const kind of secretKinds(git('show',`${commit}:${path}`)))findings.push({scope:'history',revision:commit.slice(0,12),path,kind})}
 }
 const env=await readFile(join(root,'.env'),'utf8').catch(()=>''),unsafeVite=env.split(/\r?\n/).some(line=>/^VITE_.*(?:KEY|SECRET|TOKEN)\s*=\s*\S+/.test(line));
 if(unsafeVite)findings.push({scope:'working-config',path:'.env',kind:'VITE_CREDENTIAL_FORBIDDEN'});
 const ignored=git('check-ignore','.env','docs/character/character.custom.md','backups/example').trim().split(/\r?\n/);
 if(ignored.length!==3)findings.push({scope:'ignore',kind:'PRIVATE_PATH_NOT_IGNORED'});
 return{ok:findings.length===0,files:files.length,textFiles,historyCommits:commits.length,historyBlobs,findings,note:'Pattern-based audit, not proof of absence of every secret or copyright issue. No secret values are reported.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=await audit();console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1}
