// Play analysis: for a chosen Test and ground, which bowler has the edge over which batter, from the likely players.
// Reads series files (refresh/series/*.json) through seriesModel.ts; the arithmetic lives in edge.ts.
import React, { useEffect, useMemo, useState } from 'react';
import { SERIES, loadModel, type Cfg, type Fixture, type Model, type SPlayer } from './seriesModel';
import { pairEdge, fmt1, type Edge } from './edge';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso: string) => { const p = iso.split('-'); return `${Number(p[2])} ${MONTHS[Number(p[1]) - 1]} ${p[0]}`; };
const fmtStamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const COLOR: Record<string, string> = { India: '#3987e5', Australia: '#e0a43a', 'New Zealand': '#199e70' };
const short = (n: string) => { const t = n.split(' '); return t.length > 1 ? t[0][0] + ' ' + t.slice(1).join(' ') : n; };
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function timing(f: Fixture, now: number) {
    const s = Date.parse(f.start); const e = s + f.days * 864e5;
    if (now < s) { const d = Math.ceil((s - now) / 864e5); return { kind: 'up', text: d === 1 ? 'Starts tomorrow' : `Starts in ${d} days` }; }
    if (now < e) return { kind: 'on', text: `In progress · day ${Math.min(f.days, Math.floor((now - s) / 864e5) + 1)} of ${f.days}` };
    return { kind: 'done', text: 'Finished' };
}
const firstOpen = (cfg: Cfg, now: number) => { const i = cfg.fixtures.findIndex((f) => timing(f, now).kind !== 'done'); return i < 0 ? cfg.fixtures.length - 1 : i; };

type Duel = { bowler: SPlayer; batter: SPlayer; e: Edge };

export function PlayAnalysis() {
    const models = useMemo(() => SERIES.map(loadModel), []);
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

    const [sid, setSid] = useState(SERIES[0].id);
    const [fxIdx, setFxIdx] = useState<Record<string, number>>(() => Object.fromEntries(SERIES.map((c) => [c.id, firstOpen(c, Date.now())])));
    const [chosen, setChosen] = useState<Record<string, string[]>>(() => Object.fromEntries(SERIES.map((c) => [c.id, c.squads.filter((p) => p.likely).map((p) => p.name)])));
    const [batTeam, setBatTeam] = useState<Record<string, string>>(() => Object.fromEntries(SERIES.map((c) => [c.id, c.squads[0].team])));
    const [view, setView] = useState<'batter' | 'bowler'>('batter');
    const [topN, setTopN] = useState(2);

    const model: Model = models.find((m) => m.cfg.id === sid)!;
    const cfg = model.cfg;
    const fixture = cfg.fixtures[fxIdx[sid]];
    const venue = cfg.venues.find((v) => v.key === fixture.venue)!;
    const teams = useMemo(() => Array.from(new Set(cfg.squads.map((p) => p.team))), [cfg]);
    const bt = batTeam[sid];
    const on = useMemo(() => new Set(chosen[sid]), [chosen, sid]);
    const tm = timing(fixture, now);

    const isBowler = (p: SPlayer) => !!p.style || (model.bowl.get(p.name)?.balls ?? 0) >= 600;

    const calc = useMemo(() => {
        const edgeFor = (b: SPlayer, a: SPlayer) => pairEdge({
            pair: model.pairs.get(b.name + '|' + a.name), groundPair: model.gpairs.get(venue.key + '|' + b.name + '|' + a.name),
            bowlCareer: model.bowl.get(b.name), batCareer: model.bat.get(a.name),
            bowlGround: model.vbowl.get(venue.key + '|' + b.name), batGround: model.vbat.get(venue.key + '|' + a.name),
        });
        const side = (battingTeam: string) => {
            const batters = cfg.squads.filter((p) => on.has(p.name) && p.team === battingTeam);
            const bowlers = cfg.squads.filter((p) => on.has(p.name) && p.team !== battingTeam && isBowler(p));
            const duels: Duel[] = [];
            batters.forEach((a) => bowlers.forEach((b) => { const e = edgeFor(b, a); if (e) duels.push({ bowler: b, batter: a, e }); }));
            return { batters, bowlers, duels };
        };
        const sides: Record<string, ReturnType<typeof side>> = {};
        teams.forEach((t) => { sides[t] = side(t); });
        return sides;
    }, [model, cfg, venue.key, on, teams]);

    const cur = calc[bt];
    const all = teams.flatMap((t) => calc[t].duels);
    const keyDuels = all.filter((d) => (d.e.conf === 'Solid' || d.e.conf === 'Some') && (d.e.label === 'Strong edge' || d.e.label === 'Edge')).sort((x, y) => y.e.ratio - x.e.ratio).slice(0, 3);
    const ahead = all.filter((d) => d.e.balls >= 100 && d.e.label === 'Batter ahead').sort((x, y) => x.e.ratio - y.e.ratio).slice(0, 2);

    const toggle = (name: string) => setChosen((c) => ({ ...c, [sid]: c[sid].includes(name) ? c[sid].filter((n) => n !== name) : c[sid].concat(name) }));
    const setAll = (likelyOnly: boolean) => setChosen((c) => ({ ...c, [sid]: cfg.squads.filter((p) => !likelyOnly || p.likely).map((p) => p.name) }));
    const bowlTeam = teams.find((t) => t !== bt)!;
    const col = (t: string) => COLOR[t] || '#c6a78c';

    /* ---- ground facts ---- */
    const vf = model.venues.get(venue.key);
    const groundBat = cfg.squads.filter((p) => on.has(p.name)).map((p) => ({ p, r: model.vbat.get(venue.key + '|' + p.name) })).filter((x) => x.r && x.r.runs > 0).sort((x, y) => y.r!.runs - x.r!.runs).slice(0, 4);
    const groundBowl = cfg.squads.filter((p) => on.has(p.name)).map((p) => ({ p, r: model.vbowl.get(venue.key + '|' + p.name) })).filter((x) => x.r && x.r.wkts > 0).sort((x, y) => y.r!.wkts - x.r!.wkts).slice(0, 4);
    const styleAt = (s: 'Pace' | 'Spin') => {
        let balls = 0, runs = 0, wkts = 0;
        cfg.squads.filter((p) => p.style === s).forEach((p) => { const r = model.vbowl.get(venue.key + '|' + p.name); if (r) { balls += r.balls; runs += r.runs; wkts += r.wkts; } });
        return { balls, runs, wkts };
    };
    const pace = styleAt('Pace'); const spin = styleAt('Spin');

    const row = (name: string, tag: string | undefined, e: Edge, who: SPlayer, key: string) => {
        const w = Math.max(3, Math.min(100, (e.ratio / 2.4) * 100));
        const ev = e.balls > 0
            ? `${plural(e.outs, 'dismissal')} in ${e.balls} balls${e.avg ? ` · avg ${fmt1(e.avg)}` : ''}${e.sr ? ` · SR ${Math.round(e.sr)}` : ''} · ${plural(e.tests, 'Test')}`
            : 'Have not met in the data. Estimate comes from each player\'s career record';
        return <li key={key} className={'crx-pa-row crx-pa-' + e.label.toLowerCase().replace(/\s/g, '-')}>
            <div className="crx-pa-who"><strong>{name}</strong>{tag && <i>{tag}</i>}</div>
            <div className="crx-pa-meter" role="img" aria-label={`Estimated one wicket every ${Math.round(e.ballsPerWkt)} balls`}>
                <span className="crx-pa-track"><span className="crx-pa-fill" style={{ width: w + '%', background: col(who.team) }} /><span className="crx-pa-avg" /></span>
            </div>
            <div className="crx-pa-verdict"><b>{e.label}</b><span>{e.conf === 'Projected' ? 'projected: ' : 'about '}1 wicket per {Math.round(e.ballsPerWkt)} balls · his norm {Math.round(e.baseBalls)}</span></div>
            <div className="crx-pa-ev">{ev}{e.groundNote ? ` · ${e.groundNote}` : ''} · <em className={'crx-pa-conf crx-pa-c-' + e.conf.toLowerCase()}>{e.conf}</em></div>
        </li>;
    };

    const pick = (name: string, e: Edge, key: string) => <span key={key} className={'crx-pa-pick crx-pa-' + e.label.toLowerCase().replace(/\s/g, '-')}><i aria-hidden="true" />{name}<em>{e.label}</em></span>;

    const groundLine = (p: SPlayer, mode: 'bat' | 'bowl') => {
        if (mode === 'bat') { const r = model.vbat.get(venue.key + '|' + p.name); return r && r.runs > 0 ? `At ${venue.city}: ${plural(r.tests, 'Test')}, ${r.runs} runs${r.outs ? ` @ ${fmt1(r.runs / r.outs)}` : ''}` : `No Test at ${venue.city} in the data`; }
        const r = model.vbowl.get(venue.key + '|' + p.name); return r && r.balls > 0 ? `At ${venue.city}: ${plural(r.tests, 'Test')}, ${r.wkts} wkts${r.wkts ? ` @ ${fmt1(r.runs / r.wkts)}` : ''}` : `No Test at ${venue.city} in the data`;
    };

    /* ---- by batter / by bowler lists ---- */
    const byBatter = cur.batters.map((a) => {
        const list = cur.duels.filter((d) => d.batter.name === a.name).sort((x, y) => y.e.ratio - x.e.ratio).slice(0, topN);
        return { a, list };
    }).filter((x) => x.list.length);
    const byBowler = cur.bowlers.map((b) => {
        const list = cur.duels.filter((d) => d.bowler.name === b.name).sort((x, y) => y.e.ratio - x.e.ratio).slice(0, topN);
        return { b, list };
    }).filter((x) => x.list.length);

    const nSel = cfg.squads.filter((p) => on.has(p.name)).length;
    const hasGround = groundBat.length > 0 || groundBowl.length > 0 || pace.balls > 0 || spin.balls > 0;

    return <section className="crx-pa" id="play-analysis" aria-label="Play analysis">
        <div className="crx-ov-tabs" role="group" aria-label="Series">
            {SERIES.map((c) => <button key={c.id} type="button" aria-pressed={sid === c.id} className={sid === c.id ? 'on' : ''} onClick={() => { setSid(c.id); }}>{c.title} · {c.subtitle.split(' · ')[0]}</button>)}
        </div>

        {cfg.fixtures.length > 1 && <div className="crx-pa-fixtures" role="group" aria-label="Test in the series">
            {cfg.fixtures.map((f, i) => {
                const v = cfg.venues.find((x) => x.key === f.venue)!; const t = timing(f, now);
                return <button key={f.n} type="button" aria-pressed={fxIdx[sid] === i} className={'crx-pa-fx' + (fxIdx[sid] === i ? ' on' : '')} onClick={() => setFxIdx((s) => ({ ...s, [sid]: i }))}>
                    <b>{f.label}</b><span>{v.city}</span><em>{f.dates}</em><u className={'crx-pa-t-' + t.kind}>{t.text}</u>
                </button>;
            })}
        </div>}

        <div className="crx-ov-panel crx-pa-card">
            <h3 className="crx-ov-h">{venue.name}, {venue.city}</h3>
            <div className="crx-ov-venue">{fixture.label} · {fixture.dates}{fixture.time ? ` · ${fixture.time}` : ''} · <span className={'crx-pa-t-' + tm.kind}>{tm.text}</span></div>
            {model.live && <div className="crx-pa-livebar"><span className="crx-ov-live" aria-hidden="true" />Live: includes {model.live.balls} balls from the Test in progress, as of {fmtStamp(model.live.asOf)}.</div>}
            {vf && vf.tests > 0 && <div className="crx-ov-tiles crx-pa-tiles">
                <div><strong>{vf.tests}</strong><span>Tests here in the data</span></div>
                <div><strong>{vf.firstAvg ?? '–'}</strong><span>Avg first-innings total</span></div>
                <div><strong>{vf.chase}–{vf.batFirst}</strong><span>Chasing – batting-first wins{vf.draws ? ` (${vf.draws} drawn)` : ''}</span></div>
            </div>}
            {(!vf || vf.tests === 0) && model.source !== 'none' && <div className="crx-ov-note">No earlier Test at this ground in the data, so ground form is left out.</div>}
            {hasGround && <details className="crx-pa-fold crx-pa-more">
                <summary>More on this ground</summary>
                {(groundBat.length > 0 || groundBowl.length > 0) && <div className="crx-pa-two">
                    {groundBat.length > 0 && <div><div className="crx-ov-sub">Runs here, selected players</div><ul className="crx-pa-mini">{groundBat.map(({ p, r }) => <li key={p.name}><span>{p.name}</span><b>{r!.runs}</b><em>{r!.outs ? `avg ${fmt1(r!.runs / r!.outs)}` : 'not out'} · {plural(r!.tests, 'Test')}</em></li>)}</ul></div>}
                    {groundBowl.length > 0 && <div><div className="crx-ov-sub">Wickets here, selected players</div><ul className="crx-pa-mini">{groundBowl.map(({ p, r }) => <li key={p.name}><span>{p.name}</span><b>{r!.wkts}</b><em>avg {fmt1(r!.runs / r!.wkts)} · {plural(r!.tests, 'Test')}</em></li>)}</ul></div>}
                </div>}
                {(pace.balls > 0 || spin.balls > 0) && <div className="crx-ov-note">Pace v spin here, squad bowlers only: pace {plural(pace.wkts, 'wicket')}{pace.wkts ? ` @ ${fmt1(pace.runs / pace.wkts)}` : ''}, spin {plural(spin.wkts, 'wicket')}{spin.wkts ? ` @ ${fmt1(spin.runs / spin.wkts)}` : ''}.</div>}
            </details>}
        </div>

        {model.source === 'none' ? <div className="crx-ov-panel crx-pa-empty">
            <div className="crx-ov-kicker">No ball-by-ball data loaded yet</div>
            <p className="crx-ov-text">Rankings for {cfg.title} fill in after the daily refresh runs on your Mac. Until then this tab shows only fixtures, grounds and probable squads.</p>
        </div> : <>
            {(keyDuels.length > 0 || ahead.length > 0) && <div className="crx-ov-panel crx-pa-key">
                <div className="crx-ov-kicker">Key duels at {venue.city}</div>
                <ul className="crx-pa-keys">
                    {keyDuels.map((d, i) => <li key={'k' + i}><strong>{d.bowler.name}</strong> <span className="crx-ov-to">to</span> <strong>{d.batter.name}</strong><span className="crx-pa-keyv">{d.e.label} · 1 wicket per {Math.round(d.e.ballsPerWkt)} balls · {plural(d.e.outs, 'dismissal')} in {d.e.balls} balls</span></li>)}
                    {ahead.map((d, i) => <li key={'a' + i}><strong>{d.batter.name}</strong> <span className="crx-ov-to">against</span> <strong>{d.bowler.name}</strong><span className="crx-pa-keyv">Batter ahead · {plural(d.e.outs, 'dismissal')} in {d.e.balls} balls{d.e.avg ? ` · avg ${fmt1(d.e.avg)}` : ''}</span></li>)}
                </ul>
            </div>}

            <div className="crx-pa-controls">
                <div className="crx-ov-tabs" role="group" aria-label="Which side bats">
                    {teams.map((t) => <button key={t} type="button" aria-pressed={bt === t} className={bt === t ? 'on' : ''} onClick={() => setBatTeam((s) => ({ ...s, [sid]: t }))}>{t} batting</button>)}
                </div>
                <div className="crx-ov-tabs" role="group" aria-label="How to list">
                    <button type="button" aria-pressed={view === 'batter'} className={view === 'batter' ? 'on' : ''} onClick={() => setView('batter')}>By batter</button>
                    <button type="button" aria-pressed={view === 'bowler'} className={view === 'bowler' ? 'on' : ''} onClick={() => setView('bowler')}>By bowler</button>
                </div>
            </div>
            <p className="crx-pa-hint">{view === 'batter' ? `Each ${bt} batter, with the ${bowlTeam} bowlers most likely to dismiss him.` : `Each ${bowlTeam} bowler, with the ${bt} batters he is most likely to dismiss.`} A bar past the notch beats that batter's usual odds.</p>

            {cur.duels.length === 0 ? <div className="crx-ov-panel"><p className="crx-ov-text">Select at least one batter and one bowler from the other side in Squads below.</p></div> :
                view === 'batter'
                    ? <ul className="crx-pa-list">{byBatter.map(({ a, list }) => <li key={a.name}><details className="crx-pa-block">
                        <summary><span className="crx-pa-sumname"><strong>{a.name}</strong>{a.role && <i>{a.role}</i>}</span>
                            <span className="crx-pa-picks">{list.map((d) => pick(short(d.bowler.name), d.e, d.bowler.name))}</span></summary>
                        <div className="crx-pa-ground">{groundLine(a, 'bat')}</div>
                        <ul>{list.map((d) => row(short(d.bowler.name), d.bowler.style, d.e, d.bowler, d.bowler.name))}</ul>
                    </details></li>)}</ul>
                    : <ul className="crx-pa-list">{byBowler.map(({ b, list }) => <li key={b.name}><details className="crx-pa-block">
                        <summary><span className="crx-pa-sumname"><strong>{b.name}</strong>{b.style && <i>{b.style}</i>}</span>
                            <span className="crx-pa-picks">{list.map((d) => pick(short(d.batter.name), d.e, d.batter.name))}</span></summary>
                        <div className="crx-pa-ground">{groundLine(b, 'bowl')}</div>
                        <ul>{list.map((d) => row(short(d.batter.name), d.batter.role, d.e, d.bowler, d.batter.name))}</ul>
                    </details></li>)}</ul>}
            {cur.duels.length > 0 && <button type="button" className="crx-pa-more-btn" onClick={() => setTopN(topN === 2 ? 3 : 2)}>{topN === 2 ? 'Show a third name for each' : 'Show only the top two'}</button>}
        </>}

        <details className="crx-pa-fold crx-pa-squad">
            <summary><span>Squads</span><em>{nSel} selected{cfg.squadStatus === 'probable' ? ' · probable, not announced' : ''}</em></summary>
            <p className="crx-pa-note">{cfg.squadNote}</p>
            <div className="crx-ov-tabs" role="group" aria-label="Quick pick">
                <button type="button" onClick={() => setAll(true)}>Probable XI</button>
                <button type="button" onClick={() => setAll(false)}>Whole squad</button>
            </div>
            <div className="crx-pa-teams">
                {teams.map((t) => <div key={t} className="crx-pa-team">
                    <div className="crx-pa-teamname"><i style={{ background: col(t) }} />{t}<span>{cfg.squads.filter((p) => p.team === t && on.has(p.name)).length} selected</span></div>
                    <div className="crx-pa-chips">
                        {cfg.squads.filter((p) => p.team === t).map((p) => <button key={p.name} type="button" aria-pressed={on.has(p.name)} className={'crx-pa-chip' + (on.has(p.name) ? ' on' : '')} onClick={() => toggle(p.name)}>
                            {p.name}{(p.style || p.role) && <i>{p.style || p.role}</i>}
                        </button>)}
                    </div>
                </div>)}
            </div>
        </details>

        <details className="crx-pa-fold crx-pa-how">
            <summary>How the estimate works</summary>
            <p className="crx-pa-note">Start from the two players' career rates, blend in what happened between them (a meeting counts fully once it passes about 90 balls), then nudge up or down, at most 40%, for each player's record at this ground. The label compares the result with how often that batter normally gets out. "Projected" means the pair have not met. Solid is 150+ balls together, Some 60+, Thin fewer. It is a guide, not a forecast; pitch and conditions on the day can override it.</p>
        </details>

        <div className="crx-ov-foot">
            {model.source === 'cricsheet'
                ? <>Data: Cricsheet (cricsheet.org), ODC-By 1.0, {model.matches} men's Tests up to {fmtDate(model.through)}; refreshed {new Date(model.generated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.</>
                : <>Data: the site's own matchup records. Run the refresh to widen it with Cricsheet (cricsheet.org, ODC-By 1.0).</>}
        </div>
    </section>;
}
