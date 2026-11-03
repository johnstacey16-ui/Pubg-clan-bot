'use strict';
const str = (name, description, required = true, extra = {}) =>
  ({ type: 3, name, description, required, ...extra });
const number = (name, description, required = false, extra = {}) =>
  ({ type: 4, name, description, required, ...extra });
const player = (name = 'gamertag') => str(name, 'Xbox or PlayStation PUBG name');
const modeChoices = [
  'all', 'solo', 'duo', 'squad', 'solo-fpp', 'duo-fpp', 'squad-fpp'
].map(mode => ({ name: mode.toUpperCase(), value: mode }));
const commands = Object.freeze([
  { name: 'help', description: 'List PUBG console stats commands', type: 1 },
  { name: 'stats', description: 'Fetch or update Xbox/PlayStation lifetime player stats', type: 1,
    options: [player()] },
  { name: 'leaderboard', description: 'Top official clan players by lifetime kills', type: 1 },
  { name: 'roster', description: 'Browse the official clan roster and import progress', type: 1,
    options: [number('page', 'Roster page (15 names per page)', false, { min_value: 1, max_value: 10 })] },
  { name: 'clan', description: 'Summarise the official console clan roster', type: 1 },
  { name: 'compare', description: 'Compare two Xbox/PlayStation players', type: 1,
    options: [player('player1'), player('player2')] },
  { name: 'modes', description: 'Break down Solo, Duo, Squad, TPP and FPP lifetime stats', type: 1,
    options: [player(), str('mode', 'Game mode to inspect', false, { choices: modeChoices })] },
  { name: 'recent', description: 'Get recent match results for a player (up to 14 days)', type: 1,
    options: [player(), number('count', 'Number of matches (1–5)', false, { min_value: 1, max_value: 5 })] },
  { name: 'match', description: 'Inspect one match and a player performance', type: 1,
    options: [player(), str('matchid', 'PUBG match ID from /recent')] },
  { name: 'squad', description: 'View one match squad kills damage assists and knockdowns', type: 1,
    options: [player(), str('matchid', 'PUBG match ID from /recent')] },
  { name: 'teammates', description: 'Find frequent teammates in recent match rosters', type: 1,
    options: [player(), number('count', 'Recent matches to analyse (1–5)', false, { min_value: 1, max_value: 5 })] },
  { name: 'mastery', description: 'View weapon or survival mastery for a player', type: 1,
    options: [player(), str('type', 'Mastery to display', true, {
      choices: [{ name: 'Weapon', value: 'weapon' }, { name: 'Survival', value: 'survival' }]
    })] },
  { name: 'season', description: 'Fetch current season Solo, Duo and Squad stats', type: 1,
    options: [player()] },
  { name: 'ranked', description: 'Fetch current season ranked mode and tier stats', type: 1,
    options: [player()] }
]);
const VERSION = 'console-commands-2026-11-v4';
module.exports = { commands, VERSION };
