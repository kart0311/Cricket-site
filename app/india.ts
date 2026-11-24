// Typed access to app/indiaData.ts (written by refresh/india.mjs) plus the cricket maths the four screens share.
import { INDIA } from './indiaData';

export const TEAMS: string[] = INDIA.teams;
export const CODE: string[] = INDIA.codes;
export type Inn = [number, number, number, number]; // team, runs, wickets, declared
export interface Test { i: number; n: number; d: string; a: number; b: number; g: number; h: number; res: any; by: [string, number] | null; inns: Inn[]; bb: boolean; ex: boolean }
export interface Ground { i: number; name: string; city: string; country: string; ind: boolean }
// full: every Test he has played is in here. True for India's players (India's Tests are all here) and
// for anyone still playing. False means the database holds only his Tests against India.
export interface Player { i: number; name: string; team: number; bat: string; bowl: string; born: string; last: number; full: boolean }
export type BatRow = [number, number, number, number, number, number, number, number, number]; // match, inn, player, runs, balls, 4s, 6s, kind, bowler
export type BowlRow = [number, number, number, number, number, number, number, number];         // match, inn, player, balls, runs, wkts, maidens, dots

export const TESTS: Test[] = INDIA.tests.map((t: any[], i: number) => ({ i, n: t[0], d: t[1], a: t[2], b: t[3], g: t[4], h: t[5], res: t[6], by: t[7], inns: t[8], bb: !!t[9], ex: !!t[10] }));
export const GROUNDS: Ground[] = INDIA.grounds.map((g: any[], i: number) => ({ i, name: g[0], city: g[1], country: g[2], ind: !!g[3] }));
export const PLAYERS: Player[] = INDIA.players.map((p: any[], i: number) => ({ i, name: p[0], team: p[1], bat: p[2]?.[0] || '', bowl: p[2]?.[1] || '', born: p[3] || '', last: p[4], full: !!p[5] }));
export const BAT: BatRow[] = INDIA.bat;
export const BOWL: BowlRow[] = INDIA.bowl;
export const PAIRS: Record<string, { m: [number, number, string][]; c: [number, number, number, number, number][] }> = INDIA.pairs;
export const GROUND_AGG: Record<string, any> = INDIA.ground;
export const THROUGH: string = INDIA.through;
export const PAIRS_FROM: string = INDIA.pairsFrom;
export const CURRENT_FROM: string = INDIA.currentFrom || '';

const group = <T,>(rows: T[], f: (r: T) => number) => { const m = new Map<number, T[]>(); for (const r of rows) { const k = f(r); let a = m.get(k); if (!a) { a = []; m.set(k, a); } a.push(r); } return m; };
export const batByPlayer = group(BAT, (r) => r[2]);
export const bowlByPlayer = group(BOWL, (r) => r[2]);
export const batByMatch = group(BAT, (r) => r[0]);
export const bowlByMatch = group(BOWL, (r) => r[0]);
export const creditedBy = group(BAT.filter((r) => r[8] >= 0), (r) => r[8]);

// ---------- formatting ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (iso: string) => { const p = iso.split('-'); return `${Number(p[2])} ${MONTHS[Number(p[1]) - 1]} ${p[0]}`; };
export const yearOf = (iso: string) => iso.slice(0, 4);
export const n1 = (x: number) => x.toLocaleString('en-IN');
export const ratio = (a: number, b: number, d = 2) => (b > 0 ? (a / b).toFixed(d) : '–');
export const groundName = (g: number) => { const x = GROUNDS[g]; if (!x) return ''; return x.city && !x.name.includes(x.city) ? `${x.name}, ${x.city}` : x.name; };
export const groundShort = (g: number) => { const x = GROUNDS[g]; return x ? x.name.replace(/ \(.*\)$/, '') : ''; };
export const oppOf = (t: Test) => (t.a === 0 ? t.b : t.a);
export const isIndia = (t: Test) => t.a === 0 || t.b === 0;
export const INNINGS_NAME = ['', '1st innings', '2nd innings', '3rd innings', '4th innings'];

export const innText = (i: Inn) => `${i[1]}${i[2] < 10 ? '/' + i[2] : ''}${i[3] ? 'd' : ''}`;
export function scoreLine(t: Test): string {
    const order: number[] = []; const by = new Map<number, string[]>();
    for (const i of t.inns) { if (!by.has(i[0])) { by.set(i[0], []); order.push(i[0]); } by.get(i[0])!.push(innText(i)); }
    return order.map((tm) => `${CODE[tm]} ${by.get(tm)!.join(' & ')}`).join(' · ');
}
export function resultText(t: Test): string {
    const r = t.res;
    if (r === 'draw') return 'Match drawn';
    if (r === 'tie') return 'Match tied';
    if (r === 'other') return 'No result';
    const by = t.by ? (t.by[0] === 'i' ? `an innings and ${t.by[1]} runs` : t.by[0] === 'r' ? `${t.by[1]} run${t.by[1] === 1 ? '' : 's'}` : `${t.by[1]} wicket${t.by[1] === 1 ? '' : 's'}`) : '';
    return `${TEAMS[r]} won${by ? ' by ' + by : ''}`;
}
export const isHome = (t: Test) => t.h === 0 || (t.h === -2 && GROUNDS[t.g]?.country === 'India');
export const winnerOf = (t: Test): number => (typeof t.res === 'number' ? t.res : -1);
export const testLabel = (t: Test) => `${CODE[t.a]} Vs ${CODE[t.b]}`;

// ---------- dismissals ----------
export const KIND_NAME: Record<string, string> = { c: 'caught', b: 'bowled', l: 'lbw', s: 'stumped', k: 'caught and bowled', h: 'hit wicket', r: 'run out', o: 'other' };
export const CODE_LETTER = ['', 'c', 'b', 'l', 's', 'r', 'h', 'k', 'o'];
export const CODE_NAME = ['not out', 'caught', 'bowled', 'lbw', 'stumped', 'run out', 'hit wicket', 'caught and bowled', 'other'];
export const CREDITED_LETTERS = new Set(['c', 'b', 'l', 's', 'h', 'k']);
export function fmtKinds(k: Record<string, number>): string {
    return Object.entries(k).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${KIND_NAME[l] || l} ${n}`).join(' · ');
}

// ---------- ball-by-ball strings ----------
export interface Ball { runs: number; nb: boolean; bye: boolean; lb: boolean; kind: string }
export interface Over { over: number; balls: Ball[] }
export function parseBalls(s: string): Over[] {
    return s.split(';').map((chunk) => {
        const c = chunk.indexOf(':');
        return {
            over: Number(chunk.slice(0, c)),
            balls: chunk.slice(c + 1).split(',').map((code) => {
                const w = code.indexOf('W');
                const head = w < 0 ? code : code.slice(0, w);
                return { runs: Number(head[0]), nb: head.includes('n'), bye: head.includes('b'), lb: head.includes('l'), kind: w < 0 ? '' : code.slice(w + 1) };
            }),
        };
    });
}
export interface PairStats { balls: number; runs: number; dots: number; fours: number; sixes: number; outs: number; kinds: Record<string, number> }
export const emptyStats = (): PairStats => ({ balls: 0, runs: 0, dots: 0, fours: 0, sixes: 0, outs: 0, kinds: {} });
export function addStats(s: PairStats, overs: Over[]) {
    for (const o of overs) for (const b of o.balls) {
        s.balls++; s.runs += b.runs;
        if (b.runs === 0 && !b.bye && !b.lb) s.dots++;
        if (b.runs === 4) s.fours++;
        if (b.runs === 6) s.sixes++;
        if (b.kind && CREDITED_LETTERS.has(b.kind)) { s.outs++; s.kinds[b.kind] = (s.kinds[b.kind] || 0) + 1; }
    }
}
export function ballToken(b: Ball): { tok: string; out: boolean; aria: string } {
    if (b.kind) {
        const credited = CREDITED_LETTERS.has(b.kind);
        return { tok: 'W', out: true, aria: `${KIND_NAME[b.kind] || 'out'}${credited ? '' : ' (not credited to the bowler)'}${b.runs ? ' plus ' + b.runs : ''}` };
    }
    let tok = b.runs ? String(b.runs) : '.';
    const words: string[] = [];
    if (b.bye) { tok = b.runs ? tok : 'b'; words.push('bye'); }
    if (b.lb) { tok = b.runs ? tok : 'lb'; words.push('leg bye'); }
    if (b.nb) { tok = b.runs ? tok + 'nb' : 'nb'; words.push('no-ball'); }
    return { tok, out: false, aria: b.runs || words.length ? [b.runs ? `${b.runs} run${b.runs === 1 ? '' : 's'}` : '', ...words].filter(Boolean).join(' plus ') : 'dot ball' };
}

// ---------- batting and bowling aggregates ----------
export function batAgg(rows: BatRow[]) {
    let inns = rows.length, no = 0, runs = 0, hs = -1, hsNo = false, h = 0, f = 0, ducks = 0, balls = 0, ballsRuns = 0, fours = 0, sixes = 0;
    const tests = new Set<number>();
    for (const r of rows) {
        tests.add(r[0]); runs += r[3];
        if (r[7] === 0) no++;
        if (r[3] > hs || (r[3] === hs && r[7] === 0)) { hs = r[3]; hsNo = r[7] === 0; }
        if (r[3] >= 100) h++; else if (r[3] >= 50) f++;
        if (r[3] === 0 && r[7] > 0) ducks++;
        if (r[4] >= 0) { balls += r[4]; ballsRuns += r[3]; }
        if (r[5] > 0) fours += r[5]; if (r[6] > 0) sixes += r[6];
    }
    return { tests: tests.size, inns, no, runs, hs: hs < 0 ? 0 : hs, hsNo, avg: ratio(runs, inns - no), sr: balls ? (100 * ballsRuns / balls).toFixed(1) : '–', h, f, ducks, fours, sixes };
}
export function bowlAgg(rows: BowlRow[]) {
    let balls = 0, runs = 0, wkts = 0, md = 0, w5 = 0, bw = 0, br = 0;
    const tests = new Set<number>(); const perTest = new Map<number, number>();
    for (const r of rows) {
        tests.add(r[0]); balls += r[3]; runs += r[4]; wkts += r[5]; md += r[6];
        perTest.set(r[0], (perTest.get(r[0]) || 0) + r[5]);
        if (r[5] >= 5) w5++;
        if (r[5] > bw || (r[5] === bw && r[4] < br)) { bw = r[5]; br = r[4]; }
    }
    let w10 = 0; for (const v of perTest.values()) if (v >= 10) w10++;
    const overs = `${Math.floor(balls / 6)}${balls % 6 ? '.' + (balls % 6) : ''}`;
    return { tests: tests.size, inns: rows.length, balls, overs, runs, wkts, maidens: md, w5, w10, best: bw ? `${bw}/${br}` : '–', avg: ratio(runs, wkts), econ: ratio(runs * 6, balls), sr: ratio(balls, wkts, 1) };
}
export function kindCounts(rows: BatRow[]): number[] { const c = new Array(9).fill(0); for (const r of rows) if (r[7] > 0) c[r[7]]++; return c; }

// ---------- bowling and batting styles ----------
// Groups a player's recorded bowling style into the kinds a reader thinks in.
// Order here is the order the bars are drawn in.
export const BOWL_KINDS: [string, string][] = [
    ['rf', 'Right-arm fast'],
    ['rm', 'Right-arm medium'],
    ['lf', 'Left-arm fast'],
    ['lm', 'Left-arm medium'],
    ['off', 'Off spin'],
    ['leg', 'Leg spin'],
    ['sla', 'Left-arm spin'],
    ['law', 'Left-arm wrist spin'],
    ['?', 'Not known'],
];
export const BOWL_KIND_NAME: Record<string, string> = Object.fromEntries(BOWL_KINDS);
export function bowlKind(style: string): string {
    const s = (style || '').toLowerCase();
    if (!s) return '?';
    if (s.includes('wrist-spin') || s.includes('wrist spin')) return s.includes('left') ? 'law' : 'leg';
    if (s.includes('legbreak') || s.includes('leg break') || s.includes('googly')) return 'leg';
    if (s.includes('offbreak') || s.includes('off break') || s.includes('offspin')) return 'off';
    if (s.includes('orthodox') || (s.includes('left') && s.includes('slow'))) return 'sla';
    const left = s.includes('left');
    if (s.includes('medium-fast')) return left ? 'lm' : 'rm';    // medium-fast sits with medium
    if (s.includes('fast')) return left ? 'lf' : 'rf';           // fast and fast-medium
    if (s.includes('medium')) return left ? 'lm' : 'rm';
    return '?';
}
export const isSpinKind = (k: string) => k === 'off' || k === 'leg' || k === 'sla' || k === 'law';
export const batHand = (style: string) => (style === 'LHB' ? 'Left-hand bat' : style === 'RHB' ? 'Right-hand bat' : 'Not known');

// ---------- players ----------
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z ]/g, '').trim();
export function findPlayer(name: string, team?: number): number | null {
    const n = norm(name); const parts = n.split(' '); const sur = parts[parts.length - 1]; const ini = parts[0][0];
    let best: Player | null = null;
    for (const p of PLAYERS) {
        if (team !== undefined && p.team !== team) continue;
        const pn = norm(p.name); const pp = pn.split(' ');
        const hit = pn === n || (pp[pp.length - 1] === sur && pp[0][0] === ini);
        if (hit && (!best || p.last > best.last)) best = p;
    }
    return best ? best.i : null;
}
export function playerSpan(p: number): [string, string] | null {
    let lo = Infinity, hi = -1;
    for (const r of batByPlayer.get(p) || []) { lo = Math.min(lo, r[0]); hi = Math.max(hi, r[0]); }
    for (const r of bowlByPlayer.get(p) || []) { lo = Math.min(lo, r[0]); hi = Math.max(hi, r[0]); }
    return hi < 0 ? null : [TESTS[lo].d, TESTS[hi].d];
}
