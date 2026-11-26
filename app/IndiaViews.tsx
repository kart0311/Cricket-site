// The four India-wide screens: Player matchup, Country matchup, Player analysis, Ground analysis.
// Every number is computed here from app/indiaData.ts (see india.ts); nothing is typed in by hand.
import React, { useEffect, useMemo, useState } from 'react';
import { onGo, go } from './nav';
import { countryView } from './countryLabels';
import { Badge, Info, MiniBars, ResultStrip, type Tone } from './charts';
import { makeCard, saveCard } from './shareCard';
import { groundInfo } from './groundInfo';
import photosJson from './stadiumPhotos.generated.json';
import NZ_IND_CFG from '../refresh/series/nz-ind.json';
import IND_AUS_CFG from '../refresh/series/ind-aus.json';
const PHOTOS = photosJson as unknown as Record<string, { file: string; author: string; license: string; page: string }>;
import {
    BAT, BOWL, CODE, CODE_LETTER, CODE_NAME, GROUNDS, GROUND_AGG, INNINGS_NAME, PAIRS, PAIRS_FROM, PLAYERS, TEAMS, TESTS,
    BOWL_KINDS, KIND_NAME, CREDITED_LETTERS, addStats, ballToken, batAgg, batByMatch, batByPlayer, batHand, bowlAgg, bowlByMatch, bowlByPlayer, bowlKind, creditedBy, emptyStats, fmtDate, fmtKinds, isSpinKind,
    groundName, groundShort, isHome, isIndia, kindCounts, n1, oppOf, parseBalls, playerSpan, ratio, resultText, scoreLine, winnerOf, yearOf,
    type BatRow, type BowlRow, type Over, type PairStats, type Test,
} from './india';

const pname = (i: number) => PLAYERS[i].name;
const sur = (p: number) => PLAYERS[p].name.split(' ').slice(-1)[0];
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
// Which side a player is on, for colour: India's players or the opposition's.
const toneOf = (p: number | null): Tone | undefined => (p == null ? undefined : PLAYERS[p].team === 0 ? 'ind' : 'opp');
const plabel = (i: number) => `${PLAYERS[i].name} (${CODE[PLAYERS[i].team]})`;
const plural = (n: number, w: string, ws?: string) => `${n1(n)} ${n === 1 ? w : ws || w + 's'}`;

// Stat tiles. The row carries how many tiles it holds, so the stylesheet can pick a column count that
// fits them instead of squeezing every tile onto one line.
function Tiles({ rows, cls = '' }: { rows: [string, string | number, Tone?][]; cls?: string }) {
    const n = Math.min(rows.length, 10);
    return <div className={`crx-stats crx-tiles crx-tiles${n} ${cls}`.trim()}>{rows.map(([l, v, tone]) =>
        <div key={l} className={'crx-stat' + (tone ? ' crx-st-' + tone : '')}><div className="crx-statv">{v}</div><div className="crx-statl">{l}</div></div>)}</div>;
}
function Pills({ label, items, value, onChange, cls }: { label: string; items: [string, string][]; value: string; onChange: (v: string) => void; cls: string }) {
    return <div className={'crx-viewtoggle ' + cls} role="group" aria-label={label}>{items.map(([id, l]) =>
        <button key={id} type="button" aria-pressed={value === id} className={'crx-pill' + (value === id ? ' crx-pillon' : '')} onClick={() => onChange(id)}>{l}</button>)}</div>;
}
function MoreToggle({ open, onToggle, what = 'detail' }: { open: boolean; onToggle: () => void; what?: string }) {
    return <button type="button" className="crx-moretoggle" aria-expanded={open} onClick={onToggle}>{open ? 'Show less' : 'Show more ' + what}<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>;
}
function Fold({ label, note, children, cls = '' }: { label: string; note?: string; children: any; cls?: string }) {
    return <details className={'crx-pa-fold ' + cls}><summary>{label}{note && <em>{note}</em>}</summary>{children}</details>;
}
// each kind of section gets its own colour, picked from the heading text
const secColour = (t: string) => /out\b|wickets fall|takes wickets|gets out|dismiss/i.test(t) ? 'rose' : /result|tests ·|meetings|india here/i.test(t) ? 'gold' : /score|total/i.test(t) ? 'sky' : /top|most/i.test(t) ? 'sage' : 'plum';
const Label = ({ children, info }: { children: any; info?: any }) => { const txt = [].concat(children).map((c: any) => typeof c === 'string' ? c : '').join(' '); return <div className={'crx-filterlabel crx-sec crx-c-' + secColour(txt)}><i aria-hidden="true" />{children}{info && <Info>{info}</Info>}</div>; };
const Hint = ({ children }: { children: any }) => <p className="crx-hint">{children}</p>;
// whole-number percentages that add up to exactly 100 (largest remainder)
function pcts(ns: number[]): number[] {
    const t = ns.reduce((a, b) => a + b, 0) || 1; const raw = ns.map((n) => 100 * n / t); const fl = raw.map(Math.floor);
    let left = 100 - fl.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0 && ns[i] > 0) { fl[i]++; left--; } });
    return fl;
}
function Bars({ rows, tone }: { rows: [string, number][]; tone?: Tone }) {
    const shown = rows.filter((r) => r[1] > 0); const total = rows.reduce((a, r) => a + r[1], 0) || 1; const pc = pcts(shown.map((r) => r[1]));
    return <div className={'crx-hg-bars' + (tone ? ' crx-t-' + tone : '')}>{shown.map(([l, n], i) =>
        <div className="crx-hg-bar" key={l}><span className="crx-hg-barname">{l}</span><span className="crx-hg-bartrack" aria-hidden="true"><i style={{ width: Math.max(2, Math.round(100 * n / total)) + '%' }} /></span><span className="crx-hg-barnum">{n1(n)} · {pc[i]}%</span></div>)}</div>;
}
function ShowMore({ open, onToggle, total, shown, what }: { open: boolean; onToggle: () => void; total: number; shown: number; what: string }) {
    if (total <= shown) return null;
    return <button type="button" className="crx-pa-more-btn" aria-expanded={open} onClick={onToggle}>{open ? `Show fewer ${what}` : `Show all ${n1(total)} ${what}`}</button>;
}
function TestRow({ t, vs }: { t: Test; vs?: boolean }) {
    return <div className="crx-meet">
        <div className="crx-meethead"><span className="crx-meetlabel"><span className="crx-meetdate">{fmtDate(t.d)}</span><span className="crx-meetvenue">{vs && <><Badge team={t.a} /> v <Badge team={t.b} />{' · '}</>}{groundShort(t.g)}</span></span></div>
        <div className="crx-meetline crx-matchres">{resultText(t)}</div>
        <div className="crx-scoreline">{scoreLine(t) || 'Scores not recorded'}</div>
    </div>;
}

// ============================================================ Player matchup
const PAIR_LIST: [number, number][] = Object.keys(PAIRS).map((k) => k.split(',').map(Number) as [number, number]);
const BY_BOWLER = new Map<number, Map<number, number>>(); const BY_BATTER = new Map<number, Map<number, number>>();
for (const [b, t] of PAIR_LIST) {
    const n = PAIRS[b + ',' + t]; const c = new Set([...n.m.map((x) => x[0]), ...n.c.map((x) => x[0])]).size;
    if (!BY_BOWLER.has(b)) BY_BOWLER.set(b, new Map()); BY_BOWLER.get(b)!.set(t, c);
    if (!BY_BATTER.has(t)) BY_BATTER.set(t, new Map()); BY_BATTER.get(t)!.set(b, c);
}
const WINDOW = TESTS.filter((t) => isIndia(t) && t.d >= PAIRS_FROM);

export function MatchupCoverage() {
    const ballsTests = WINDOW.filter((t) => t.bb).length;
    return <>India's Tests since {fmtDate(PAIRS_FROM)}: {WINDOW.length} Tests. Ball-by-ball detail exists for {ballsTests} of them; for the rest you see who got whom out and how.</>;
}

// the most-played duels, one per bowler and one per batter, for the home page
let POPULAR: [number, number, number][] | null = null;
export function popularDuels(): [number, number, number][] {
    if (!POPULAR) {
        const all = Object.entries(PAIRS).map(([k, v]: [string, any]) => { const [b, t] = k.split(',').map(Number); return [b, t, v.m.length + v.c.length] as [number, number, number]; }).sort((x, y) => y[2] - x[2]);
        const out: [number, number, number][] = []; const ub = new Set<number>(), ut = new Set<number>();
        for (const r of all) { if (ub.has(r[0]) || ut.has(r[1])) continue; ub.add(r[0]); ut.add(r[1]); out.push(r); if (out.length === 6) break; }
        POPULAR = out;
    }
    return POPULAR;
}
export const duelName = (i: number) => sur(i);
export const plabelOf = (i: number) => plabel(i);
export const HOME_PLAYERS = () => HAS_ROWS;
export const HOME_GROUNDS = () => GROUND_IDS;
export const HOME_TEAMS = () => OPPONENTS;

export function IndiaMatchup({ Selector }: any) {
    const [open, setOpen] = useState<string | null>(null);
    const [bowler, setBowler] = useState<number | null>(null);
    const [batter, setBatter] = useState<number | null>(null);
    useEffect(() => onGo((d) => { if (d.kind === 'duel') { setBowler(d.value[0]); setBatter(d.value[1]); setGround(-1); setInn('all'); setAll(false); } }), []);
    const [ground, setGround] = useState(-1);
    const [inn, setInn] = useState('all');
    const [all, setAll] = useState(false);
    const [more, setMore] = useState<string | null>(null);
    const [making, setMaking] = useState(false);
    const toggle = (id: string) => setOpen(open === id ? null : id);
    const reset = () => { setGround(-1); setInn('all'); setAll(false); setMore(null); setOpen(null); };
    const opts = (ids: number[], other: Map<number, Map<number, number>>, partner: number | null) => {
        const list = ids.slice().sort((a, b) => partner != null ? (other.get(partner)!.get(b)! - other.get(partner)!.get(a)!) || pname(a).localeCompare(pname(b)) : pname(a).localeCompare(pname(b)));
        return list.map((i) => ({ value: i, label: plabel(i), searchText: PLAYERS[i].name + ' ' + TEAMS[PLAYERS[i].team] }));
    };
    const bowlerOpts = useMemo(() => opts(batter != null ? [...BY_BATTER.get(batter)!.keys()] : [...BY_BOWLER.keys()], BY_BATTER, batter), [batter]);
    const batterOpts = useMemo(() => opts(bowler != null ? [...BY_BOWLER.get(bowler)!.keys()] : [...BY_BATTER.keys()], BY_BOWLER, bowler), [bowler]);
    const pair = bowler != null && batter != null ? PAIRS[bowler + ',' + batter] : null;
    const meets = useMemo(() => {
        if (!pair) return [];
        const out: { m: number; inn: number; over?: Over[]; card?: [number, number, number] }[] = [];
        for (const [m, i, s] of pair.m) out.push({ m, inn: i, over: parseBalls(s) });
        for (const [m, i, kind, runs, balls] of pair.c) out.push({ m, inn: i, card: [kind, runs, balls] });
        return out.sort((a, b) => b.m - a.m || b.inn - a.inn);
    }, [pair]);
    const shown = meets.filter((x) => (ground < 0 || TESTS[x.m].g === ground) && (inn === 'all' || String(x.inn) === inn));
    const stats: PairStats = emptyStats(); let cardOuts = 0;
    for (const x of shown) {
        if (x.over) addStats(stats, x.over);
        else if (x.card && x.card[0] > 0) { cardOuts++; const l = CODE_LETTER[x.card[0]]; if (l && 'cblshk'.includes(l)) { stats.outs++; stats.kinds[l] = (stats.kinds[l] || 0) + 1; } }
    }
    const tests = new Set(shown.map((x) => x.m)).size;
    const hasCard = shown.some((x) => x.card);
    const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    const howRows: [string, number][] = Object.entries(stats.kinds).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([l, n]) => [cap(KIND_NAME[l] || l), n]);
    // every dismissal in the current selection, newest first: how, when, where
    const dismissals: { key: string; date: string; place: string; how: string; note: string }[] = [];
    for (const x of shown) {
        const t = TESTS[x.m]; const place = `${groundShort(t.g)} · ${INNINGS_NAME[x.inn]}`;
        if (x.over) {
            let faced = 0, scored = 0;
            for (const o of x.over) for (const b of o.balls) {
                faced++; if (b.kind && CREDITED_LETTERS.has(b.kind)) dismissals.push({ key: `${x.m}-${x.inn}-${o.over}-${faced}`, date: fmtDate(t.d), place, how: cap(KIND_NAME[b.kind] || b.kind), note: `Over ${o.over} · ${faced === 1 ? 'first ball from him' : `after ${scored} ${scored === 1 ? 'run' : 'runs'} off ${faced - 1} balls from him`}` });
                scored += b.runs;
            }
        } else if (x.card && x.card[0] > 0) {
            const l = CODE_LETTER[x.card[0]];
            if (l && CREDITED_LETTERS.has(l)) dismissals.push({ key: `${x.m}-${x.inn}-c`, date: fmtDate(t.d), place, how: cap(CODE_NAME[x.card[0]]), note: `Out for ${x.card[1]}${x.card[2] >= 0 ? ` off ${x.card[2]} balls` : ''} in the innings` });
        }
    }
    // Runs the batter scored in each meeting that has ball-by-ball detail, oldest first; a dot marks a dismissal.
    const verdict = (() => {
        if (bowler == null || batter == null || (stats.balls === 0 && stats.outs === 0)) return null;
        const B = sur(bowler), T = sur(batter); let line: string;
        if (stats.balls > 0) {
            const sr = ratio(stats.runs * 100, stats.balls, 0);
            line = stats.outs > 0
                ? (hasCard ? `${B} has dismissed ${T} ${times(stats.outs)}. In the ${plural(stats.balls, 'ball')} with ball-by-ball detail, ${T} scored ${n1(stats.runs)} runs.`
                    : `${B} has dismissed ${T} ${times(stats.outs)} in ${plural(stats.balls, 'ball')}${stats.outs > 1 ? `, about once every ${Math.round(stats.balls / stats.outs)} balls` : ''}. ${T} scored ${n1(stats.runs)} runs at a strike rate of ${sr}.`)
                : `${B} has not dismissed ${T} in ${plural(stats.balls, 'ball')}. ${T} scored ${n1(stats.runs)} runs at a strike rate of ${sr}.`;
        } else line = `${B} has dismissed ${T} ${times(stats.outs)}. These meetings have scorecard detail only, with no ball-by-ball record.`;
        return { line, small: stats.balls > 0 && stats.balls < 30 ? `Only ${plural(stats.balls, 'ball')} on record, so take this lightly.` : '' };
    })();
    const meetBars = shown.filter((x) => x.over).slice().reverse().map((x) => {
        const o = emptyStats(); addStats(o, x.over!); const t = TESTS[x.m];
        return { v: o.runs, out: o.outs > 0, label: `${fmtDate(t.d)} · ${INNINGS_NAME[x.inn]}: ${o.runs} off ${o.balls}${o.outs ? ', dismissed' : ''}` };
    });
    const downloadCard = async () => {
        if (bowler == null || batter == null || making) return;
        setMaking(true);
        try {
            const yrs: [number, number] | null = shown.length ? [yearOf(TESTS[shown[shown.length - 1].m].d), yearOf(TESTS[shown[0].m].d)] : null;
            const filt = [ground >= 0 ? groundShort(ground) : '', inn !== 'all' ? INNINGS_NAME[Number(inn)] : ''].filter(Boolean).join(' · ');
            const rows = shown.slice(0, 8).map((x) => {
                const t = TESTS[x.m]; let line = ''; let out = false;
                if (x.over) { const o = emptyStats(); addStats(o, x.over); out = o.outs > 0; line = `${plural(o.runs, 'run')} off ${plural(o.balls, 'ball')}${out ? ', dismissed' : ''}`; }
                else if (x.card) { const [k, r, b] = x.card; out = k > 0; line = k > 0 ? `Dismissed for ${r}${b >= 0 ? ` off ${b} balls` : ''}` : `Not out, ${r}${b >= 0 ? ` off ${b} balls` : ''}`; }
                return { date: fmtDate(t.d), place: `${groundShort(t.g)} · ${INNINGS_NAME[x.inn]}`, line, out };
            });
            const blob = await makeCard({
                bowler: PLAYERS[bowler].name, bowlerTeam: CODE[PLAYERS[bowler].team], bowlerTone: toneOf(bowler) as 'ind' | 'opp',
                batter: PLAYERS[batter].name, batterTeam: CODE[PLAYERS[batter].team], batterTone: toneOf(batter) as 'ind' | 'opp',
                sub: `${plural(tests, 'Test')}${yrs ? ' · ' + (yrs[0] === yrs[1] ? yrs[0] : yrs[0] + ' to ' + yrs[1]) : ''}${filt ? ' · ' + filt : ''}${hasCard ? ' · some scorecard only' : ''}`,
                verdict: verdict ? verdict.line : '', caveat: verdict ? verdict.small : '',
                tiles: [[n1(stats.balls), 'Balls'], [n1(stats.runs), stats.runs === 1 ? 'Run' : 'Runs'], [String(stats.outs), stats.outs === 1 ? 'Dismissal' : 'Dismissals'], [String(tests), tests === 1 ? 'Test' : 'Tests']],
                howOut: howRows.map(([label, n]) => ({ label, n })),
                smalls: stats.balls > 0 ? [[String(ratio(stats.runs * 100, stats.balls, 1)), 'Strike rate'], [Math.round(100 * stats.dots / stats.balls) + '%', 'Dot balls'], [String(stats.fours), 'Fours'], [String(stats.sixes), 'Sixes']] : null,
                bars: meetBars.map((b) => ({ v: b.v, out: b.out })), years: yrs, rows, site: 'kart0311.github.io/Cricket-site',
            });
            await saveCard(blob, `${sur(bowler)}-to-${sur(batter)}.jpg`.toLowerCase());
        } catch (e) { console.error(e); } finally { setMaking(false); }
    };
    const groundOpts = useMemo(() => {
        const gs = [...new Set(meets.map((x) => TESTS[x.m].g))];
        return [{ value: -1, label: 'All grounds' }, ...gs.map((g) => ({ value: g, label: groundName(g), searchText: groundName(g) })).sort((a, b) => a.label.localeCompare(b.label))];
    }, [meets]);
    const innOpts = useMemo(() => [{ value: 'all', label: 'All innings' }, ...[...new Set(meets.map((x) => x.inn))].sort().map((i) => ({ value: String(i), label: INNINGS_NAME[i] }))], [meets]);
    const groundLabel = ground < 0 ? 'All grounds' : groundShort(ground);
    const innLabel = inn === 'all' ? 'all innings' : INNINGS_NAME[Number(inn)];
    const chooseBowler = (v: number | null) => { setBowler(v); if (v != null && batter != null && !BY_BOWLER.get(v)?.has(batter)) setBatter(null); reset(); };
    const chooseBatter = (v: number | null) => { setBatter(v); if (v != null && bowler != null && !BY_BATTER.get(v)?.has(bowler)) setBowler(null); reset(); };
    return countryView(<div>
        <div className="crx-pair">
            <Selector half tone={toneOf(bowler)} label="Bowler" value={bowler} open={open === 'bowler'} placeholder="Pick a player" title="Bowler" onToggle={() => toggle('bowler')} onChange={(v: number | null) => { chooseBowler(v); }} sort={false}
                options={[...(bowler != null ? [{ value: null, label: 'Pick a player' }] : []), ...bowlerOpts]} />
            <Selector half tone={toneOf(batter)} label="Batter" value={batter} open={open === 'batter'} placeholder="Pick a player" title="Batter" onToggle={() => toggle('batter')} onChange={(v: number | null) => { chooseBatter(v); }} sort={false}
                options={[...(batter != null ? [{ value: null, label: 'Pick a player' }] : []), ...batterOpts]} />
        </div>
        {!pair && <Quick title="Famous duels" items={popularDuels().map(([b, t, n]) => ({ key: b + '-' + t, label: <><span className="crx-qb">{sur(b)}</span> <em>to</em> <span className="crx-qt">{sur(t)}</span><small>{n}</small></>, on: bowler === b && batter === t, go: () => { setBowler(b); setBatter(t); setGround(-1); setInn('all'); setAll(false); } }))} />}
        {!pair && <Hint>{bowler != null ? 'Now pick a batter.' : batter != null ? 'Now pick a bowler.' : 'Pick a bowler and a batter. One side is always an Indian player, the other from the opposition.'}</Hint>}
        {pair && <Fold label="Filters" note={`${groundLabel} · ${innLabel}`} cls="crx-filters">
            <div className="crx-pair">
                <Selector half label="Ground" value={ground} options={groundOpts} sort={false} open={open === 'ground'} onToggle={() => toggle('ground')} onChange={(v: number) => { setGround(v); setOpen(null); setAll(false); }} />
                <Selector half label="Innings" value={inn} options={innOpts} sort={false} open={open === 'inn'} onToggle={() => toggle('inn')} onChange={(v: string) => { setInn(v); setOpen(null); setAll(false); }} />
            </div>
            {(ground >= 0 || inn !== 'all') && <div className="crx-filterrow"><button type="button" className="crx-reset" onClick={() => { setGround(-1); setInn('all'); setOpen(null); }}>Reset filters</button></div>}
        </Fold>}
        {pair && shown.length === 0 && <div className="crx-note"><div className="crx-notetitle">No data available</div><div className="crx-notebody">No recorded meeting for this selection. Try widening the filters.</div></div>}
        {pair && shown.length > 0 && <>
            <div className="crx-hero crx-hero-dl"><button type="button" className="crx-dl" onClick={downloadCard} disabled={making} aria-label="Save this matchup as a picture to share"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{making ? 'Making…' : 'Save picture'}</span></button><div className="crx-heroname"><span className={'crx-nm crx-t-' + toneOf(bowler)}>{pname(bowler!)}</span> to <span className={'crx-nm crx-t-' + toneOf(batter)}>{pname(batter!)}</span></div><div className="crx-herosub">{groundLabel} · {innLabel}{hasCard && <Info>Balls and runs come from Tests with ball-by-ball data only. Dismissals include every Test since {fmtDate(PAIRS_FROM)}.</Info>}</div></div>
            {verdict && <p className="crx-verdict crx-noabbr">{verdict.line}{verdict.small && <em className="crx-caveat"> {verdict.small}</em>}</p>}
            <div className="crx-split"><div className="crx-col">
            <Tiles rows={[['Balls', n1(stats.balls)], [stats.runs === 1 ? 'Run' : 'Runs', n1(stats.runs)], [stats.outs === 1 ? 'Dismissal' : 'Dismissals', stats.outs], [tests === 1 ? 'Test' : 'Tests', tests]]} />
            {stats.outs > 0
                ? <div className="crx-howout">
                    <Label>How {sur(bowler!)} got {sur(batter!)} out</Label>
                    <Bars rows={howRows} tone={toneOf(bowler)} />
                    <Fold label="Each dismissal" note={String(dismissals.length)} cls="crx-dismissals">
                        <div className="crx-dlist">{dismissals.map((d) => <div className="crx-dis" key={d.key}>
                            <div className="crx-dishead"><b>{d.date}</b><span className={'crx-diskind crx-t-' + toneOf(bowler)}>{d.how}</span></div>
                            <div className="crx-displace">{d.place}</div>
                            <div className="crx-disnote">{d.note}</div>
                        </div>)}</div>
                    </Fold>
                </div>
                : <div className="crx-outkinds"><span>{stats.balls ? `Not dismissed in ${plural(stats.balls, 'ball')}` : 'No dismissals'}</span></div>}
            {meetBars.length > 1 && <MiniBars items={meetBars} tone={toneOf(batter)} title="Runs in each meeting" note="dot = dismissed" foot={[yearOf(TESTS[shown[shown.length - 1].m].d), yearOf(TESTS[shown[0].m].d)]} />}
            {stats.balls > 0 && <Fold label="More numbers" cls="crx-morenums crx-extra">
                <Tiles rows={[['Strike rate', ratio(stats.runs * 100, stats.balls, 1)], ['Dots', stats.dots], ['Dot %', Math.round(100 * stats.dots / stats.balls) + '%'], ['Fours', stats.fours], ['Sixes', stats.sixes], ['Runs per out', stats.outs ? ratio(stats.runs, stats.outs, 1) : '–']]} />
            </Fold>}
            </div><div className="crx-col">
            <Label>Meetings · newest first</Label>
            <div className="crx-meets">{(all ? shown : shown.slice(0, 4)).map((x) => {
                const t = TESTS[x.m]; const key = x.m + '-' + x.inn; let line = '';
                if (x.over) { const s = emptyStats(); addStats(s, x.over); line = `${plural(s.balls, 'ball')} · ${plural(s.runs, 'run')} · ${plural(s.outs, 'dismissal')}`; }
                else if (x.card) { const [k, r, b] = x.card; line = `Dismissed him for ${r}${b >= 0 ? ` (${b} balls)` : ''} · ${CODE_NAME[k]}`; }
                return <div className="crx-meet" key={key}>
                    <div className="crx-meethead"><span className="crx-meetlabel"><span className="crx-meetdate">{fmtDate(t.d)}</span><span className="crx-meetvenue">{groundShort(t.g)} · {INNINGS_NAME[x.inn]}</span></span></div>
                    <div className="crx-meetline">{line}</div>
                    {x.over && <>
                        <button type="button" className="crx-ctabmorebtn crx-delbtn" onClick={() => setMore(more === key ? null : key)}>{more === key ? 'Hide ball by ball −' : 'Ball by ball +'}</button>
                        {more === key && <div className="crx-ov">{x.over.map((o) => <div className="crx-ovrow" key={o.over}><span className="crx-ovn">Over {o.over}</span><span className="crx-ovballs">{o.balls.map((b, i) => { const k = ballToken(b); return <span key={i} className={'crx-ovb' + (k.out ? ' crx-ovout' : '')} aria-label={k.aria}>{k.tok}</span>; })}</span></div>)}</div>}
                    </>}
                </div>;
            })}</div>
            <ShowMore open={all} onToggle={() => setAll(!all)} total={shown.length} shown={4} what="meetings" />
            </div></div>
        </>}
    </div>);
}


// One row of quick picks under each picker, the same on every screen.
function Quick({ title, items, on }: { title: string; items: { key: string; label: React.ReactNode; on: boolean; go: () => void }[]; on?: undefined }) {
    if (!items.length) return null;
    return <div className="crx-pop"><div className="crx-poptitle">{title}</div><div className="crx-poprow">{items.map((it) => <button type="button" key={it.key} className={'crx-popbtn' + (it.on ? ' crx-popon' : '')} aria-pressed={it.on} onClick={it.go}>{it.label}</button>)}</div></div>;
}
let POP_PLAYERS: number[] | null = null;
function popularPlayers(): number[] {
    if (!POP_PLAYERS) {
        const n = new Map<number, number>();
        for (const [k, v] of Object.entries(PAIRS) as [string, any][]) { const [b, t] = k.split(',').map(Number); const c = v.m.length + v.c.length; n.set(b, (n.get(b) || 0) + c); n.set(t, (n.get(t) || 0) + c); }
        const ok = new Set(HAS_ROWS.map((x) => x.i));
        POP_PLAYERS = [...n.entries()].filter(([i]) => ok.has(i)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([i]) => i);
    }
    return POP_PLAYERS;
}

// ============================================================ Country matchup
const OPPONENTS = (() => {
    const n = new Map<number, number>(); for (const t of TESTS) if (isIndia(t)) n.set(oppOf(t), (n.get(oppOf(t)) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o);
})();
const LAST_OPP = oppOf([...TESTS].reverse().find(isIndia)!);

export function IndiaCountry({ Selector }: any) {
    const [opp, setOpp] = useState<number>(LAST_OPP);
    useEffect(() => onGo((d) => { if (d.kind === 'team') setOpp(d.value); }), []);
    const [where, setWhere] = useState('all');
    const [open, setOpen] = useState(false);
    const [all, setAll] = useState(false);
    const [lead, setLead] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const allTests = useMemo(() => TESTS.filter((t) => isIndia(t) && oppOf(t) === opp), [opp]);
    const tests = allTests.filter((t) => where === 'all' || (where === 'home' ? isHome(t) : !isHome(t)));
    const list = tests.slice().reverse();
    const won = tests.filter((t) => winnerOf(t) === 0).length; const lost = tests.filter((t) => winnerOf(t) === opp).length;
    const drawn = tests.filter((t) => t.res === 'draw').length; const tied = tests.filter((t) => t.res === 'tie').length;
    const totals = (team: number) => {
        let hi: [number, Test] | null = null; let lo: [number, Test] | null = null;
        for (const t of tests) for (const i of t.inns) if (i[0] === team) {
            if (!hi || i[1] > hi[0]) hi = [i[1], t];
            if (i[2] >= 10 && (!lo || i[1] < lo[0])) lo = [i[1], t];
        }
        return { hi, lo };
    };
    const ti = totals(0); const to = totals(opp);
    const cell = (x: [number, Test] | null) => x ? <td><strong>{x[0]}</strong><span className="crx-grounddetail">{GROUNDS[x[1].g].city || groundShort(x[1].g)}, {yearOf(x[1].d)}</span></td> : <td>–</td>;
    const ids = useMemo(() => new Set(tests.map((t) => t.i)), [tests]);
    const leaders = useMemo(() => {
        const bat = new Map<number, BatRow[]>(); const bowl = new Map<number, BowlRow[]>();
        for (const id of ids) { for (const r of batByMatch.get(id) || []) { if (!bat.has(r[2])) bat.set(r[2], []); bat.get(r[2])!.push(r); } for (const r of bowlByMatch.get(id) || []) { if (!bowl.has(r[2])) bowl.set(r[2], []); bowl.get(r[2])!.push(r); } }
        const side = (team: number) => ({
            bat: [...bat.entries()].filter(([p]) => PLAYERS[p].team === team).map(([p, r]) => ({ p, ...batAgg(r) })).sort((a, b) => b.runs - a.runs).slice(0, 5),
            bowl: [...bowl.entries()].filter(([p]) => PLAYERS[p].team === team).map(([p, r]) => ({ p, ...bowlAgg(r) })).sort((a, b) => b.wkts - a.wkts).slice(0, 5),
        });
        return [side(0), side(opp)];
    }, [ids, opp]);
    const first = allTests[0]; const last = allTests[allTests.length - 1];
    return countryView(<div className="crx-teamhub">
        <Selector label="Opponent" title="India v …" value={opp} open={open} placeholder="Pick an opponent" sort={false} onToggle={() => setOpen(!open)}
            onChange={(v: number) => { setOpp(v); setOpen(false); setAll(false); setLead(false); }}
            options={OPPONENTS.map((o) => ({ value: o, label: TEAMS[o], searchText: CODE[o] }))} />
        <Quick title="Popular" items={OPPONENTS.slice(0, 6).map((o) => ({ key: String(o), label: TEAMS[o], on: o === opp, go: () => { setOpp(o); setAll(false); setLead(false); } }))} />
        <div className="crx-hero"><div className="crx-heroname">India v {TEAMS[opp]}</div>
            {first && <div className="crx-herosub">{plural(allTests.length, 'Test')} · {yearOf(first.d)}{last && yearOf(last.d) !== yearOf(first.d) ? '–' + yearOf(last.d) : ''}{tied > 0 ? ` · ${tied} tied` : ''}</div>}</div>
        <Pills label="Where played" cls="crx-matchupmodes" value={where} onChange={(v) => { setWhere(v); setAll(false); }} items={[['all', 'All'], ['home', 'In India'], ['away', 'Away']]} />
        {tests.length === 0 ? <Hint>No Tests in this selection.</Hint> : <>
            <p className="crx-verdict crx-noabbr">India have won {won} of {plural(tests.length, 'Test')} against {TEAMS[opp]}{where === 'home' ? ' in India' : where === 'away' ? ' away from home' : ''}, losing {lost} and drawing {drawn + tied}. Most recent: {resultText(list[0])}, {yearOf(list[0].d)}.</p>
            <div className={'crx-split' + (moreOpen ? '' : ' crx-lessmode')}><div className="crx-col">
            <Tiles rows={[['Tests', tests.length], ['India won', won, 'ind'], [`${CODE[opp]} won`, lost, 'opp'], ['Drawn', drawn]]} />
            {tests.length > 1 && <ResultStrip oppCode={CODE[opp]} items={tests.map((t) => ({ k: winnerOf(t) === 0 ? 'ind' as const : winnerOf(t) === opp ? 'opp' as const : 'draw' as const, label: `${fmtDate(t.d)} · ${GROUNDS[t.g]?.city || groundShort(t.g)} · ${resultText(t)}` }))} />}
            <div className="crx-extra"><Label>Highest and lowest totals</Label>
            <table className="crx-groundtable crx-tot"><thead><tr><th /><th><Badge team={0} /></th><th><Badge team={opp} /></th></tr></thead><tbody>
                <tr><th>Highest</th>{cell(ti.hi)}{cell(to.hi)}</tr>
                <tr><th>Lowest (all out)</th>{cell(ti.lo)}{cell(to.lo)}</tr>
            </tbody></table></div>
            </div><div className="crx-col">
            <Label>Tests · newest first</Label>
            <div className="crx-meets">{(all ? list : list.slice(0, 5)).map((t) => <TestRow key={t.i} t={t} />)}</div>
            <ShowMore open={all} onToggle={() => setAll(!all)} total={list.length} shown={5} what="Tests" />
            <Fold label="Top performers" note="runs and wickets" cls="crx-morerec crx-extra">
                {[0, 1].map((s) => <div key={s}>
                    <div className="crx-hg-top">
                        <section className={'crx-t-' + (s === 0 ? 'ind' : 'opp')}><h4>{s === 0 ? 'India' : TEAMS[opp]} · most runs</h4>{leaders[s].bat.map((x) => <div className="crx-hg-topRow" key={x.p}><span className="crx-hg-topName">{pname(x.p)}<em>{x.tests} {x.tests === 1 ? 'Test' : 'Tests'}</em></span><strong>{n1(x.runs)}</strong></div>)}</section>
                        <section className={'crx-t-' + (s === 0 ? 'ind' : 'opp')}><h4>{s === 0 ? 'India' : TEAMS[opp]} · most wickets</h4>{leaders[s].bowl.map((x) => <div className="crx-hg-topRow" key={x.p}><span className="crx-hg-topName">{pname(x.p)}<em>{x.tests} {x.tests === 1 ? 'Test' : 'Tests'}</em></span><strong>{x.wkts}</strong></div>)}</section>
                    </div>
                </div>)}
            </Fold>
            </div></div>
            <MoreToggle open={moreOpen} onToggle={() => setMoreOpen(!moreOpen)} what="numbers" /></>}
    </div>);
}

// ============================================================ Player analysis
const KIND_LABELS = ['Caught', 'Bowled', 'LBW', 'Stumped', 'Run out', 'Hit wicket', 'Caught and bowled', 'Other'];
const HAS_ROWS = PLAYERS.filter((p) => batByPlayer.has(p.i) || bowlByPlayer.has(p.i));

function oppTable(rows: { opp: number; label: string; vals: (string | number)[] }[], heads: string[]) {
    return <table className="crx-groundtable crx-tot crx-plt"><thead><tr><th>{heads[0]}</th>{heads.slice(1).map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.label}><th>{r.label}</th>{r.vals.map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody></table>;
}

export function IndiaPlayers({ Selector }: any) {
    const [open, setOpen] = useState(false);
    const [p, setP] = useState<number | null>(null);
    useEffect(() => onGo((d) => { if (d.kind === 'player') { setP(d.value); setOpen(false); } }), []);
    const options = useMemo(() => HAS_ROWS.map((x) => ({ value: x.i, label: plabel(x.i), searchText: x.name + ' ' + TEAMS[x.team] })), []);
    return countryView(<div>
        <Selector label="Player" value={p} placeholder="Pick a player" title="Player · India and every opponent" open={open} onToggle={() => setOpen(!open)} onChange={(v: number) => { setP(v); setOpen(false); }} options={options} />
        <Quick title="Popular" items={popularPlayers().map((i) => ({ key: String(i), label: pname(i), on: i === p, go: () => { setP(i); setOpen(false); } }))} />
        {p == null ? <Hint>Pick any India player, past or present, anyone still playing anywhere, or any opponent who has played India. Retired opponents show their Tests against India only.</Hint> : <PlayerCard key={p} p={p} />}
    </div>);
}

// ---- Against pace and spin (batters) / against right- and left-handers (bowlers), from the ball-by-ball meetings ----
let PAIR_IDX: { bat: Map<number, [number, any][]>; bowl: Map<number, [number, any][]> } | null = null;
function pairIdx() {
    if (!PAIR_IDX) {
        const bat = new Map<number, [number, any][]>(); const bowl = new Map<number, [number, any][]>();
        for (const [k, v] of Object.entries(PAIRS) as [string, any][]) {
            if (!v.m.length) continue; const [b, t] = k.split(',').map(Number);
            if (!bat.has(t)) bat.set(t, []); bat.get(t)!.push([b, v]);
            if (!bowl.has(b)) bowl.set(b, []); bowl.get(b)!.push([t, v]);
        }
        PAIR_IDX = { bat, bowl };
    }
    return PAIR_IDX;
}
type Split = { key: string; label: string; st: PairStats };
function splitStats(p: number, isBat: boolean, where: string): Map<string, PairStats> {
    const out = new Map<string, PairStats>();
    for (const [other, v] of (isBat ? pairIdx().bat : pairIdx().bowl).get(p) || []) {
        const key = isBat ? (isSpinKind(bowlKind(PLAYERS[other]?.bowl || '')) ? 'spin' : bowlKind(PLAYERS[other]?.bowl || '') === '?' ? '?' : 'pace')
            : (PLAYERS[other]?.bat === 'LHB' ? 'lh' : PLAYERS[other]?.bat === 'RHB' ? 'rh' : '?');
        for (const m of v.m as [number, number, string][]) {
            if (where !== 'all') { const inIndia = GROUNDS[TESTS[m[0]].g]?.country === 'India'; if ((where === 'in') !== inIndia) continue; }
            let st = out.get(key); if (!st) { st = emptyStats(); out.set(key, st); }
            addStats(st, parseBalls(m[2]));
        }
    }
    return out;
}
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '–');
const SplitPanels = ({ stats, isBat, name, tone }: { stats: Map<string, PairStats>; isBat: boolean; name: string; tone: string }) => {
    const defs: [string, string][] = isBat ? [['pace', 'Against pace'], ['spin', 'Against spin']] : [['rh', 'To right-handers'], ['lh', 'To left-handers']];
    const rows = defs.map(([k, l]) => { const st = stats.get(k); return { k, l, st }; });
    const ok = rows.filter((r) => r.st && r.st.balls >= 60);
    const av = (st: PairStats) => (st.outs ? st.runs / st.outs : NaN);
    let line = '';
    if (ok.length === 2) {
        const [a, b] = ok.map((r) => r.st!); const aa = av(a), bb = av(b);
        if (isBat && Number.isFinite(aa) && Number.isFinite(bb)) line = `${name} averages ${f1(aa)} against pace and ${f1(bb)} against spin${Math.abs(aa - bb) < 0.1 * Math.max(aa, bb) ? ', so there is little between them' : aa > bb ? ', so pace has been the easier job' : ', so spin has been the easier job'}.`;
        if (!isBat && Number.isFinite(aa) && Number.isFinite(bb)) line = `${name} averages ${f1(aa)} per wicket against right-handers and ${f1(bb)} against left-handers.`;
    }
    return <>
        <div className="crx-splitgrid">{rows.map(({ k, l, st }) => st && st.balls >= 30 ? <div className={'crx-splitbox crx-splitbox-' + k} key={k}>
            <div className="crx-splithead">{l}</div>
            <div className="crx-splitbig">{st.outs ? f1(av(st)) : '–'}<small>{isBat ? 'average' : 'per wicket'}</small></div>
            <div className="crx-splitrows">
                <div><span>{isBat ? 'Strike rate' : 'Economy'}</span><b>{isBat ? f1(100 * st.runs / st.balls) : f1(6 * st.runs / st.balls)}</b></div>
                <div><span>Dot balls</span><b>{Math.round(100 * st.dots / st.balls)}%</b></div>
                <div><span>{isBat ? 'Out' : 'Wickets'}</span><b>{st.outs}</b></div>
                <div><span>{isBat ? 'Balls faced' : 'Balls bowled'}</span><b>{n1(st.balls)}</b></div>
            </div></div> : <div className="crx-splitbox crx-splitempty" key={k}><div className="crx-splithead">{l}</div><p>Too few balls on record.</p></div>)}</div>
        {line && <p className="crx-fine crx-splitline">{line}</p>}
    </>;
};

function PlayerCard({ p }: { p: number }) {
    const pl = PLAYERS[p];
    const bat = (batByPlayer.get(p) || []) as BatRow[]; const bowl = (bowlByPlayer.get(p) || []) as BowlRow[];
    const wk = bowl.reduce((a, r) => a + r[5], 0); const rn = bat.reduce((a, r) => a + r[3], 0);
    const [branch, setBranch] = useState(bat.length === 0 || (bowl.length > 0 && wk * 25 > rn) ? 'bowl' : 'bat');
    const [rec, setRec] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [where, setWhere] = useState('all');
    const splits = useMemo(() => ({ bat: splitStats(p, true, where), bowl: splitStats(p, false, where) }), [p, where]);
    const span = playerSpan(p);
    const ba = batAgg(bat); const bo = bowlAgg(bowl);
    const isBat = branch === 'bat';
    const tone: Tone = pl.team === 0 ? 'ind' : 'opp';
    const empty = (isBat ? bat.length : bowl.length) === 0;
    const sub = [pl.bat, pl.bowl && pl.bowl[0].toUpperCase() + pl.bowl.slice(1)].filter(Boolean).join(' · ');
    const against = pl.full ? '' : 'His Tests against India only. A complete career is kept for India\u2019s players and for anyone still playing.';
    // splits
    const byOpp = new Map<number, { bat: BatRow[]; bowl: BowlRow[] }>(); const byGround = new Map<number, { bat: BatRow[]; bowl: BowlRow[] }>();
    const slot = (m: Map<number, any>, k: number) => { let v = m.get(k); if (!v) { v = { bat: [], bowl: [] }; m.set(k, v); } return v; };
    const enemy = (m: number) => { const t = TESTS[m]; return t.a === pl.team ? t.b : t.a; };
    for (const r of bat) { slot(byOpp, enemy(r[0])).bat.push(r); slot(byGround, TESTS[r[0]].g).bat.push(r); }
    for (const r of bowl) { slot(byOpp, enemy(r[0])).bowl.push(r); slot(byGround, TESTS[r[0]].g).bowl.push(r); }
    const credited = creditedBy.get(p) || [];
    const kinds = isBat ? kindCounts(bat) : kindCounts(credited);
    const kindRows = [1, 2, 3, 4, 5, 6, 7, 8].map((c) => [KIND_LABELS[c - 1], kinds[c]] as [string, number]).filter((r) => (isBat || r[0] !== 'Run out'));
    // How the dismissals split by the other player's style: bowler type when batting, batting hand when bowling.
    const styleCount = new Map<string, number>();
    const inWhere = (m: number) => where === 'all' || ((where === 'in') === (GROUNDS[TESTS[m].g]?.country === 'India'));
    if (isBat) { for (const r of bat) if (inWhere(r[0]) && r[7] > 0 && r[7] !== 5) { const k = r[8] >= 0 ? bowlKind(PLAYERS[r[8]]?.bowl || '') : '?'; styleCount.set(k, (styleCount.get(k) || 0) + 1); } }
    else { for (const r of credited) if (inWhere(r[0])) { const k = batHand(PLAYERS[r[2]]?.bat || ''); styleCount.set(k, (styleCount.get(k) || 0) + 1); } }
    const styleRows: [string, number][] = isBat
        ? ([['Right-arm pace', ['rf', 'rm']], ['Left-arm pace', ['lf', 'lm']], ['Off spin', ['off']], ['Leg spin', ['leg']], ['Left-arm spin', ['sla']], ['Left-arm wrist spin', ['law']], ['Not known', ['?']]] as [string, string[]][])
            .map(([l, ks]) => [l, ks.reduce((a, k) => a + (styleCount.get(k) || 0), 0)] as [string, number])
        : ['Right-hand bat', 'Left-hand bat', 'Not known'].map((l) => [l, styleCount.get(l) || 0] as [string, number]);
    const styleKnown = isBat
        ? [...styleCount.entries()].filter(([k]) => k !== '?').reduce((a, b) => a + b[1], 0)
        : [...styleCount.entries()].filter(([k]) => k !== 'Not known').reduce((a, b) => a + b[1], 0);
    const styleAll = [...styleCount.values()].reduce((a, b) => a + b, 0);
    const spinShare = isBat && styleKnown > 0 ? Math.round(100 * [...styleCount.entries()].filter(([k]) => isSpinKind(k)).reduce((a, b) => a + b[1], 0) / styleKnown) : 0;
    const styleNote = isBat
        ? `${n1(styleKnown)} of ${n1(styleAll)} dismissals name a bowler whose style is on record${styleKnown > 0 ? `, and ${spinShare}% of those were to spin and ${100 - spinShare}% to pace` : ''}. Run outs are left out.`
        : `${plural(styleKnown, 'wicket')} where the batter's hand is on record.`;
    const byBowler = new Map<number, number>(); for (const r of bat) if (r[8] >= 0) byBowler.set(r[8], (byBowler.get(r[8]) || 0) + 1);
    const byBatter = new Map<number, number>(); for (const r of credited) byBatter.set(r[2], (byBatter.get(r[2]) || 0) + 1);
    const topList = [...(isBat ? byBowler : byBatter).entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const oppRows = [...byOpp.entries()].filter(([, v]) => (isBat ? v.bat.length : v.bowl.length) > 0).sort((a, b) => (isBat ? batAgg(b[1].bat).runs - batAgg(a[1].bat).runs : bowlAgg(b[1].bowl).wkts - bowlAgg(a[1].bowl).wkts));
    const grdRows = [...byGround.entries()].filter(([, v]) => (isBat ? v.bat.length : v.bowl.length) > 0).sort((a, b) => (isBat ? batAgg(b[1].bat).runs - batAgg(a[1].bat).runs : bowlAgg(b[1].bowl).wkts - bowlAgg(a[1].bowl).wkts));
    const recent = (isBat ? bat : bowl).slice().sort((a, b) => b[0] - a[0] || b[1] - a[1]).slice(0, rec ? 20 : 6);
    const sn = sur(p);
    const verdict = (() => {
        if (empty) return null;
        if (isBat) {
            const topKind = kindRows.slice().sort((a, b) => b[1] - a[1])[0]; const outsAll = kindRows.reduce((a, r) => a + r[1], 0);
            const how = topKind && outsAll >= 5 && topKind[1] > 0 ? ` Out ${topKind[0].toLowerCase()} most often (${Math.round(100 * topKind[1] / outsAll)}%).` : '';
            return { line: `${sn} scored ${n1(ba.runs)} runs in ${plural(ba.tests, 'Test')}${ba.avg !== '–' ? ` at an average of ${ba.avg}` : ''}${ba.h ? `, with ${plural(ba.h, 'hundred')}` : ''}.${how}`, small: ba.tests < 5 ? 'A short career, so averages can mislead.' : '' };
        }
        return { line: `${sn} took ${n1(bo.wkts)} wickets in ${plural(bo.tests, 'Test')}${bo.avg !== '–' ? ` at ${bo.avg}` : ''}${bo.best !== '–' ? `, best innings ${bo.best}` : ''}.`, small: bo.tests < 5 ? 'A short career, so averages can mislead.' : '' };
    })();
    // Runs (batting) or wickets (bowling) in each calendar year of his career, filling the quiet years with zero.
    const yearBars = (() => {
        const m = new Map<number, number>();
        for (const r of (isBat ? bat : bowl)) { const y = Number(yearOf(TESTS[r[0]].d)); m.set(y, (m.get(y) || 0) + (isBat ? (r as BatRow)[3] : (r as BowlRow)[5])); }
        const ys = [...m.keys()].sort((a, b) => a - b);
        if (ys.length < 2) return null;
        const unit = isBat ? 'runs' : 'wickets';
        const items = []; let best = ys[0];
        for (let y = ys[0]; y <= ys[ys.length - 1]; y++) { const v = m.get(y) || 0; if (v > (m.get(best) || 0)) best = y; items.push({ v, label: `${y}: ${n1(v)} ${unit}` }); }
        return { items, first: String(ys[0]), last: String(ys[ys.length - 1]), note: `Best year ${best}: ${n1(m.get(best) || 0)}`, title: (isBat ? 'Runs' : 'Wickets') + ' by year' };
    })();
    const chart = yearBars ? <MiniBars items={yearBars.items} tone={tone} title={yearBars.title} note={yearBars.note} foot={[yearBars.first, yearBars.last]} /> : null;
    return <div className="crx-playercard">
        <div className="crx-hero"><div className="crx-heroname">{pl.name}</div>
            <div className="crx-herosub"><Badge team={pl.team} />{sub ? ' · ' + sub : ''}{span ? ` · ${yearOf(span[0])}–${yearOf(span[1])}` : ''}{against && <> · against India only <Info>{against}</Info></>}</div></div>
        <Pills label="Branch" cls="crx-twomodes" value={branch} onChange={setBranch} items={[['bat', 'Batting analysis'], ['bowl', 'Bowling analysis']]} />
        {empty ? <p className="crx-hint">No {isBat ? 'batting' : 'bowling'} recorded in these Tests.</p> : <>
        {verdict && <p className="crx-verdict crx-noabbr">{verdict.line}{verdict.small && <em className="crx-caveat"> {verdict.small}</em>}</p>}
        <div className={'crx-split' + (moreOpen ? '' : ' crx-lessmode')}><div className="crx-col">
        {isBat ? <>
            <Tiles rows={[['Tests', ba.tests], ['Runs', n1(ba.runs)], ['Average', ba.avg], ['Hundreds', ba.h]]} />
            {chart}
            <Fold label="More numbers" cls="crx-morenums crx-extra"><Tiles rows={[['Innings', ba.inns], ['Not outs', ba.no], ['High score', ba.hs + (ba.hsNo ? '*' : '')], ['Strike rate', ba.sr], ['Fifties', ba.f], ['Ducks', ba.ducks], ['Fours', n1(ba.fours)], ['Sixes', ba.sixes]]} /></Fold>
        </> : <>
            <Tiles rows={[['Tests', bo.tests], ['Wickets', n1(bo.wkts)], ['Average', bo.avg], ['Economy', bo.econ]]} />
            {chart}
            <Fold label="More numbers" cls="crx-morenums crx-extra"><Tiles rows={[['Innings', bo.inns], ['Overs', bo.overs], ['Maidens', bo.maidens], ['Best innings', bo.best], ['5 wicket hauls', bo.w5], ['10 wicket Tests', bo.w10], ['Strike rate', bo.sr], ['Runs conceded', n1(bo.runs)]]} /></Fold>
        </>}
        <div className="crx-extra"><Label>{isBat ? 'How he gets out' : 'How he takes wickets'}</Label>
        {kindRows.some((r) => r[1] > 0) ? <Bars rows={kindRows} tone={tone} /> : <p className="crx-fine">No dismissals recorded.</p>}</div>
        {(() => {
            const sp = isBat ? splits.bat : splits.bowl; const anyBall = [...sp.entries()].some(([k, v]) => k !== '?' && v.balls >= 30); const anyOut = styleRows.some((r) => r[1] > 0);
            if (!anyBall && !anyOut && where === 'all') return null;
            return <>
            <Label info={`${anyBall ? `The two panels use the ball-by-ball record of India's Tests since ${fmtDate(PAIRS_FROM)}; average is ${isBat ? 'runs per dismissal by the bowler (run outs left out)' : 'runs conceded per wicket'}. ` : ''}The list below counts every dismissal on record. ${styleNote}`}>{isBat ? 'Against pace and spin' : 'Against right and left-handers'}</Label>
            <Pills label="Where" cls="crx-twomodes" value={where} onChange={setWhere} items={[['all', 'Everywhere'], ['in', 'In India'], ['out', 'Away']]} />
            {anyBall && <SplitPanels stats={sp} isBat={isBat} name={sn} tone={tone} />}
            {anyOut ? <Fold label={isBat ? 'By type of bowler' : 'By batting hand'} note={`${n1(styleKnown)} dismissals`}><Bars rows={styleRows} tone={tone} /></Fold> : <p className="crx-fine">No dismissals with a known {isBat ? 'bowling' : 'batting'} style{where !== 'all' ? ' here' : ''}.</p>}
        </>; })()}
        </div><div className="crx-col">
        {topList.length > 0 && <div className="crx-extra">
            <Label>{isBat ? 'Dismissed most often by' : 'Dismissed most often'}</Label>
            <div className="crx-hg-top crx-one">{<section>{topList.map(([i, n]) => <div className="crx-hg-topRow" key={i}><span className="crx-hg-topName">{pname(i)}<em><Badge team={PLAYERS[i].team} /></em></span><strong>{n}</strong></div>)}</section>}</div>
        </div>}
        {pl.full && oppRows.length > 1 && <Fold label="By opponent" note={`${oppRows.length} teams`} cls="crx-extra">
            {oppTable(oppRows.map(([o, v]) => ({ opp: o, label: TEAMS[o], vals: isBat ? (() => { const a = batAgg(v.bat); return [a.tests, n1(a.runs), a.avg, a.h]; })() : (() => { const a = bowlAgg(v.bowl); return [a.tests, a.wkts, a.avg, a.best]; })() })), isBat ? ['Opponent', 'Tests', 'Runs', 'Avg', '100s'] : ['Opponent', 'Tests', 'Wkts', 'Avg', 'Best'])}
        </Fold>}
        {grdRows.length > 0 && <Fold label="By ground" note={`${grdRows.length} grounds`} cls="crx-extra">
            {oppTable(grdRows.slice(0, 15).map(([g, v]) => ({ opp: g, label: groundShort(g), vals: isBat ? (() => { const a = batAgg(v.bat); return [a.tests, n1(a.runs), a.avg, a.h]; })() : (() => { const a = bowlAgg(v.bowl); return [a.tests, a.wkts, a.avg, a.best]; })() })), isBat ? ['Ground', 'Tests', 'Runs', 'Avg', '100s'] : ['Ground', 'Tests', 'Wkts', 'Avg', 'Best'])}
            {grdRows.length > 15 && <p className="crx-fine">Top 15 of {grdRows.length} grounds by {isBat ? 'runs' : 'wickets'}.</p>}
        </Fold>}
        <Fold label={isBat ? 'Recent innings' : 'Recent bowling'} note="newest first" cls="crx-extra">
            <div className="crx-meets">{recent.map((r, i) => {
                const t = TESTS[r[0]];
                const line = isBat ? (() => { const b = r as BatRow; return `${b[3]}${b[7] === 0 ? '*' : ''}${b[4] >= 0 ? ` (${b[4]} balls)` : ''} · ${CODE_NAME[b[7]]}`; })() : (() => { const w = r as BowlRow; return `${w[5]}/${w[4]} from ${Math.floor(w[3] / 6)}${w[3] % 6 ? '.' + (w[3] % 6) : ''} overs`; })();
                return <div className="crx-meet" key={i}><div className="crx-meethead"><span className="crx-meetlabel"><span className="crx-meetdate">{fmtDate(t.d)}</span><span className="crx-meetvenue">{' · '}<Badge team={t.a} /> v <Badge team={t.b} /> · {groundShort(t.g)} · {INNINGS_NAME[r[1]]}</span></span></div><div className="crx-meetline">{line}</div></div>;
            })}</div>
            <ShowMore open={rec} onToggle={() => setRec(!rec)} total={(isBat ? bat : bowl).length} shown={6} what="innings" />
        </Fold>
        </div></div>
        <MoreToggle open={moreOpen} onToggle={() => setMoreOpen(!moreOpen)} what="detail" />
        </>}
    </div>;
}

// ============================================================ Ground analysis
const GROUND_IDS = (() => {
    const n = new Map<number, number>(); for (const t of TESTS) n.set(t.g, (n.get(t.g) || 0) + 1);
    const ind = new Set(TESTS.filter(isIndia).map((t) => t.g));
    return [...n.keys()].filter((g) => ind.has(g));
})();

export function IndiaGrounds({ Selector }: any) {
    const [g, setG] = useState<number | null>(() => TESTS.filter(isIndia).slice(-1)[0]?.g ?? null);
    const [open, setOpen] = useState(false);
    const [allInd, setAllInd] = useState(false);
    useEffect(() => onGo((d) => { if (d.kind === 'ground') { setG(d.value); setOpen(false); setAllInd(false); } }), []);
    const dup = useMemo(() => { const c = new Map<string, number>(); for (const i of GROUND_IDS) { const k = groundName(i); c.set(k, (c.get(k) || 0) + 1); } return c; }, []);
    const options = useMemo(() => GROUND_IDS.map((i) => ({ value: i, label: groundName(i) + (dup.get(groundName(i))! > 1 ? ` (${GROUNDS[i].country})` : ''), searchText: groundName(i) + ' ' + GROUNDS[i].country })), [dup]);
    return countryView(<div className="crx-hagley">
        <Selector label="Ground" title="Ground · every ground India has played at" value={g} placeholder="Pick a ground" open={open} onToggle={() => setOpen(!open)} onChange={(v: number) => { setG(v); setOpen(false); setAllInd(false); }} options={options} />
        <Quick title="Popular" items={INDIA_TOP_GROUNDS().map((i) => ({ key: String(i), label: groundShort(i), on: i === g, go: () => { setG(i); setOpen(false); setAllInd(false); } }))} />
        {g == null ? <Hint>Pick a ground.</Hint> : <GroundCard key={g} g={g} allInd={allInd} setAllInd={setAllInd} />}
    </div>);
}

let TOP_G: number[] | null = null;
function INDIA_TOP_GROUNDS(): number[] {
    if (!TOP_G) { const n = new Map<number, number>(); for (const t of TESTS) if (isIndia(t) && isHome(t)) n.set(t.g, (n.get(t.g) || 0) + 1); TOP_G = [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([i]) => i); }
    return TOP_G;
}

function GroundCard({ g, allInd, setAllInd }: { g: number; allInd: boolean; setAllInd: (v: boolean) => void }) {
    const [moreOpen, setMoreOpen] = useState(false);
    const ts = TESTS.filter((t) => t.g === g);
    const done = ts.filter((t) => t.res !== 'other' && t.inns.length > 0);
    const decided = done.filter((t) => typeof t.res === 'number');
    const first = (t: Test) => t.inns[0]?.[0];
    const batFirst = decided.filter((t) => t.res === first(t)).length; const chase = decided.length - batFirst;
    const draws = done.filter((t) => t.res === 'draw' || t.res === 'tie').length;
    const firsts = done.map((t) => t.inns[0]?.[1]).filter((x) => x != null) as number[];
    const avgFirst = firsts.length ? Math.round(firsts.reduce((a, b) => a + b, 0) / firsts.length) : 0;
    let hi: [number, Test, number] | null = null; let lo: [number, Test, number] | null = null; let ch: [number, Test, number] | null = null;
    for (const t of done) {
        for (const i of t.inns) { if (!hi || i[1] > hi[0]) hi = [i[1], t, i[0]]; if (i[2] >= 10 && (!lo || i[1] < lo[0])) lo = [i[1], t, i[0]]; }
        if (t.by && t.by[0] === 'w' && typeof t.res === 'number') { const last = [...t.inns].reverse().find((i) => i[0] === t.res); if (last && (!ch || last[1] > ch[0])) ch = [last[1], t, t.res]; }
    }
    const rowDetail = (x: [number, Test, number] | null) => x ? `${CODE[x[2]]} v ${CODE[x[2] === x[1].a ? x[1].b : x[1].a]} · ${yearOf(x[1].d)}` : '';
    const A = GROUND_AGG[g];
    const dis = A ? (A.k as number[]).reduce((a, b) => a + b, 0) : 0;
    const ps = A ? A.ps as number[] : [0, 0, 0]; const known = ps[0] + ps[1];
    const ind = ts.filter(isIndia).slice().reverse();
    const iw = ind.filter((t) => winnerOf(t) === 0).length; const il = ind.filter((t) => typeof t.res === 'number' && t.res !== 0).length; const idr = ind.filter((t) => t.res === 'draw').length;
    const yrs = ts.length ? `${yearOf(ts[0].d)}–${yearOf(ts[ts.length - 1].d)}` : '';
    const Top = ({ title, rows, unit }: { title: string; rows: any[]; unit: (r: any) => string }) => <section><h4>{title}</h4>{rows.map((r) => <div className="crx-hg-topRow" key={r[0]}><span className="crx-hg-topName">{r[0]}<em>{r[1]} {r[1] === 1 ? 'inns' : 'inns'}</em></span><strong>{unit(r)}</strong></div>)}</section>;
    const info = groundInfo(GROUNDS[g].name, GROUNDS[g].city, GROUNDS[g].country);
    const photo = PHOTOS[GROUNDS[g].name + '|' + GROUNDS[g].city];
    return <div>
        {photo && <figure className="crx-gphoto"><img src={photo.file} alt={`${GROUNDS[g].name}, ${GROUNDS[g].city}`} loading="lazy" decoding="async" onError={(e) => { const f = e.currentTarget.parentElement; if (f) f.style.display = 'none'; }} /><figcaption>Photo: {photo.author || 'Wikimedia Commons contributor'} · <a href={photo.page} target="_blank" rel="noopener noreferrer">{photo.license}</a> · Wikimedia Commons</figcaption></figure>}
        <div className="crx-hero"><div className="crx-heroname">{GROUNDS[g].name}</div><div className="crx-herosub">{[GROUNDS[g].city, GROUNDS[g].country].filter(Boolean).join(', ')} · {plural(ts.length, 'Test')} {yrs}</div></div>
        {info && <div className="crx-ginfo">
            {info.team && <div className="crx-gi-team"><span>Home side</span><strong>{info.team}</strong></div>}
            {info.stars.length > 0 && <div className="crx-gi-names"><span>Names from here</span><strong>{info.stars.slice(0, 4).map((n) => <b className="crx-chip" key={n}>{n}</b>)}</strong></div>}
        </div>}
        {done.length > 0 && <p className="crx-verdict crx-noabbr">{plural(done.length, 'Test')} here: {batFirst} won by the side batting first, {chase} by the side chasing, {draws} drawn{avgFirst > 0 ? `. First innings average ${avgFirst}` : ''}.{ind.length > 0 ? ` India have won ${iw} of ${ind.length} here.` : ''}{decided.length < 5 && <em className="crx-caveat"> Few results, so take this lightly.</em>}</p>}
        <div className={'crx-split' + (moreOpen ? '' : ' crx-lessmode')}><div className="crx-col">
        <Label>Results</Label>
        <Tiles rows={[['Tests', done.length], ['Batting first won', batFirst], ['Chasing won', chase], ['Drawn', draws]]} />
        <div className="crx-extra"><Label>Scores</Label>
        <div className="crx-hg-scores">
            {avgFirst > 0 && <div className="crx-hg-score"><span>Average first innings</span><strong>{avgFirst}</strong></div>}
            {hi && <div className="crx-hg-score"><span>Highest total</span><strong>{hi[0]}</strong><em>{rowDetail(hi)}</em></div>}
            {lo && <div className="crx-hg-score"><span>Lowest all out</span><strong>{lo[0]}</strong><em>{rowDetail(lo)}</em></div>}
            {ch && <div className="crx-hg-score"><span>Highest winning chase</span><strong>{ch[0]}</strong><em>{rowDetail(ch)}</em></div>}
        </div></div>
        {A && dis > 0 && <div className="crx-extra">
            <Label info={`${n1(dis)} dismissals${known > 20 ? ` · bowlers took ${Math.round(100 * ps[0] / known)}% of their wickets with pace and ${Math.round(100 * ps[1] / known)}% with spin` : ''}. All teams, every Test here.`}>How wickets fall</Label>
            <Bars tone="neu" rows={KIND_LABELS.map((l, i) => [l, A.k[i]] as [string, number]).sort((a, b) => b[1] - a[1])} />
        </div>}
        </div><div className="crx-col">
        {A && (A.bat.length > 0 || A.bowl.length > 0) && <div className="crx-extra">
            <Label>Top players</Label>
            <div className="crx-hg-top">
                <Top title="Most runs" rows={A.bat.slice(0, 3)} unit={(r) => n1(r[2])} />
                <Top title="Most wickets" rows={A.bowl.slice(0, 3)} unit={(r) => String(r[2])} />
            </div>
        </div>}
        {ind.length > 0 && <>
            <Label>India here</Label>
            <Tiles rows={[['Tests', ind.length], ['Won', iw, 'ind'], ['Lost', il, 'opp'], ['Drawn', idr]]} />
            <div className="crx-meets">{(allInd ? ind : ind.slice(0, 4)).map((t) => <TestRow key={t.i} t={t} vs />)}</div>
            <ShowMore open={allInd} onToggle={() => setAllInd(!allInd)} total={ind.length} shown={4} what="Tests" />
        </>}
        </div></div>
        <MoreToggle open={moreOpen} onToggle={() => setMoreOpen(!moreOpen)} what="about this ground" />
    </div>;
}



// ============================================================ Who gets him out
// Pick a batter who is going well; see which bowlers in the current Test's squad have the best record against him.
type SqP = { name: string; team: string; style?: string; likely?: boolean };
type SeriesCfg = { id: string; title: string; homeTeam: string; squads: SqP[]; fixtures: { n: number; label: string; date: string; days: number; venue: string }[]; venues: { key: string; name: string; city: string }[] };
const SERIES_CFGS = [NZ_IND_CFG, IND_AUS_CFG] as unknown as SeriesCfg[];
function currentSeries(): { cfg: SeriesCfg; fx: SeriesCfg['fixtures'][0] } {
    const now = Date.now();
    for (const cfg of SERIES_CFGS) {
        for (const fx of cfg.fixtures) { const end = Date.parse(fx.date + 'T00:00:00Z') + (fx.days + 1) * 864e5; if (end >= now) return { cfg, fx }; }
    }
    const cfg = SERIES_CFGS[SERIES_CFGS.length - 1]; return { cfg, fx: cfg.fixtures[cfg.fixtures.length - 1] };
}
const PLAYER_BY_KEY = (() => { const m = new Map<string, number>(); PLAYERS.forEach((p) => m.set(p.name + '|' + TEAMS[p.team], p.i)); return m; })();
const squadIdx = (sp: SqP) => PLAYER_BY_KEY.get(sp.name + '|' + sp.team);

function vsStats(b: number, t: number) {
    const v = PAIRS[b + ',' + t]; const st = emptyStats(); let outs = 0; const tests = new Set<number>();
    if (!v) return { st, outs: 0, tests: 0 };
    for (const [m, , s] of v.m) { addStats(st, parseBalls(s)); tests.add(m); }
    outs = st.outs;
    for (const [m, , kind] of v.c) { tests.add(m); if (kind > 0) { const l = CODE_LETTER[kind]; if (l && 'cblshk'.includes(l)) outs++; } }
    return { st, outs, tests: tests.size };
}

export function IndiaFinder({ Selector }: any) {
    const { cfg, fx } = useMemo(currentSeries, []);
    const venue = cfg.venues.find((v) => v.key === (fx as any).venue);
    const [open, setOpen] = useState(false);
    const [batter, setBatter] = useState<number | null>(null);
    const [scope, setScope] = useState('xi');
    const options = useMemo(() => HAS_ROWS.map((x) => ({ value: x.i, label: plabel(x.i), searchText: x.name + ' ' + TEAMS[x.team] })), []);
    const squadBatters = useMemo(() => cfg.squads.filter((p) => p.likely && !p.style).map((p) => ({ p, i: squadIdx(p) })).filter((x): x is { p: SqP; i: number } => x.i != null), [cfg]);
    const bt = batter != null ? PLAYERS[batter] : null;
    const myTeam = bt ? TEAMS[bt.team] : '';
    const oppTeam = !bt ? '' : myTeam === 'India' ? (cfg.squads.find((p) => p.team !== 'India')?.team || '') : myTeam === (cfg.squads.find((p) => p.team !== 'India')?.team || '') ? 'India' : '';
    const inSeries = !!oppTeam;
    const eff = inSeries ? scope : 'any';

    const rows = useMemo(() => {
        if (batter == null) return null;
        let cand: { i: number; style?: string; xi: boolean }[] = [];
        if (eff === 'any') {
            const seen = BY_BATTER.get(batter);
            cand = [...(seen ? seen.keys() : [])].filter((b) => PLAYERS[b].team !== PLAYERS[batter].team).map((b) => ({ i: b, xi: true }));
        } else {
            cand = cfg.squads.filter((p) => p.team === oppTeam && (eff === 'all' || p.likely)).map((p) => ({ p, i: squadIdx(p) })).filter((x): x is any => x.i != null).map((x: any) => ({ i: x.i, style: x.p.style, xi: !!x.p.likely }));
        }
        const out = cand.map((c) => { const r = vsStats(c.i, batter); return { ...c, ...r }; });
        const met = out.filter((r) => r.st.balls > 0 || r.outs > 0 || r.tests > 0);
        const none = out.filter((r) => !(r.st.balls > 0 || r.outs > 0 || r.tests > 0) && (eff === 'any' ? false : !!r.style));
        met.sort((a, b) => (b.outs - a.outs) || ((a.outs ? a.st.balls / a.outs : 1e9) - (b.outs ? b.st.balls / b.outs : 1e9)) || (b.st.balls - a.st.balls));
        return { met: eff === 'any' ? met.slice(0, 10) : met, none };
    }, [batter, eff, oppTeam, cfg]);

    const style = useMemo(() => {
        if (batter == null) return '';
        const sp = splitStats(batter, true, 'all'); const pace = sp.get('pace'), spin = sp.get('spin');
        const nm = sur(batter); const av = (x?: PairStats) => (x && x.balls >= 60 && x.outs ? x.runs / x.outs : NaN);
        const a = av(pace), b = av(spin);
        if (Number.isFinite(a) && Number.isFinite(b)) return `${nm} averages ${f1(a)} against pace and ${f1(b)} against spin${Math.abs(a - b) < 0.1 * Math.max(a, b) ? ', so little between them' : a > b ? ', so spin is the better way in' : ', so pace is the better way in'}.`;
        return '';
    }, [batter]);

    const best = rows?.met[0];
    let verdict = '';
    if (batter != null && rows) {
        if (best && best.outs > 0) verdict = `Best bet: ${pname(best.i)}. ${sur(best.i)} has dismissed ${sur(batter)} ${times(best.outs)} in ${plural(best.st.balls, 'ball')}${best.outs > 1 ? `, about once every ${Math.round(best.st.balls / best.outs)} balls` : ''}.`;
        else if (best) verdict = `Nobody here has dismissed ${sur(batter)} before. ${pname(best.i)} has bowled the most to him: ${plural(best.st.balls, 'ball')}, ${best.st.runs} runs.`;
        else verdict = `None of these bowlers has a recorded meeting with ${sur(batter)}.`;
    }
    const scopeLabel = eff === 'xi' ? 'Expected XI' : eff === 'all' ? 'Full squad' : 'Anyone';
    return <>
        <div className="crx-pair">
            <Selector label="Batter" value={batter} options={options} open={open} onToggle={() => setOpen(!open)} onChange={(v: number) => { setBatter(v); setOpen(false); }} tone={toneOf(batter)} />
        </div>
        <Quick title={'In this match · ' + cfg.title.replace(/\s+/g, ' ') + ' · ' + fx.label} items={squadBatters.map(({ p, i }) => ({ key: p.name, label: sur(i), on: i === batter, go: () => setBatter(i) }))} />
        {bt && inSeries && <Pills label="Which bowlers" cls="crx-twomodes crx-three" value={eff} onChange={setScope} items={[['xi', 'Expected XI'], ['all', 'Full squad'], ['any', 'Anyone']]} />}
        {batter == null && <Hint>Pick the batter who is going well. You get the bowlers most likely to get him out.</Hint>}
        {bt && rows && <>
            {inSeries && eff !== 'any' && <p className="crx-hint crx-finderline">{oppTeam} {scopeLabel === 'Expected XI' ? 'expected XI' : 'squad'} for the {fx.label}{venue ? ', ' + venue.name : ''}. The team sheet is not confirmed until the toss.</p>}
            {!inSeries && <p className="crx-hint crx-finderline">{pname(batter!)} is not in the current series, so this shows anyone who has bowled to him.</p>}
            <p className="crx-verdict crx-noabbr">{verdict}</p>
            {rows.met.length > 0 && <>
                <Label>Who has the edge on {sur(batter!)}</Label>
                <div className="crx-flist">{rows.met.map((r, k) => {
                    const sr = r.st.balls ? (100 * r.st.runs / r.st.balls) : 0; const per = r.outs ? Math.round(r.st.balls / r.outs) : 0;
                    return <button type="button" key={r.i} className={'crx-frow' + (k === 0 && r.outs > 0 ? ' crx-fbest' : '')} onClick={() => go('duel', [r.i, batter])} aria-label={`${pname(r.i)} to ${pname(batter!)}: open the matchup`}>
                        <span className="crx-fmain"><span className="crx-fname">{pname(r.i)}{r.style && <em>{r.style}</em>}</span>
                            <span className="crx-fsub">{plural(r.st.balls, 'ball')} · {r.st.runs} runs{r.st.balls ? ` · SR ${sr.toFixed(0)}` : ''}{per ? ` · out every ${per}` : ''}</span></span>
                        <span className="crx-fnum"><b>{r.outs}</b><small>{r.outs === 1 ? 'wicket' : 'wickets'}</small></span>
                    </button>;
                })}</div>
            </>}
            {rows.none.length > 0 && <p className="crx-hint crx-finderline">No record against {sur(batter!)}: {rows.none.map((r) => sur(r.i) + (r.style ? ` (${r.style.toLowerCase()})` : '')).join(', ')}.</p>}
            {style && <p className="crx-hint crx-finderline">{style}</p>}
            <p className="crx-hint crx-finderline">Counts every Test meeting in the database: ball by ball since {fmtDate(PAIRS_FROM)}, and who got whom out before that. Tap a bowler for the full matchup.</p>
        </>}
    </>;
}
