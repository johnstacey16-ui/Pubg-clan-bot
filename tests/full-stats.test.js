'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FIELDS,metricValue,derived,formatted,MODES}=require('../assets/full-stats');
const {whitelistStats}=require('../lib/web-stats');
test('the 31 official non-deprecated numeric fields are allowlisted',()=>{
 const keys=FIELDS.map(f=>f.key);
 assert.equal(keys.length,31);assert.equal(new Set(keys).size,31);
 const input=Object.fromEntries(keys.map((k,i)=>[k,i]));
 input.secretToken='never expose';input.rankPoints=12;input.rankPointsTitle='deprecated';
 assert.deepEqual(Object.keys(whitelistStats(input)).sort(),keys.slice().sort());
});
test('missing, malformed and malicious values do not appear as zero',()=>{
 assert.deepEqual(whitelistStats({kills:0,damageDealt:0,roundsPlayed:'8',
  revives:null,top10s:'bad',weeklyKills:-1,roadKills:{value:3},wins:true}),
  {kills:0,damageDealt:0,roundsPlayed:8});
});
test('aggregated counts sum, records use maxima, recent values are mode-specific',()=>{
 const p={modes:{solo:{kills:2,roundsPlayed:4,longestKill:280,roundMostKills:2,dailyKills:1},
  squad:{kills:3,roundsPlayed:10,longestKill:195,roundMostKills:3,dailyKills:2}}};
 const get=(key,mode='all')=>metricValue(p,mode,FIELDS.find(f=>f.key===key));
 assert.equal(get('kills'),5);assert.equal(get('roundsPlayed'),14);
 assert.equal(get('longestKill'),280);assert.equal(get('roundMostKills'),3);
 assert.equal(get('dailyKills'),null);assert.equal(get('dailyKills','squad'),2);
 assert.equal(get('revives'),null);assert.equal(derived(p,'all').killsPerMatch,5/14);
 assert.equal(derived(p,'all').winRate,null);assert.equal(MODES.length,6);
});
test('rates require numerator and denominator; formats preserve absence',()=>{
 const p={modes:{solo:{roundsPlayed:0,kills:0},
  squad:{roundsPlayed:20,kills:10,wins:2,damageDealt:2500,top10s:6,headshotKills:3}}};
 assert.equal(derived(p,'solo').killsPerMatch,null);
 assert.equal(derived(p,'squad').damagePerMatch,125);
 assert.equal(derived(p,'squad').winRate,10);
 assert.equal(derived(p,'squad').top10Rate,30);
 assert.equal(derived(p,'squad').headshotRate,30);
 assert.equal(formatted(null,'count'),'—');
 assert.equal(formatted(3605,'seconds'),'1h 0m');
});
