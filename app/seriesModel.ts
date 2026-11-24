// Turns a series file (refresh/series/*.json) plus whatever data is available into one model the Play analysis page reads.
// Sources, best first: the Cricsheet refresh (app/gridData.ts), then, for the upcoming NZ v IND Test only, the site's own
// ball-by-ball matchup data. A Test still in progress can be laid on top from app/liveData.ts (see refresh/live.mjs).
import { DATA } from './data';
import { VENUE_DATA } from './venueData';
import { GRIDS } from './gridData';
import { LIVE } from './liveData';
import NZ_IND from '../refresh/series/nz-ind.json';
import IND_AUS from '../refresh/series/ind-aus.json';
import type { BatRec, BowlRec, PairRec } from './edge';

export type SPlayer = { name: string; team: string; raw?: string; style?: 'Pace' | 'Spin'; role?: string; likely?: boolean };
export type Venue = { key: string; name: string; city: string; match: string[] };
export type Fixture = { n: number; venue: string; label: string; dates: string; date: string; start: string; days: number; time?: string };
export type Cfg = { id: string; title: string; subtitle: string; homeTeam: string; squadStatus: 'named' | 'probable'; squadNote: string; venues: Venue[]; fixtures: Fixture[]; squads: SPlayer[] };
export type VenueFacts = { tests: number; firstAvg: number | null; batFirst: number; chase: number; draws: number; last: string };
export type GroundPair = { balls: number; runs: number; outs: number };
export type Live = { asOf: string; balls: number; date: string; fixture: number; venue: string };
export type Model = {
    cfg: Cfg; source: 'cricsheet' | 'site' | 'none'; through: string; generated: string; matches: number;
    pairs: Map<string, PairRec>; gpairs: Map<string, GroundPair>;
    bat: Map<string, BatRec>; bowl: Map<string, BowlRec>; vbat: Map<string, BatRec>; vbowl: Map<string, BowlRec>;
    venues: Map<string, VenueFacts>; live: Live | null; dates: string[];
};

export const SERIES: Cfg[] = [NZ_IND as unknown as Cfg, IND_AUS as unknown as Cfg];

const num = (x: any, d = 0) => (typeof x === 'number' && isFinite(x) ? x : d);
const bat6 = (v: number[]): BatRec => ({ tests: v[0], inns: v[1], runs: v[2], balls: v[3], outs: v[4], cred: v[5] });
const bowl5 = (v: number[]): BowlRec => ({ tests: v[0], inns: v[1], balls: v[2], runs: v[3], wkts: v[4] });

function empty(cfg: Cfg): Model {
    return { cfg, source: 'none', through: '', generated: '', matches: 0, pairs: new Map(), gpairs: new Map(), bat: new Map(), bowl: new Map(), vbat: new Map(), vbowl: new Map(), venues: new Map(), live: null, dates: [] };
}

function fromGrid(cfg: Cfg, g: any): Model {
    const m = empty(cfg);
    m.source = 'cricsheet'; m.dates = g.dates || []; m.through = g.through || ''; m.generated = g.generated || ''; m.matches = g.matches || 0;
    Object.entries((g.cells || {}) as Record<string, any[]>).forEach(([k, v]) => m.pairs.set(k, { balls: v[0], runs: v[1], dots: v[2], outs: v[3], tests: v[4], last: v[5] }));
    Object.entries((g.vcells || {}) as Record<string, any[]>).forEach(([k, v]) => m.gpairs.set(k, { balls: v[0], runs: v[1], outs: v[2] }));
    Object.entries((g.bat || {}) as Record<string, number[]>).forEach(([k, v]) => m.bat.set(k, bat6(v)));
    Object.entries((g.bowl || {}) as Record<string, number[]>).forEach(([k, v]) => m.bowl.set(k, bowl5(v)));
    Object.entries((g.vbat || {}) as Record<string, number[]>).forEach(([k, v]) => m.vbat.set(k, bat6(v)));
    Object.entries((g.vbowl || {}) as Record<string, number[]>).forEach(([k, v]) => m.vbowl.set(k, bowl5(v)));
    Object.entries((g.venues || {}) as Record<string, any[]>).forEach(([k, v]) => m.venues.set(k, { tests: v[0], firstAvg: v[1], batFirst: v[2], chase: v[3], draws: v[4], last: v[5] }));
    return m;
}

/** NZ v IND without a Cricsheet refresh: the site's own matchup and Hagley data. */
function fromSite(cfg: Cfg): Model {
    const m = empty(cfg);
    m.source = 'site';
    addSiteMeetings(m, '');
    const g: any = (VENUE_DATA as any).hagley;
    ((g.pairs || []) as any[]).forEach((p) => m.gpairs.set('hagley|' + p.bowler + '|' + p.batter, { balls: p.balls, runs: p.runs, outs: p.wkts }));
    cfg.squads.forEach((p) => {
        const pl: any = (DATA.players as any)[p.name];
        if (pl && pl.m) {
            const sr = Number(((pl.line || '').match(/SR\s+([\d.]+)/) || [])[1]);
            if (sr > 0 && pl.avg > 0 && pl.runs > 0) {
                const outs = pl.runs / pl.avg;
                m.bat.set(p.name, { tests: pl.m, inns: 0, runs: pl.runs, balls: Math.round((pl.runs * 100) / sr), outs, cred: outs * 0.95 });
            }
            if (pl.wkts > 0 && pl.bsr > 0) m.bowl.set(p.name, { tests: pl.m, inns: pl.binns || 0, balls: Math.round(pl.bsr * pl.wkts), runs: pl.bruns || 0, wkts: pl.wkts });
        }
        const sq = (g.squad || []).find((s: any) => s.name === p.name);
        if (sq) {
            const bt = (sq.bat || []) as any[]; const bw = (sq.bowl || []) as any[];
            if (bt.length) m.vbat.set('hagley|' + p.name, {
                tests: (sq.matches || []).length, inns: bt.length, runs: bt.reduce((s, e) => s + num(e.runs), 0), balls: bt.reduce((s, e) => s + num(e.balls), 0),
                outs: bt.filter((e) => e.out).length, cred: bt.filter((e) => e.out && !String(e.dismissal || '').startsWith('run out')).length });
            if (bw.length) m.vbowl.set('hagley|' + p.name, { tests: (sq.matches || []).length, inns: bw.length, balls: bw.reduce((s, e) => s + num(e.balls), 0), runs: bw.reduce((s, e) => s + num(e.runs), 0), wkts: bw.reduce((s, e) => s + num(e.wkts), 0) });
        }
    });
    return m;
}

/** Add meetings from the site's matchup data that are newer than `after` (so a Cricsheet file never double counts them). */
function addSiteMeetings(m: Model, after: string) {
    Object.keys(DATA.pairs).forEach((k) => {
        const [, bowler, batter] = k.split('|');
        ((DATA.pairs[k].meetings || []) as any[]).forEach((mt) => {
            if (!mt.tot || (after && mt.date <= after)) return;
            const key = bowler + '|' + batter;
            const x = m.pairs.get(key) || { balls: 0, runs: 0, dots: 0, outs: 0, tests: 0, last: '' };
            x.balls += mt.tot[0]; x.runs += mt.tot[1]; x.dots += mt.tot[2]; x.outs += mt.tot[4]; x.tests += 1;
            if (mt.date > x.last) x.last = mt.date;
            m.pairs.set(key, x);
        });
    });
}

function hagleyFacts(): VenueFacts | null {
    const g: any = (VENUE_DATA as any).hagley;
    if (!g?.outcomes) return null;
    return { tests: (g.matches || []).length, firstAvg: g.meanFirst ? Math.round(g.meanFirst) : null, batFirst: num(g.outcomes.batfirst), chase: num(g.outcomes.batsecond), draws: num(g.outcomes.draw), last: (g.matches?.[0]?.date) || '' };
}

function overlayLive(m: Model) {
    const L: any = LIVE;
    if (!L || L.series !== m.cfg.id) return;
    if (m.dates.includes(L.date) || (!m.dates.length && m.through && L.date <= m.through)) return;   // Cricsheet has the finished Test: drop the live copy
    Object.entries((L.cells || {}) as Record<string, number[]>).forEach(([k, v]) => {
        const x = m.pairs.get(k) || { balls: 0, runs: 0, dots: 0, outs: 0, tests: 0, last: '' };
        x.balls += v[0]; x.runs += v[1]; x.dots += v[2]; x.outs += v[3]; x.tests += 1; if (L.date > x.last) x.last = L.date;
        m.pairs.set(k, x);
    });
    Object.entries((L.vcells || {}) as Record<string, number[]>).forEach(([k, v]) => {
        const x = m.gpairs.get(k) || { balls: 0, runs: 0, outs: 0 };
        m.gpairs.set(k, { balls: x.balls + v[0], runs: x.runs + v[1], outs: x.outs + v[2] });
    });
    m.live = { asOf: L.asOf, balls: L.balls, date: L.date, fixture: L.fixture, venue: L.venue };
}

export function loadModel(cfg: Cfg): Model {
    const grid = (GRIDS as any)[cfg.id];
    let m: Model;
    if (grid) {
        m = fromGrid(cfg, grid);
        if (cfg.id === 'nz-ind') addSiteMeetings(m, m.through);   // the newest Test can be ahead of Cricsheet
    } else if (cfg.id === 'nz-ind') m = fromSite(cfg);
    else m = empty(cfg);
    if (cfg.id === 'nz-ind' && !m.venues.has('hagley')) { const f = hagleyFacts(); if (f) m.venues.set('hagley', f); }
    overlayLive(m);
    return m;
}
