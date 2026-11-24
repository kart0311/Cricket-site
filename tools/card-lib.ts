// Builds the HTML for a shareable matchup card (bowler to batter) from the site's own data.
// Bundled and run by tools/card.mjs; the numbers come from app/indiaData.ts, the same file the site uses.
import {
    BAT, CODE, GROUNDS, INNINGS_NAME, PAIRS, PLAYERS, TESTS, THROUGH, PAIRS_FROM,
    addStats, emptyStats, fmtDate, fmtKinds, groundShort, n1, parseBalls, ratio, resultText, yearOf, CODE_LETTER, type Over, type PairStats,
} from '../app/india';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z ]/g, '').trim();
const sur = (p: number) => PLAYERS[p].name.split(' ').slice(-1)[0];
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const plural = (n: number, w: string) => `${n1(n)} ${n === 1 ? w : w + 's'}`;

export function findByName(name: string, team: number | null): number[] {
    const n = norm(name); const parts = n.split(' '); const last = parts[parts.length - 1]; const ini = parts[0][0];
    const hits = PLAYERS.filter((p) => (team === null || (team === 0 ? p.team === 0 : p.team !== 0)) && (() => {
        const pn = norm(p.name).split(' '); return norm(p.name) === n || (pn[pn.length - 1] === last && pn[0][0] === ini);
    })());
    return hits.sort((a, b) => b.last - a.last).map((p) => p.i);
}

export function cardHtml(bowler: number, batter: number, photo: string, site: string): string {
    const pair = PAIRS[bowler + ',' + batter];
    if (!pair) throw new Error(`No recorded meetings for ${PLAYERS[bowler].name} to ${PLAYERS[batter].name}`);
    const meets: { m: number; inn: number; over?: Over[]; card?: [number, number, number] }[] = [];
    for (const [m, i, s] of pair.m) meets.push({ m, inn: i, over: parseBalls(s) });
    for (const [m, i, kind, runs, balls] of pair.c) meets.push({ m, inn: i, card: [kind, runs, balls] });
    meets.sort((a, b) => b.m - a.m || b.inn - a.inn);
    const st: PairStats = emptyStats();
    for (const x of meets) {
        if (x.over) addStats(st, x.over);
        else if (x.card && x.card[0] > 0) { const l = CODE_LETTER[x.card[0]]; if (l && 'cblshk'.includes(l)) { st.outs++; st.kinds[l] = (st.kinds[l] || 0) + 1; } }
    }
    const hasCard = meets.some((x) => x.card);
    const nTests = new Set(meets.map((x) => x.m)).size;
    const B = sur(bowler), T = sur(batter);
    const bTone = PLAYERS[bowler].team === 0 ? 'ind' : 'opp'; const tTone = PLAYERS[batter].team === 0 ? 'ind' : 'opp';

    let verdict: string;
    if (st.balls > 0) {
        const sr = ratio(st.runs * 100, st.balls, 0);
        verdict = st.outs > 0
            ? (hasCard ? `${B} has dismissed ${T} ${times(st.outs)}. In the ${plural(st.balls, 'ball')} with ball-by-ball detail, ${T} scored ${n1(st.runs)} runs.`
                : `${B} has dismissed ${T} ${times(st.outs)} in ${plural(st.balls, 'ball')}, about once every ${Math.round(st.balls / st.outs)} balls. ${T} scored ${n1(st.runs)} runs at a strike rate of ${sr}.`)
            : `${B} has not dismissed ${T} in ${plural(st.balls, 'ball')}. ${T} scored ${n1(st.runs)} runs at a strike rate of ${sr}.`;
    } else verdict = `${B} has dismissed ${T} ${times(st.outs)}. These meetings have scorecard detail only, with no ball-by-ball record.`;
    const caveat = st.balls > 0 && st.balls < 30 ? `Only ${plural(st.balls, 'ball')} on record, so take this lightly.` : '';

    // runs per meeting with ball detail, oldest first
    const bars = meets.filter((x) => x.over).slice().reverse().map((x) => { const s = emptyStats(); addStats(s, x.over!); return { v: s.runs, out: s.outs > 0 }; });
    const maxV = Math.max(1, ...bars.map((b) => b.v));
    const chart = bars.length > 1 ? `<div class="chart"><div class="ct"><b>Runs in each meeting</b><span>dot = dismissed</span></div><div class="bars ${tTone}">${bars.map((b) => `<i class="${b.out ? 'out' : ''}" style="height:${Math.max(5, Math.round(100 * b.v / maxV))}%"></i>`).join('')}</div></div>` : '';

    const rows = meets.slice(0, 2).map((x) => {
        const t = TESTS[x.m]; let line = '';
        if (x.over) { const s = emptyStats(); addStats(s, x.over); line = `${plural(s.balls, 'ball')} · ${plural(s.runs, 'run')}${s.outs ? ' · dismissed' : ''}`; }
        else if (x.card) { const [k, r, b] = x.card; line = k > 0 ? `Dismissed for ${r}${b >= 0 ? ` (${b} balls)` : ''}` : `Not out, ${r}${b >= 0 ? ` (${b} balls)` : ''}`; }
        return `<div class="row"><span class="d">${esc(fmtDate(t.d))}</span><span class="v">${esc(groundShort(t.g))} · ${esc(INNINGS_NAME[x.inn])}</span><span class="r">${esc(line)}</span></div>`;
    }).join('');

    const dotPct = st.balls ? Math.round(100 * st.dots / st.balls) + '%' : '–';
    const tile = (v: string | number, l: string, cls = '') => `<div class="tile ${cls}"><b>${v}</b><span>${l}</span></div>`;
    const small = (v: string | number, l: string) => `<div class="sm"><b>${v}</b><span>${l}</span></div>`;
    const first = yearOf(TESTS[meets[meets.length - 1].m].d); const last = yearOf(TESTS[meets[0].m].d);

    return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;background:#43281d;color:#faebd7;font-family:-apple-system,'Segoe UI','Helvetica Neue','Liberation Sans','DejaVu Sans',Arial,sans-serif;position:relative;overflow:hidden}
.photo{height:230px;background:url(${photo}) center 48%/cover;position:relative}
.photo:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(67,40,29,0) 35%,#43281d 100%)}
.wrap{padding:0 72px;margin-top:-34px;position:relative}
.kick{font-size:24px;letter-spacing:.14em;text-transform:uppercase;color:#c6a78c}
.names{font-family:Georgia,'DejaVu Serif','Liberation Serif',serif;font-size:78px;line-height:1.04;margin:10px 0 4px;font-weight:400}
.names .to{font-size:40px;color:#c6a78c;display:block;margin:2px 0 0}
.ind{color:#f2a652}.opp{color:#6fc1d8}
.badge{display:inline-block;font-weight:700;font-size:22px;line-height:1;font-family:-apple-system,'Segoe UI','Helvetica Neue','Liberation Sans','DejaVu Sans',Arial,sans-serif;letter-spacing:.06em;padding:7px 12px;border:2px solid #7a5a49;border-radius:20px;color:#faebd7;vertical-align:middle;margin-left:14px;position:relative;top:-8px}
.badge i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px}
.sub{font-size:26px;color:#c6a78c;margin-bottom:20px}
.verdict{font-size:33px;line-height:1.34;border-left:6px solid #d9c3a5;padding:2px 0 2px 24px;margin-bottom:24px}
.verdict em{display:block;font-style:normal;font-size:28px;color:#e6b87f;margin-top:10px}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:10px}
.tile{border:2px solid #6b4a3a;padding:16px 0 14px;text-align:center}
.tile b{display:block;font-size:60px;line-height:1;font-weight:700}
.tile span{display:block;margin-top:10px;font-size:23px;color:#c6a78c}
.tile.red{box-shadow:inset 0 5px 0 #f2a652}
.smalls{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.sm{text-align:center;padding:6px 0}.sm b{display:block;font-size:34px}.sm span{font-size:21px;color:#c6a78c}
.chart{background:#4f3226;border:2px solid #6b4a3a;padding:14px 24px 14px;margin-bottom:14px}
.ct{display:flex;justify-content:space-between;font-size:24px;color:#c6a78c;margin-bottom:16px}.ct b{color:#faebd7;font-weight:600}
.bars{display:flex;align-items:flex-end;gap:7px;height:96px}.bars i{flex:1;max-width:44px;position:relative;background:#d9c3a5;border-radius:2px 2px 0 0}
.bars.ind i{background:#f2a652}.bars.opp i{background:#6fc1d8}
.bars i.out:after{content:"";position:absolute;top:-14px;left:50%;width:11px;height:11px;margin-left:-5px;border-radius:50%;background:#ff8a7a}
.rows{margin-bottom:6px}.row{display:grid;grid-template-columns:190px 1fr;gap:2px 14px;padding:9px 0;border-top:2px solid #5a3b2e;font-size:23px}
.row .d{font-weight:700}.row .v{color:#c6a78c}.row .r{grid-column:2;font-size:22px}
.foot{position:absolute;left:72px;right:72px;bottom:34px;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid #5a3b2e;padding-top:18px;font-size:22px;color:#c6a78c}
.foot>div:last-child{white-space:nowrap;font-size:21px}.foot b{display:block;color:#faebd7;font-size:26px;font-family:Georgia,'DejaVu Serif',serif;font-weight:400}.foot small{font-size:18px;color:#a58872}
</style></head><body>
<div class="photo"></div>
<div class="wrap">
<div class="kick">Test cricket · ball by ball</div>
<div class="names"><span class="${bTone}">${esc(PLAYERS[bowler].name)}</span><span class="badge"><i style="background:${PLAYERS[bowler].team === 0 ? '#f2a652' : '#6fc1d8'}"></i>${esc(CODE[PLAYERS[bowler].team])}</span><span class="to">to <span class="${tTone}">${esc(PLAYERS[batter].name)}</span><span class="badge"><i style="background:${PLAYERS[batter].team === 0 ? '#f2a652' : '#6fc1d8'}"></i>${esc(CODE[PLAYERS[batter].team])}</span></span></div>
<div class="sub">${esc(plural(nTests, 'Test'))} · ${first === last ? first : first + '–' + last}${hasCard ? ' · some meetings scorecard only' : ''}</div>
<div class="verdict">${esc(verdict)}${caveat ? `<em>${esc(caveat)}</em>` : ''}</div>
<div class="tiles">${tile(n1(st.balls), 'Balls')}${tile(n1(st.runs), st.runs === 1 ? 'Run' : 'Runs')}${tile(st.outs, st.outs === 1 ? 'Dismissal' : 'Dismissals', 'red')}${tile(nTests, nTests === 1 ? 'Test' : 'Tests')}</div>
<div class="smalls">${small(st.balls ? ratio(st.runs * 100, st.balls, 1) : '–', 'Strike rate')}${small(dotPct, 'Dot balls')}${small(st.fours, 'Fours')}${small(st.sixes, 'Sixes')}</div>
${chart}
<div class="rows">${rows}</div>
</div>
<div class="foot"><div><b>Indian Cricket · Beyond the Scoreboard</b><small>Ball-by-ball data: Cricsheet (ODC-By 1.0) · Tests since ${esc(fmtDate(PAIRS_FROM))}</small></div><div>${esc(site)}</div></div>
</body></html>`;
}
