// Checks the refresh logic against small hand-made matches in Cricsheet's format. Run: npm run selftest
import { readFileSync } from 'node:fs';
import { aggregateFeed, makeMatcher, activeFixture } from './live-lib.mjs';
import { collectNames, resolveSquad, makeSeries, processMatch, buildGrid, teamsOf } from './lib.mjs';

const cfg = JSON.parse(readFileSync(new URL('./series/nz-ind.json', import.meta.url), 'utf8'));
const D = (bowler, batter, b, e = 0, extras, wickets) => ({ batter, bowler, non_striker: 'X Y', runs: { batter: b, extras: e, total: b + e }, ...(extras && { extras }), ...(wickets && { wickets }) });
const players = { India: ['JJ Bumrah', 'KL Rahul', 'XX Other'], 'New Zealand': ['TWM Latham', 'DP Conway', 'MJ Henry', 'NG Smith'] };
const venue = { venue: 'Hagley Oval', city: 'Christchurch' };
const matches = {
    'm1.json': { info: { match_type: 'Test', dates: ['2020-02-21'], players, ...venue, outcome: { winner: 'New Zealand', by: { wickets: 7 } } }, innings: [
        { team: 'New Zealand', overs: [{ over: 0, deliveries: [
            D('JJ Bumrah', 'TWM Latham', 4), D('JJ Bumrah', 'TWM Latham', 0),
            D('JJ Bumrah', 'TWM Latham', 0, 1, { wides: 1 }), D('JJ Bumrah', 'TWM Latham', 2, 1, { noballs: 1 }),
            D('JJ Bumrah', 'TWM Latham', 0, 0, null, [{ player_out: 'TWM Latham', kind: 'bowled' }]),
            D('JJ Bumrah', 'DP Conway', 1, 0, null, [{ player_out: 'DP Conway', kind: 'run out' }]),
            D('XX Other', 'TWM Latham', 6) ] }] },
        { team: 'India', overs: [{ over: 0, deliveries: [D('MJ Henry', 'KL Rahul', 0, 0, null, [{ player_out: 'KL Rahul', kind: 'caught' }])] }] },
        { team: 'New Zealand', super_over: true, overs: [{ over: 0, deliveries: [D('JJ Bumrah', 'TWM Latham', 6)] }] } ] },
    'm2.json': { info: { match_type: 'Test', dates: ['2024-10-16'], players, venue: 'M Chinnaswamy Stadium', city: 'Bengaluru', outcome: { result: 'draw' } }, innings: [{ team: 'New Zealand', overs: [{ over: 0, deliveries: [
        D('JJ Bumrah', 'TWM Latham', 1), D('JJ Bumrah', 'TWM Latham', 0, 0, null, [{ player_out: 'TWM Latham', kind: 'caught' }]) ] }] }] },
    'same-name-other-country.json': { info: { match_type: 'Test', dates: ['2019-01-01'], players: { Australia: ['NG Smith'], India: ['JJ Bumrah'] } }, innings: [{ team: 'India', overs: [{ over: 0, deliveries: [D('NG Smith', 'JJ Bumrah', 1)] }] }] },
    'odi.json': { info: { match_type: 'ODI', dates: ['2023-01-01'], players }, innings: [{ team: 'New Zealand', overs: [{ over: 0, deliveries: [D('JJ Bumrah', 'TWM Latham', 4)] }] }] },
};

// Name resolution: Cricsheet spells Sai Sudharsan / Nitish Reddy differently from the series file; resolve by surname.
const names = new Map();
for (const m of Object.values(matches)) collectNames(m, teamsOf([cfg]), names);
names.get('India').add('Sai Sudharsan'); // pretend Cricsheet spells it without the initial
const { squad, notes } = resolveSquad(cfg.squads, names);
let ok = true;
const check = (label, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) { ok = false; console.log('FAIL', label, JSON.stringify(got), 'expected', JSON.stringify(want)); } };
check('resolver (exact kept)', squad.find((p) => p.name === 'Jasprit Bumrah').raw, 'JJ Bumrah');
check('resolver (surname match)', squad.find((p) => p.name === 'Sai Sudharsan').raw, 'Sai Sudharsan');
check('resolver (not found flagged)', squad.find((p) => p.name === 'Matt Henry').raw, 'MJ Henry');

const S = makeSeries(cfg, squad);
for (const [id, m] of Object.entries(matches)) processMatch(m, id, S);
const g = buildGrid(S, { generated: '', through: '2024-10-16', matches: 3 });

check('pair Bumrah|Latham', g.cells['Jasprit Bumrah|Tom Latham'], [6, 7, 3, 2, 2, '2024-10-16']);   // wide not a ball, no-ball is, run-out and super over ignored
check('pair Bumrah|Conway', g.cells['Jasprit Bumrah|Devon Conway'], [1, 1, 0, 0, 1, '2020-02-21']); // run out is not credited to the bowler
check('pair Henry|Rahul', g.cells['Matt Henry|KL Rahul'], [1, 0, 1, 1, 1, '2020-02-21']);
const extra = Object.keys(g.cells).filter((k) => !['Jasprit Bumrah|Tom Latham', 'Jasprit Bumrah|Devon Conway', 'Matt Henry|KL Rahul'].includes(k));
check('no unexpected pairs', extra, []);

// Ground-level pairs: only the Hagley Test (m1) counts at Hagley; the Bengaluru Test is not a configured ground.
check('venue pair', g.vcells['hagley|Jasprit Bumrah|Tom Latham'], [4, 6, 1]);
check('no other grounds', Object.keys(g.vcells).filter((k) => !k.startsWith('hagley|')), []);
// Career: Latham faced 4 legal-or-no-ball deliveries from Bumrah + 1 from XX Other (not a squad bowler, still a delivery to Latham) in m1,
// then 2 in m2. Runs 4+0+2+6(Other)=12 in m1 (innings 1), 1 in m2. Out bowled in m1, caught in m2.
check('career bat Latham', g.bat['Tom Latham'], [2, 2, 13, 7, 2, 2]);
check('ground bat Latham', g.vbat['hagley|Tom Latham'], [1, 1, 12, 5, 1, 1]);
// Bumrah's legal balls (wides and no-balls excluded, super over ignored): m1 = 4 (4, 0, bowled, Conway single), m2 = 2.
check('career bowl Bumrah', g.bowl['Jasprit Bumrah'].slice(0, 3), [2, 2, 6]);
check('wickets Bumrah (bowled+caught, not run out)', g.bowl['Jasprit Bumrah'][4], 2);
// Venue facts: Hagley Test m1, NZ batted first and won
check('venue facts', g.venues.hagley, [1, 15, 1, 0, 0, '2020-02-21']); // first-innings total 15 = runs + extras


// Live feed: same definitions as the Cricsheet grid, names matched loosely.
const feed = { balls: [
    { bowler: 'Jasprit Bumrah', batter: 'Tom Latham', runs: 4, extras: 0 },
    { bowler: 'J Bumrah', batter: 'T Latham', runs: 0, extras: 0 },
    { bowler: 'Jasprit Bumrah', batter: 'Tom Latham', runs: 0, extras: 1, wide: true },
    { bowler: 'Jasprit Bumrah', batter: 'Tom Latham', runs: 2, extras: 1, noball: true },
    { bowler: 'Jasprit Bumrah', batter: 'Tom Latham', runs: 0, extras: 0, wicket: 'bowled' },
    { bowler: 'Jasprit Bumrah', batter: 'Devon Conway', runs: 1, extras: 0, wicket: 'run out' },
    { bowler: 'Nobody Known', batter: 'Tom Latham', runs: 6, extras: 0 },
] };
const live = aggregateFeed(feed, cfg, cfg.fixtures[0]);
check('live pair', live.cells['Jasprit Bumrah|Tom Latham'], [4, 6, 2, 1]);           // wide not a ball; no-ball is; dots: 0 and the wicket ball
check('live ground pair', live.vcells['hagley|Jasprit Bumrah|Tom Latham'], [4, 6, 1]);
check('live run out not credited', live.cells['Jasprit Bumrah|Devon Conway'], [1, 1, 0, 0]);
check('live unknown name reported', live.unknown, ['Nobody Known']);
check('live counted deliveries', live.used, 6);
const win = activeFixture([cfg], Date.parse('2026-11-28T00:00:00Z'));
check('match-day window', !!win && win.fixture.n, 2);
check('outside window', activeFixture([cfg], Date.parse('2026-12-20T00:00:00Z')), null);

// India-wide database: builds from the same hand-made matches (no history files) and checks the pair strings and totals.
import { mkdtempSync, writeFileSync as wf, readFileSync as rf, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as pj } from 'node:path';
import { buildIndia, parseCsv } from './india.mjs';
check('csv quotes and commas', parseCsv('a,b\n1,"x, ""y"""\n')[0], { a: '1', b: 'x, "y"' });
{
    const dir = mkdtempSync(pj(tmpdir(), 'india-selftest-'));
    const reg = (m) => ({ people: Object.fromEntries(Object.values(m.info.players).flat().map((n) => [n, 'id-' + n.replace(/\s/g, '')])) });
    for (const [f, m] of Object.entries(matches)) {
        if (m.info.match_type !== 'Test') continue;
        const copy = JSON.parse(JSON.stringify(m)); copy.info.teams = Object.keys(m.info.players); copy.info.match_type_number = f === 'm1.json' ? 1 : 2; copy.info.registry = reg(m); copy.info.venue ??= 'Somewhere'; copy.meta = {};
        copy.innings = copy.innings.filter((i) => !i.super_over);
        wf(pj(dir, f), JSON.stringify(copy));
    }
    const outTs = pj(dir, 'indiaData.ts');
    const { out } = buildIndia({ testsDir: dir, historyDir: null, outFile: outTs, extras: [], log: () => {} });
    const idx = (n) => out.players.findIndex((p) => p[0] === n);
    const pair = out.pairs[`${idx('JJ Bumrah')},${idx('TWM Latham')}`];
    check('india pair strings', pair && pair.m.map((x) => x[2]), ['1:4,0,2n,0Wb', '1:1,0Wc']);   // wide left out, no-ball kept, wicket marked with its kind
    const runOut = out.pairs[`${idx('JJ Bumrah')},${idx('DP Conway')}`];
    check('india run out marked', runOut && runOut.m[0][2], '1:1Wr');
    const t1 = out.tests.findIndex((x) => x[1] === '2020-02-21');
    const bowl = out.bowl.filter((r) => r[2] === idx('JJ Bumrah') && r[0] === t1);
    check('india bowling row (balls, runs, wkts)', bowl[0] && [bowl[0][3], bowl[0][4], bowl[0][5]], [4, 9, 1]);
    rmSync(dir, { recursive: true, force: true });
}

console.log(ok ? 'selftest PASSED (wides, no-balls, run outs, super overs, same-name players, non-Tests, name resolver, ground splits, career, live feed, India-wide database)' : 'selftest FAILED');
process.exit(ok ? 0 : 1);
