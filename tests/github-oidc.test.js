'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {generateKeyPairSync,sign}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path');
const {verifyGitHubBackfillToken,checkClaims,AUDIENCE,ISSUER,JWKS_URL,REPO,
  BRANCH,WORKFLOW,SUBJECT}=require('../lib/github-oidc');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'});
const kid='verified-github-kid-for-test';
const key={...jwk,kid,use:'sig',alg:'RS256'};
const now=Math.floor(Date.now()/1000);
const claims=()=>({
 iss:ISSUER,aud:AUDIENCE,sub:SUBJECT,repository:REPO,
 repository_id:'1444200157',repository_owner_id:'342182145',
 workflow_ref:WORKFLOW,ref:BRANCH,event_name:'schedule',
 runner_environment:'github-hosted',iat:now-20,nbf:now-20,exp:now+250
});
function jwt(payload=claims(),header={alg:'RS256',kid,typ:'JWT'}){
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const input=encode(header)+'.'+encode(payload);
 return input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url');
}
const mockFetch=async(url,opts)=>{
 assert.equal(url,JWKS_URL);
 assert.equal(opts.redirect,'error');
 return{ok:true,json:async()=>({keys:[key]})};
};
async function allowed(c){return verifyGitHubBackfillToken(jwt(c),{fetcher:mockFetch,now});}
test('a valid scheduled GitHub Actions token grants backfill access',async()=>{
 assert.equal(await allowed(claims()),true);
});
test('the same trusted workflow can run manually on the main branch',async()=>{
 assert.equal(await allowed({...claims(),event_name:'workflow_dispatch'}),true);
});
test('OIDC rejects wrong audience, owner, repository, branch, workflow or event',async()=>{
 for(const patch of [
  {aud:'another-service'}, {repository:'someone/fork'},
  {repository_id:'42'},{repository_owner_id:'42'},
  {sub:'repo:johnstacey16-ui/pubg-help-clan:ref:refs/heads/main'},
  {ref:'refs/heads/feature'},{workflow_ref:WORKFLOW.replace('main','feature')},
  {event_name:'pull_request'},{runner_environment:'self-hosted'},
  {iss:'https://evil.example'}
 ])assert.equal(await allowed({...claims(),...patch}),false,JSON.stringify(patch));
});
test('OIDC rejects expired, premature, old and forged long-lived tokens',async()=>{
 for(const patch of [
  {iat:now-800}, {nbf:now+120}, {exp:now-60},
  {exp:now+1800},{iat:now+120}
 ])assert.equal(await allowed({...claims(),...patch}),false,JSON.stringify(patch));
});
test('OIDC rejects altered signatures even when claims look valid',async()=>{
 const token=jwt(),chunks=token.split('.');
 chunks[2]=(chunks[2][0]==='A'?'B':'A')+chunks[2].slice(1);
 assert.equal(await verifyGitHubBackfillToken(chunks.join('.'),{fetcher:mockFetch,now}),false);
});
test('OIDC rejects tokens with alg none, absent kid, wrong key and oversized input',async()=>{
 assert.equal(await verifyGitHubBackfillToken(jwt(claims(),{alg:'none',kid}),{fetcher:mockFetch,now}),false);
 assert.equal(await verifyGitHubBackfillToken(jwt(claims(),{alg:'RS256'}),{fetcher:mockFetch,now}),false);
 assert.equal(await verifyGitHubBackfillToken(jwt(),{fetcher:async()=>({ok:true,json:async()=>({keys:[]})}),now}),false);
 assert.equal(await verifyGitHubBackfillToken('a'.repeat(18000),{fetcher:mockFetch,now}),false);
 assert.equal(await verifyGitHubBackfillToken('abc.def.ghi',{fetcher:mockFetch,now}),false);
});
test('OIDC verifies with a fixed GitHub issuer JWKS and fails closed on outage',async()=>{
 assert.equal(await verifyGitHubBackfillToken(jwt(),{
  fetcher:async()=>{throw Error('timeout')},now}),false);
 assert.equal(checkClaims(claims(),now),true);
 assert.equal(checkClaims({...claims(),event_name:'pull_request'},now),false);
});
test('backfill API accepts signed OIDC only on the authenticated backfill path',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../api/sync.js'),'utf8');
 assert.match(source,/mode==='backfill'&&/);
 assert.match(source,/verifyGitHubBackfillToken/);
 assert.match(source,/if\(!cronAllowed&&!oidcAllowed\)/);
 assert.match(source,/if\(mode==='backfill'\)/);
 assert.match(source,/authorization==='Bearer '\+secret/);
 assert.doesNotMatch(source,/req\.query\?\.secret/);
});
test('workflow requests OIDC only for main; runner refreshes the token on each call',()=>{
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/pubg-data-backfill.yml'),'utf8');
 const runner=fs.readFileSync(path.join(__dirname,'../scripts/collect-pubg-backfill.js'),'utf8');
 assert.match(workflow,/id-token: write/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/cron: '30 2 \* \* \*'/);
 assert.match(runner,/ACTIONS_ID_TOKEN_REQUEST_URL/);
 assert.match(runner,/ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
 assert.match(runner,/url\.searchParams\.set\('audience',AUDIENCE\)/);
 assert.match(runner,/const credential=secret\|\|await githubToken\(\)/);
 assert.match(runner,/progress\.claimed===0/);
 assert.doesNotMatch(workflow,/secrets\.PUBG_SYNC_CRON_SECRET/);
});
