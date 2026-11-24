// The four India-wide screens: Player matchup, Country matchup, Player analysis, Ground analysis.
// Every number is computed here from app/indiaData.ts (see india.ts); nothing is typed in by hand.
import React, { useMemo, useState } from 'react';
import { countryView } from './countryLabels';
import {
    BAT, BOWL, CODE, CODE_LETTER, CODE_NAME, GROUNDS, GROUND_AGG, INNINGS_NAME, PAIRS, PAIRS_FROM, PLAYERS, TEAMS, TESTS,
    BOWL_KINDS, addStats, ballToken, batAgg, batByMatch, batByPlayer, batHand, bowlAgg, bowlByMatch, bowlByPlayer, bowlKind, creditedBy, emptyStats, fmtDate, fmtKinds, isSpinKind,
    groundName, groundShort, isHome, isIndia, kindCounts, n1, oppOf, parseBalls, playerSpan, ratio, resultText, scoreLine, winnerOf, yearOf,
    type BatRow, type BowlRow, type Over, type PairStats, type Test,
} from './india';

const pname = (i: number) => PLAYERS[i].name;
const plabel = (i: number) => `${PLAYERS[i].name} (${CODE[PLAYERS[i].team]})`;
const plural = (n: number, w: string, ws?: string) => `${n1(n)} ${n === 1 ? w : ws || w + 's'}`;

// Stat tiles. The row carries how many tiles it holds, so the stylesheet can pick a column count that
// fits them instead of squeezing every tile onto one line.
function Tiles({ rows, cls = '' }: { rows: [string, string | number][]; cls?: string }) {
    const n = Math.min(rows.length, 10);
    return <div className={`crx-stats crx-tiles crx-tiles${n} ${cls}`.trim()}>{rows.map(([l, v]) =>
        <div key={l} className="crx-stat"><div className="crx-statv">{v}</div><div className="crx-statl">{l}</div></div>)}</div>;
}
function Pills({ label, items, value, onChange, cls }: { label: string; items: [string, string][]; value: string; onChange: (v: string) => void; cls: string }) {
    return <div className={'crx-viewtoggle ' + cls} role="group" aria-label={label}>{items.map(([id, l]) =>
        <button key={id} type="button" aria-pressed={value === id} className={'crx-pill' + (value === id ? ' crx-pillon' : '')} onClick={() => onChange(id)}>{l}</button>)}</div>;
}
function Fold({ label, note, children, cls = '' }: { label: string; note?: string; children: any; cls?: string }) {
    return <details className={'crx-pa-fold ' + cls}><summary>{label}{note && <em>{note}</em>}</summary>{children}</details>;
}
const Label = ({ children }: { children: any }) => <div className="crx-filterlabel">{children}</div>;
const Hint = ({ children }: { children: any }) => <p className="crx-hint">{children}</p>;
function Bars({ rows }: { rows: [string, number][] }) {
    const total = rows.reduce((a, r) => a + r[1], 0) || 1;
    return <div className="crx-hg-bars">{rows.filter((r) => r[1] > 0).map(([l, n]) =>
        <div className="crx-hg-bar" key={l}><span className="crx-hg-barname">{l}</span><span className="crx-hg-bartrack" aria-hidden="true"><i style={{ width: Math.max(2, Math.round(100 * n / total)) + '%' }} /></span><span className="crx-hg-barnum">{n1(n)} · {Math.round(100 * n / total)}%</span></div>)}</div>;
}
function ShowMore({ open, onToggle, total, shown, what }: { open: boolean; onToggle: () => void; total: number; shown: number; what: string }) {
    if (total <= shown) return null;
    return <button type="button" className="crx-pa-more-btn" aria-expanded={open} onClick={onToggle}>{open ? `Show fewer ${what}` : `Show all ${n1(total)} ${what}`}</button>;
}
function TestRow({ t, vs }: { t: Test; vs?: boolean }) {
    return <div className="crx-meet">
        <div className="crx-meethead"><span className="crx-meetlabel"><span className="crx-meetdate">{fmtDate(t.d)}</span><span className="crx-meetvenue">{' · '}{vs ? `${CODE[t.a]} v ${CODE[t.b]} · ` : ''}{groundShort(t.g)}</span></span></div>
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

export function IndiaMatchup({ Selector }: any) {
    const [open, setOpen] = useState<string | null>(null);
    const [bowler, setBowler] = useState<number | null>(null);
    const [batter, setBatter] = useState<number | null>(null);
    const [ground, setGround] = useState(-1);
    const [inn, setInn] = useState('all');
    const [all, setAll] = useState(false);
    const [more, setMore] = useState<string | null>(null);
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
            <Selector half label="Bowler" value={bowler} open={open === 'bowler'} placeholder="Pick a player" title="Bowler" onToggle={() => toggle('bowler')} onChange={(v: number | null) => { chooseBowler(v); }} sort={false}
                options={[...(bowler != null ? [{ value: null, label: 'Pick a player' }] : []), ...bowlerOpts]} />
            <Selector half label="Batter" value={batter} open={open === 'batter'} placeholder="Pick a player" title="Batter" onToggle={() => toggle('batter')} onChange={(v: number | null) => { chooseBatter(v); }} sort={false}
                options={[...(batter != null ? [{ value: null, label: 'Pick a player' }] : []), ...batterOpts]} />
        </div>
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
            <div className="crx-hero"><div className="crx-heroname">{pname(bowler!)} to {pname(batter!)}</div><div className="crx-herosub">{groundLabel} · {innLabel}</div></div>
            <Tiles rows={[['Balls', n1(stats.balls)], [stats.runs === 1 ? 'Run' : 'Runs', n1(stats.runs)], [stats.outs === 1 ? 'Dismissal' : 'Dismissals', stats.outs], [tests === 1 ? 'Test' : 'Tests', tests]]} />
            <div className="crx-outkinds">{stats.outs > 0 ? <><span>Got out</span><strong>{fmtKinds(stats.kinds)}</strong></> : <span>{stats.balls ? `Not dismissed in ${plural(stats.balls, 'ball')}` : 'No dismissals'}</span>}</div>
            {hasCard && <p className="crx-fine">Balls and runs come from Tests with ball-by-ball data only. Dismissals include every Test since {fmtDate(PAIRS_FROM)}.</p>}
            {stats.balls > 0 && <Fold label="More numbers" cls="crx-morenums">
                <Tiles rows={[['Strike rate', ratio(stats.runs * 100, stats.balls, 1)], ['Dots', stats.dots], ['Dot %', Math.round(100 * stats.dots / stats.balls) + '%'], ['Fours', stats.fours], ['Sixes', stats.sixes], ['Runs per out', stats.outs ? ratio(stats.runs, stats.outs, 1) : '–']]} />
            </Fold>}
            <Label>Meetings · newest first</Label>
            <div className="crx-meets">{(all ? shown : shown.slice(0, 4)).map((x) => {
                const t = TESTS[x.m]; const key = x.m + '-' + x.inn; let line = '';
                if (x.over) { const s = emptyStats(); addStats(s, x.over); line = `${plural(s.balls, 'ball')} · ${plural(s.runs, 'run')} · ${plural(s.outs, 'dismissal')}`; }
                else if (x.card) { const [k, r, b] = x.card; line = `Dismissed him for ${r}${b >= 0 ? ` (${b} balls)` : ''} · ${CODE_NAME[k]}`; }
                return <div className="crx-meet" key={key}>
                    <div className="crx-meethead"><span className="crx-meetlabel"><span className="crx-meetdate">{fmtDate(t.d)}</span><span className="crx-meetvenue">{' · '}{CODE[t.a]} v {CODE[t.b]} · {groundShort(t.g)} · {INNINGS_NAME[x.inn]}</span></span></div>
                    <div className="crx-meetline">{line}</div>
                    {x.over && <>
                        <button type="button" className="crx-ctabmorebtn crx-delbtn" onClick={() => setMore(more === key ? null : key)}>{more === key ? 'Hide ball by ball −' : 'Ball by ball +'}</button>
                        {more === key && <div className="crx-ov">{x.over.map((o) => <div className="crx-ovrow" key={o.over}><span className="crx-ovn">Over {o.over}</span><span className="crx-ovballs">{o.balls.map((b, i) => { const k = ballToken(b); return <span key={i} className={'crx-ovb' + (k.out ? ' crx-ovout' : '')} aria-label={k.aria}>{k.tok}</span>; })}</span></div>)}</div>}
                    </>}
                </div>;
            })}</div>
            <ShowMore open={all} onToggle={() => setAll(!all)} total={shown.length} shown={4} what="meetings" />
        </>}
    </div>);
}

// ============================================================ Country matchup
const OPPONENTS = (() => {
    const n = new Map<number, number>(); for (const t of TESTS) if (isIndia(t)) n.set(oppOf(t), (n.get(oppOf(t)) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o);
})();
const LAST_OPP = oppOf([...TESTS].reverse().find(isIndia)!);

export function IndiaCountry({ Selector }: any) {
    const [opp, setOpp] = useState<number>(LAST_OPP);
    const [where, setWhere] = useState('all');
    const [open, setOpen] = useState(false);
    const [all, setAll] = useState(false);
    const [lead, setLead] = useState(false);
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
        <div className="crx-hero"><div className="crx-heroname">India v {TEAMS[opp]}</div>
            {first && <div className="crx-herosub">{plural(allTests.length, 'Test')} · {yearOf(first.d)}{last && yearOf(last.d) !== yearOf(first.d) ? '–' + yearOf(last.d) : ''}</div>}</div>
        <Pills label="Where played" cls="crx-matchupmodes" value={where} onChange={(v) => { setWhere(v); setAll(false); }} items={[['all', 'All'], ['home', 'In India'], ['away', 'Away']]} />
        {tests.length === 0 ? <Hint>No Tests in this selection.</Hint> : <>
            <Tiles rows={[['Tests', tests.length], ['India won', won], [`${CODE[opp]} won`, lost], ['Drawn', drawn]]} />
            {tied > 0 && <p className="crx-fine">{tied === 1 ? '1 Test was tied.' : `${tied} Tests were tied.`}</p>}
            <Label>Highest and lowest totals</Label>
            <table className="crx-groundtable crx-tot"><thead><tr><th /><th>India</th><th>{CODE[opp]}</th></tr></thead><tbody>
                <tr><th>Highest</th>{cell(ti.hi)}{cell(to.hi)}</tr>
                <tr><th>Lowest (all out)</th>{cell(ti.lo)}{cell(to.lo)}</tr>
            </tbody></table>
            <Label>Tests · newest first</Label>
            <div className="crx-meets">{(all ? list : list.slice(0, 5)).map((t) => <TestRow key={t.i} t={t} />)}</div>
            <ShowMore open={all} onToggle={() => setAll(!all)} total={list.length} shown={5} what="Tests" />
            <Fold label="Top performers" note="runs and wickets" cls="crx-morerec">
                {[0, 1].map((s) => <div key={s}>
                    <div className="crx-hg-top">
                        <section><h4>{s === 0 ? 'India' : TEAMS[opp]} · most runs</h4>{leaders[s].bat.map((x) => <div className="crx-hg-topRow" key={x.p}><span className="crx-hg-topName">{pname(x.p)}<em>{x.tests} {x.tests === 1 ? 'Test' : 'Tests'}</em></span><strong>{n1(x.runs)}</strong></div>)}</section>
                        <section><h4>{s === 0 ? 'India' : TEAMS[opp]} · most wickets</h4>{leaders[s].bowl.map((x) => <div className="crx-hg-topRow" key={x.p}><span className="crx-hg-topName">{pname(x.p)}<em>{x.tests} {x.tests === 1 ? 'Test' : 'Tests'}</em></span><strong>{x.wkts}</strong></div>)}</section>
                    </div>
                </div>)}
            </Fold>
        </>}
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
    const options = useMemo(() => HAS_ROWS.map((x) => ({ value: x.i, label: plabel(x.i), searchText: x.name + ' ' + TEAMS[x.team] })), []);
    return countryView(<div>
        <Selector label="Player" value={p} placeholder="Pick a player" title="Player · India and every opponent" open={open} onToggle={() => setOpen(!open)} onChange={(v: number) => { setP(v); setOpen(false); }} options={options} />
        {p == null ? <Hint>Pick any India player, past or present, anyone still playing anywhere, or any opponent who has played India. Retired opponents show their Tests against India only.</Hint> : <PlayerCard key={p} p={p} />}
    </div>);
}

function PlayerCard({ p }: { p: number }) {
    const pl = PLAYERS[p];
    const bat = (batByPlayer.get(p) || []) as BatRow[]; const bowl = (bowlByPlayer.get(p) || []) as BowlRow[];
    const wk = bowl.reduce((a, r) => a + r[5], 0); const rn = bat.reduce((a, r) => a + r[3], 0);
    const [branch, setBranch] = useState(bat.length === 0 || (bowl.length > 0 && wk * 25 > rn) ? 'bowl' : 'bat');
    const [rec, setRec] = useState(false);
    const span = playerSpan(p);
    const ba = batAgg(bat); const bo = bowlAgg(bowl);
    const isBat = branch === 'bat';
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
    if (isBat) { for (const r of bat) if (r[7] > 0 && r[7] !== 5) { const k = r[8] >= 0 ? bowlKind(PLAYERS[r[8]]?.bowl || '') : '?'; styleCount.set(k, (styleCount.get(k) || 0) + 1); } }
    else { for (const r of credited) { const k = batHand(PLAYERS[r[2]]?.bat || ''); styleCount.set(k, (styleCount.get(k) || 0) + 1); } }
    const styleRows: [string, number][] = isBat
        ? BOWL_KINDS.map(([k, l]) => [l, styleCount.get(k) || 0] as [string, number])
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
    return <div className="crx-playercard">
        <div className="crx-hero"><div className="crx-heroname">{pl.name}</div>
            <div className="crx-herosub">{CODE[pl.team]}{sub ? ' · ' + sub : ''}{span ? ` · ${yearOf(span[0])}–${yearOf(span[1])}` : ''}</div></div>
        <Pills label="Branch" cls="crx-twomodes" value={branch} onChange={setBranch} items={[['bat', 'Batting analysis'], ['bowl', 'Bowling analysis']]} />
        {empty ? <p className="crx-hint">No {isBat ? 'batting' : 'bowling'} recorded in these Tests.</p> : <>
        {isBat ? <>
            <Tiles rows={[['Tests', ba.tests], ['Runs', n1(ba.runs)], ['Average', ba.avg], ['Hundreds', ba.h]]} />
            <Fold label="More numbers" cls="crx-morenums"><Tiles rows={[['Innings', ba.inns], ['Not outs', ba.no], ['High score', ba.hs + (ba.hsNo ? '*' : '')], ['Strike rate', ba.sr], ['Fifties', ba.f], ['Ducks', ba.ducks], ['Fours', n1(ba.fours)], ['Sixes', ba.sixes]]} /></Fold>
        </> : <>
            <Tiles rows={[['Tests', bo.tests], ['Wickets', n1(bo.wkts)], ['Average', bo.avg], ['Economy', bo.econ]]} />
            <Fold label="More numbers" cls="crx-morenums"><Tiles rows={[['Innings', bo.inns], ['Overs', bo.overs], ['Maidens', bo.maidens], ['Best innings', bo.best], ['5 wicket hauls', bo.w5], ['10 wicket Tests', bo.w10], ['Strike rate', bo.sr], ['Runs conceded', n1(bo.runs)]]} /></Fold>
        </>}
        {against ? <p className="crx-fine">{against}</p> : pl.team !== 0 ? <p className="crx-fine">Complete Test career, every opponent.</p> : null}
        <Label>{isBat ? 'How he gets out' : 'How he takes wickets'}</Label>
        {kindRows.some((r) => r[1] > 0) ? <Bars rows={kindRows} /> : <p className="crx-fine">No dismissals recorded.</p>}
        <Label>{isBat ? 'What kind of bowler gets him out' : 'Which batters he gets out'}</Label>
        {styleRows.some((r) => r[1] > 0)
            ? <><Bars rows={styleRows} />
                <p className="crx-fine">{styleNote}</p></>
            : <p className="crx-fine">No dismissals with a known {isBat ? 'bowling' : 'batting'} style.</p>}
        {topList.length > 0 && <>
            <Label>{isBat ? 'Dismissed most often by' : 'Dismissed most often'}</Label>
            <div className="crx-hg-top crx-one">{<section>{topList.map(([i, n]) => <div className="crx-hg-topRow" key={i}><span className="crx-hg-topName">{pname(i)}<em>{CODE[PLAYERS[i].team]}</em></span><strong>{n}</strong></div>)}</section>}</div>
        </>}
        {pl.full && oppRows.length > 1 && <Fold label="By opponent" note={`${oppRows.length} teams`}>
            {oppTable(oppRows.map(([o, v]) => ({ opp: o, label: TEAMS[o], vals: isBat ? (() => { const a = batAgg(v.bat); return [a.tests, n1(a.runs), a.avg, a.h]; })() : (() => { const a = bowlAgg(v.bowl); return [a.tests, a.wkts, a.avg, a.best]; })() })), isBat ? ['Opponent', 'Tests', 'Runs', 'Avg', '100s'] : ['Opponent', 'Tests', 'Wkts', 'Avg', 'Best'])}
        </Fold>}
        {grdRows.length > 0 && <Fold label="By ground" note={`${grdRows.length} grounds`}>
            {oppTable(grdRows.slice(0, 15).map(([g, v]) => ({ opp: g, label: groundShort(g), vals: isBat ? (() => { const a = batAgg(v.bat); return [a.tests, n1(a.runs), a.avg, a.h]; })() : (() => { const a = bowlAgg(v.bowl); return [a.tests, a.wkts, a.avg, a.best]; })() })), isBat ? ['Ground', 'Tests', 'Runs', 'Avg', '100s'] : ['Ground', 'Tests', 'Wkts', 'Avg', 'Best'])}
            {grdRows.length > 15 && <p className="crx-fine">Top 15 of {grdRows.length} grounds by {isBat ? 'runs' : 'wickets'}.</p>}
        </Fold>}
        <Fold label={isBat ? 'Recent innings' : 'Recent bowling'} note="newest first">
            <div className="crx-meets">{recent.map((r, i) => {
                const t = TESTS[r[0]];
                const line = isBat ? (() => { const b = r as BatRow; return `${b[3]}${b[7] === 0 ? '*' : ''}${b[4] >= 0 ? ` (${b[4]} balls)` : ''} · ${CODE_NAME[b[7]]}`; })() : (() => { const w = r as BowlRow; return `${w[5]}/${w[4]} from ${Math.floor(w[3] / 6)}${w[3] % 6 ? '.' + (w[3] % 6) : ''} overs`; })();
                return <div className="crx-meet" key={i}><div className="crx-meethead"><span className="crx-meetlabel"><span className="crx-meetdate">{fmtDate(t.d)}</span><span className="crx-meetvenue">{' · '}{CODE[t.a]} v {CODE[t.b]} · {groundShort(t.g)} · {INNINGS_NAME[r[1]]}</span></span></div><div className="crx-meetline">{line}</div></div>;
            })}</div>
            <ShowMore open={rec} onToggle={() => setRec(!rec)} total={(isBat ? bat : bowl).length} shown={6} what="innings" />
        </Fold>
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
    const dup = useMemo(() => { const c = new Map<string, number>(); for (const i of GROUND_IDS) { const k = groundName(i); c.set(k, (c.get(k) || 0) + 1); } return c; }, []);
    const options = useMemo(() => GROUND_IDS.map((i) => ({ value: i, label: groundName(i) + (dup.get(groundName(i))! > 1 ? ` (${GROUNDS[i].country})` : ''), searchText: groundName(i) + ' ' + GROUNDS[i].country })), [dup]);
    return countryView(<div className="crx-hagley">
        <Selector label="Ground" title="Ground · every ground India has played at" value={g} placeholder="Pick a ground" open={open} onToggle={() => setOpen(!open)} onChange={(v: number) => { setG(v); setOpen(false); setAllInd(false); }} options={options} />
        {g == null ? <Hint>Pick a ground.</Hint> : <GroundCard key={g} g={g} allInd={allInd} setAllInd={setAllInd} />}
    </div>);
}

function GroundCard({ g, allInd, setAllInd }: { g: number; allInd: boolean; setAllInd: (v: boolean) => void }) {
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
    return <div>
        <div className="crx-hero"><div className="crx-heroname">{GROUNDS[g].name}</div><div className="crx-herosub">{[GROUNDS[g].city, GROUNDS[g].country].filter(Boolean).join(', ')} · {plural(ts.length, 'Test')} {yrs}</div></div>
        <Label>Results</Label>
        <Tiles rows={[['Tests', done.length], ['Batting first won', batFirst], ['Chasing won', chase], ['Drawn', draws]]} />
        <Label>Scores</Label>
        <div className="crx-hg-scores">
            {avgFirst > 0 && <div className="crx-hg-score"><span>Average first innings</span><strong>{avgFirst}</strong></div>}
            {hi && <div className="crx-hg-score"><span>Highest total</span><strong>{hi[0]}</strong><em>{rowDetail(hi)}</em></div>}
            {lo && <div className="crx-hg-score"><span>Lowest all out</span><strong>{lo[0]}</strong><em>{rowDetail(lo)}</em></div>}
            {ch && <div className="crx-hg-score"><span>Highest winning chase</span><strong>{ch[0]}</strong><em>{rowDetail(ch)}</em></div>}
        </div>
        {A && dis > 0 && <>
            <Label>How wickets fall</Label>
            <Bars rows={KIND_LABELS.map((l, i) => [l, A.k[i]] as [string, number]).sort((a, b) => b[1] - a[1])} />
            <p className="crx-fine">{n1(dis)} dismissals{known > 20 ? ` · bowlers took ${Math.round(100 * ps[0] / known)}% of their wickets with pace and ${Math.round(100 * ps[1] / known)}% with spin` : ''}. All teams, every Test here.</p>
        </>}
        {A && (A.bat.length > 0 || A.bowl.length > 0) && <>
            <Label>Top players</Label>
            <div className="crx-hg-top">
                <Top title="Most runs" rows={A.bat.slice(0, 3)} unit={(r) => n1(r[2])} />
                <Top title="Most wickets" rows={A.bowl.slice(0, 3)} unit={(r) => String(r[2])} />
            </div>
        </>}
        {ind.length > 0 && <>
            <Label>India here</Label>
            <Tiles rows={[['Tests', ind.length], ['Won', iw], ['Lost', il], ['Drawn', idr]]} />
            <div className="crx-meets">{(allInd ? ind : ind.slice(0, 4)).map((t) => <TestRow key={t.i} t={t} vs />)}</div>
            <ShowMore open={allInd} onToggle={() => setAllInd(!allInd)} total={ind.length} shown={4} what="Tests" />
        </>}
    </div>;
}

