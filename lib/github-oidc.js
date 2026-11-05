'use strict';
// Verify a short-lived GitHub Actions OIDC identity on our server.
// GitHub's immutable 2026 repository-subject includes numeric owner/repo IDs.
// Only the named backfill workflow running on this exact main branch is trusted.
const {createPublicKey,verify}=require('node:crypto');
const ISSUER='https://token.actions.githubusercontent.com';
const JWKS_URL=ISSUER+'/.well-known/jwks';
const AUDIENCE='pubg-help-clan-backfill';
const REPO='johnstacey16-ui/pubg-help-clan';
const OWNER_ID='342182145';
const REPO_ID='1444200157';
const BRANCH='refs/heads/main';
const WORKFLOW=REPO+'/.github/workflows/pubg-data-backfill.yml@'+BRANCH;
const SUBJECT='repo:johnstacey16-ui@'+OWNER_ID+'/pubg-help-clan@'+REPO_ID+':ref:'+BRANCH;
const EVENTS=new Set(['workflow_dispatch','schedule']);

function decode(part){
 if(!/^[A-Za-z0-9_-]+$/.test(part)||part.length>12000)
   throw Error('Invalid token encoding');
 return JSON.parse(Buffer.from(part,'base64url').toString('utf8'));
}
function checkClaims(claims,now=Math.floor(Date.now()/1000)){
 if(!claims||typeof claims!=='object')return false;
 const validTimes=[claims.iat,claims.nbf,claims.exp].every(x=>Number.isSafeInteger(x));
 return validTimes&&claims.iat<=now+30&&claims.iat>=now-600&&
   claims.nbf<=now+30&&claims.exp>now-30&&
   claims.exp-claims.iat>0&&claims.exp-claims.iat<=1200&&
   claims.iss===ISSUER&&claims.aud===AUDIENCE&&
   claims.sub===SUBJECT&&claims.repository===REPO&&
   String(claims.repository_id)===REPO_ID&&
   String(claims.repository_owner_id)===OWNER_ID&&
   claims.ref===BRANCH&&claims.workflow_ref===WORKFLOW&&
   EVENTS.has(claims.event_name)&&claims.runner_environment==='github-hosted';
}
async function verifyGitHubBackfillToken(token,{fetcher=fetch,now=Math.floor(Date.now()/1000)}={}){
 if(typeof token!=='string'||token.length>16000)return false;
 const parts=token.split('.');
 if(parts.length!==3||parts.some(part=>!part))return false;
 let header,claims;
 try{header=decode(parts[0]);claims=decode(parts[1]);}
 catch{return false;}
 if(!header||header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200)
   return false;
 // Claims are *not* trusted until the key signature validates.
 // A bounded GET to the fixed GitHub JWKS origin never follows URLs in a JWT.
 let jwks;
 try{
   const response=await fetcher(JWKS_URL,{
     headers:{Accept:'application/json'},
     signal:AbortSignal.timeout(7000),
     redirect:'error'
   });
   if(!response.ok)return false;
   jwks=await response.json();
 }catch{return false;}
 const keys=Array.isArray(jwks?.keys)?jwks.keys:[];
 const key=keys.find(k=>k?.kid===header.kid&&k.kty==='RSA'&&
   (!k.use||k.use==='sig')&&(!k.alg||k.alg==='RS256'));
 if(!key)return false;
 try{
   const publicKey=createPublicKey({key,format:'jwk'});
   const valid=verify('RSA-SHA256',
     Buffer.from(parts[0]+'.'+parts[1]),publicKey,
     Buffer.from(parts[2],'base64url'));
   return valid&&checkClaims(claims,now);
 }catch{return false;}
}
module.exports={verifyGitHubBackfillToken,checkClaims,AUDIENCE,
  ISSUER,JWKS_URL,REPO,BRANCH,WORKFLOW,SUBJECT};
