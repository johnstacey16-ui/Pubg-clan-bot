'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261104_adaptive_pubg_user_priority.sql'),'utf8');
test('idle budget uses all ten; recent interactive demand protects three slots',()=>{
 assert.match(sql,/interactive_active then 7 else 10/);
 assert.match(sql,/scope='interactive:last' and next_allowed>now_at/);
 assert.match(sql,/interval '10 minutes'/);
 assert.equal((sql.match(/insert into public.pubg_api_requests/g)||[]).length,2);
 assert.equal((sql.match(/pg_advisory_xact_lock\(551167711\)/g)||[]).length,2);
 assert.equal((sql.match(/interval '65 seconds'/g)||[]).length,2);
});
test('website and Discord user requests activate the demand window',()=>{
 const [a,b]=sql.split('create or replace function public.reserve_web_refresh');
 assert.match(a,/values \('interactive:last'/);
 assert.match(b.split('create or replace function public.reserve_pubg_background_requests')[0],/values \('interactive:last'/);
 assert.match(b,/interval '2 minutes'/);
});
test('every reservation still requires the same service-only budget',()=>{
 assert.match(sql,/used_count\+p_count > 10/);
 assert.match(sql,/used_count\+p_count>background_ceiling/);
 for(const name of ['reserve_pubg_requests','reserve_web_refresh','reserve_pubg_background_requests']){
   assert.ok(sql.includes('revoke all on function public.'+name+'('));
   assert.ok(sql.includes('grant execute on function public.'+name+'('));
 }
 assert.doesNotMatch(sql,/grant execute[^;]* to anon|grant execute[^;]* to authenticated/ig);
});
