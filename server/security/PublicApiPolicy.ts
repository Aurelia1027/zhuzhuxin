/** v1 public deployment is Demo only: no anonymous paid upstream calls. */
export function allowsProductionAi(env:NodeJS.ProcessEnv=process.env){return env.NODE_ENV!=='production'}
export function createApiRateLimit(max=120,windowMs=60_000,now=()=>Date.now()){
 let start=now(),count=0
 return()=>{const time=now();if(time-start>=windowMs){start=time;count=0}return ++count<=max}
}
