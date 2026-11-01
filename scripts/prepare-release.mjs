import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {root,releaseFiles,audit} from './release-audit.mjs';
const result=await audit();if(!result.ok)throw new Error('Release audit failed; review sanitized findings with npm run release:audit');
const label=process.argv[2]??'v1.0-candidate-20261101';if(!/^[a-zA-Z0-9._-]+$/.test(label))throw new Error('Invalid release label');
const out=resolve(root,'releases',label);if(dirname(out)!==resolve(root,'releases'))throw new Error('Unsafe output path');
await mkdir(join(root,'releases'),{recursive:true});await mkdir(out,{recursive:false});
const manifest=[];
for(const path of await releaseFiles()){
 const target=join(out,path);await mkdir(dirname(target),{recursive:true});await copyFile(join(root,path),target);
 const bytes=await readFile(target);manifest.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(join(out,'RELEASE-MANIFEST.json'),JSON.stringify({status:'LOCAL_REVIEW_CANDIDATE_NOT_PUBLISHED',audit:result,files:manifest},null,2));
console.log(JSON.stringify({output:out,files:manifest.length,totalBytes:manifest.reduce((sum,file)=>sum+file.bytes,0),status:'Prepared only; no Git commit, remote, push or deployment performed.'},null,2));
