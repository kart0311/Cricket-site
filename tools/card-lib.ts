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

    const rows = meets.slice(0, 8).map((x) => {
        const t = TESTS[x.m]; let line = ''; let out = false;
        if (x.over) { const s = emptyStats(); addStats(s, x.over); out = s.outs > 0; line = `${plural(s.runs, 'run')} off ${plural(s.balls, 'ball')}${out ? ', dismissed' : ''}`; }
        else if (x.card) { const [k, r, b] = x.card; out = k > 0; line = k > 0 ? `Dismissed for ${r}${b >= 0 ? ` off ${b} balls` : ''}` : `Not out, ${r}${b >= 0 ? ` off ${b} balls` : ''}`; }
        return `<div class="row"><i class="${out ? 'o' : ''}"></i><div class="rt"><b>${esc(fmtDate(t.d))}</b><span>${esc(groundShort(t.g))} · ${esc(INNINGS_NAME[x.inn])}</span></div><div class="rr">${esc(line)}</div></div>`;
    }).join('');

    const dotPct = st.balls ? Math.round(100 * st.dots / st.balls) + '%' : '–';
    const tile = (v: string | number, l: string, cls = '') => `<div class="tile ${cls}"><b>${v}</b><span>${l}</span></div>`;
    const small = (v: string | number, l: string) => `<div class="sm"><b>${v}</b><span>${l}</span></div>`;
    const first = yearOf(TESTS[meets[meets.length - 1].m].d); const last = yearOf(TESTS[meets[0].m].d);

    const F = "-apple-system,'Segoe UI','Helvetica Neue','Liberation Sans','DejaVu Sans',Arial,sans-serif";
    const S = "Georgia,'DejaVu Serif','Liberation Serif',serif";
    const col = (t: number) => (t === 0 ? '#f2a652' : '#6fc1d8');
    const side = (p: number, role: string, accent: string) => `<div class="side"><div class="role">${role}</div><div class="nm" style="color:${accent}">${esc(PLAYERS[p].name)}</div><div class="bd"><i style="background:${accent}"></i>${esc(CODE[PLAYERS[p].team])}</div></div>`;
    const yrs = bars.length > 1 ? `<div class="yrs"><span>${first}</span><span>${last}</span></div>` : '';
    return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:radial-gradient(1200px 700px at 85% 0%,#5a3626 0%,#43281d 55%,#38201a 100%);color:#faebd7;font-family:${F};position:relative;overflow:hidden;display:flex;flex-direction:column}
.photo{height:250px;flex:none;background:url(${photo}) center 46%/cover;position:relative}
.photo:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(56,32,26,.15) 0%,rgba(56,32,26,0) 30%,#43281d 100%)}
.kick{position:absolute;left:72px;bottom:18px;z-index:2;font-size:21px;letter-spacing:.2em;text-transform:uppercase;color:#e0c3a6;font-weight:600}
.kick:before{content:"";display:inline-block;width:34px;height:3px;background:#f2a652;vertical-align:middle;margin-right:14px;position:relative;top:-2px}
.wrap{flex:1;min-height:0;display:flex;flex-direction:column;padding:6px 72px 0}
.vs{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:14px;margin-bottom:12px}
.side .role{font-size:19px;letter-spacing:.16em;text-transform:uppercase;color:#a58872;margin-bottom:6px}
.side .nm{font-family:${S};font-size:50px;line-height:1.05}
.side .bd{display:inline-flex;align-items:center;margin-top:12px;font-weight:700;font-size:20px;letter-spacing:.08em;padding:6px 14px;border:2px solid #7a5a49;border-radius:20px}
.side .bd i{width:11px;height:11px;border-radius:50%;margin-right:9px}
.side:last-child{text-align:right}.side:last-child .bd{float:right}
.mid{font-family:${S};font-style:italic;font-size:34px;color:#a58872;padding-bottom:50px}
.sub{font-size:23px;color:#c6a78c;margin:8px 0 22px;display:flex;align-items:center;gap:14px}.sub:before,.sub:after{content:"";height:2px;background:#5a3b2e;flex:1}
.verdict{font-family:${S};font-size:34px;line-height:1.3;margin-bottom:22px;color:#fff3e3}
.verdict em{display:block;font-family:${F};font-style:normal;font-size:23px;color:#e6b87f;margin-top:10px}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:12px}
.tile{background:rgba(255,255,255,.04);border:2px solid #6b4a3a;border-radius:14px;padding:16px 0 13px;text-align:center}
.tile b{display:block;font-size:60px;line-height:1;font-weight:700}
.tile span{display:block;margin-top:9px;font-size:21px;color:#c6a78c;letter-spacing:.04em}
.tile.red{border-color:#f2a652;background:rgba(242,166,82,.1)}.tile.red b{color:#ffc27e}
.smalls{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px;padding:4px 0}
.sm{text-align:center}.sm b{display:block;font-size:32px}.sm span{font-size:20px;color:#c6a78c}
.chart{background:rgba(0,0,0,.18);border:2px solid #6b4a3a;border-radius:14px;padding:14px 24px 12px;margin-bottom:14px}
.ct{display:flex;justify-content:space-between;font-size:22px;color:#c6a78c;margin-bottom:10px}.ct b{color:#faebd7;font-weight:600}
.bars{display:flex;align-items:flex-end;justify-content:center;gap:7px;height:92px;border-bottom:2px solid #6b4a3a}.bars i{flex:1;max-width:70px;position:relative;background:#d9c3a5;border-radius:4px 4px 0 0;min-height:4px}
.bars.ind i{background:#f2a652}.bars.opp i{background:#6fc1d8}
.bars i.out:after{content:"";position:absolute;top:-15px;left:50%;width:11px;height:11px;margin-left:-5px;border-radius:50%;background:#ff8a7a}
.yrs{display:flex;justify-content:space-between;font-size:18px;color:#a58872;margin-top:6px}
.rh{font-size:19px;letter-spacing:.16em;text-transform:uppercase;color:#a58872;margin:2px 0 4px}
.rows{flex:1;min-height:0;overflow:hidden}
.row{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:16px;padding:11px 0;border-top:2px solid #5a3b2e;height:74px}
.row i{width:12px;height:12px;border-radius:50%;background:#6b4a3a}.row i.o{background:#ff8a7a}
.rt b{display:block;font-size:24px}.rt span{display:block;font-size:20px;color:#c6a78c;margin-top:3px}
.rr{font-size:22px;text-align:right;color:#f1dcc4}
.foot{flex:none;margin:0 72px;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid #5a3b2e;padding:16px 0 34px;font-size:21px;color:#c6a78c}
.foot>div:last-child{white-space:nowrap;color:#f2a652;font-weight:600}
.foot b{display:block;color:#faebd7;font-size:27px;font-family:${S};font-weight:400;margin-bottom:4px}.foot small{font-size:17px;color:#a58872}
</style></head><body>
<div class="photo"><div class="kick">Test cricket · ball by ball</div></div>
<div class="wrap">
<div class="vs">${side(bowler, 'Bowler', col(PLAYERS[bowler].team))}<div class="mid">to</div>${side(batter, 'Batter', col(PLAYERS[batter].team))}</div>
<div class="sub">${esc(plural(nTests, 'Test'))} · ${first === last ? first : first + ' to ' + last}${hasCard ? ' · some scorecard only' : ''}</div>
<div class="verdict">${esc(verdict)}${caveat ? `<em>${esc(caveat)}</em>` : ''}</div>
<div class="tiles">${tile(n1(st.balls), 'Balls')}${tile(n1(st.runs), st.runs === 1 ? 'Run' : 'Runs')}${tile(st.outs, st.outs === 1 ? 'Dismissal' : 'Dismissals', 'red')}${tile(nTests, nTests === 1 ? 'Test' : 'Tests')}</div>
<div class="smalls">${small(st.balls ? ratio(st.runs * 100, st.balls, 1) : '–', 'Strike rate')}${small(dotPct, 'Dot balls')}${small(st.fours, 'Fours')}${small(st.sixes, 'Sixes')}</div>
${chart.replace('</div></div>', '</div>' + yrs + '</div>')}
<div class="rh">Most recent meetings</div>
<div class="rows" id="rows">${rows}</div>
</div>
<div class="foot"><div><b>Indian Cricket · Beyond the Scoreboard</b><small>Ball-by-ball data: Cricsheet (ODC-By 1.0) · Tests since ${esc(fmtDate(PAIRS_FROM))}</small></div><div>${esc(site)}</div></div>
</body></html>`;
}
