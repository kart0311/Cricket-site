// Cricsheet Test JSON -> per-series data for the site. Pure functions so they can be tested without a network.
// Format reference: https://cricsheet.org/format/json/ (batter / bowler / runs.batter / extras.wides / wickets[].kind ...).
//
// For each series (refresh/series/*.json) one pass over the archive produces:
//   cells   "Bowler|Batter"            -> [balls, runs, dots, outs, tests, lastDate]   every Test, every ground
//   vcells  "venue|Bowler|Batter"      -> [balls, runs, outs]                           only at the series' grounds
//   bat     "Player"                   -> [tests, innings, runs, balls, outs, creditedOuts]   career
//   bowl    "Player"                   -> [tests, innings, balls, runs, wkts]                 career
//   vbat / vbowl "venue|Player"        -> same shapes, at that ground only
//   venues  "venue"                    -> [tests, avgFirstInnings, batFirstWins, chaseWins, draws, lastDate]

// Dismissals credited to the bowler. Run outs and retirements are not.
export const CREDITED = new Set(['bowled', 'caught', 'caught and bowled', 'lbw', 'stumped', 'hit wicket']);

const lastWord = (s) => s.trim().split(/\s+/).slice(-1)[0].toLowerCase();

/** Teams that appear in any series, so a first pass can collect the names Cricsheet uses for them. */
export function teamsOf(configs) {
    return new Set(configs.flatMap((c) => c.squads.map((p) => p.team)));
}

/** First pass: remember every name Cricsheet lists per team. */
export function collectNames(m, wanted, names) {
    const info = m.info || {};
    if (info.match_type && info.match_type !== 'Test') return;
    for (const [team, list] of Object.entries(info.players || {})) {
        if (!wanted.has(team)) continue;
        let set = names.get(team);
        if (!set) { set = new Set(); names.set(team, set); }
        for (const n of list || []) set.add(n);
    }
}

/**
 * Makes the squad config forgiving: when the configured Cricsheet name never occurs, look for the one name in that team
 * with the same surname (and, if several, the same first initial). Returns the squad with `raw` filled in and notes.
 */
export function resolveSquad(squad, names) {
    const notes = [];
    const out = squad.map((p) => {
        const set = names.get(p.team) || new Set();
        if (p.raw && set.has(p.raw)) return { ...p };
        const sn = lastWord(p.name);
        let cands = [...set].filter((n) => lastWord(n) === sn);
        if (cands.length > 1) {
            const ini = p.name.trim()[0].toLowerCase();
            const narrowed = cands.filter((n) => n.trim()[0].toLowerCase() === ini);
            if (narrowed.length) cands = narrowed;
        }
        if (cands.length === 1) { notes.push(`${p.name}: using Cricsheet name "${cands[0]}"` + (p.raw ? ` (configured "${p.raw}" not found)` : '')); return { ...p, raw: cands[0] }; }
        notes.push(`${p.name}: no Test found in Cricsheet` + (cands.length > 1 ? ` (several candidates: ${cands.join(', ')}; set "raw" in the series file)` : ' (uncapped, or the name needs "raw" set)'));
        return { ...p, raw: p.raw || p.name, unresolved: true };
    });
    return { squad: out, notes };
}

export function makeSquadIndex(squads) {
    const index = new Map();
    for (const p of squads) {
        index.set(p.raw, p);
        for (const alt of p.alt || []) index.set(alt, p);
    }
    return index;
}

export function makeSeries(cfg, squad) {
    return {
        cfg, squads: squad, index: makeSquadIndex(squad),
        cells: new Map(), vcells: new Map(), bat: new Map(), bowl: new Map(), vbat: new Map(), vbowl: new Map(), venues: new Map(),
        seen: new Set(), matchDates: new Set(),
    };
}

export function venueKey(cfg, info) {
    const s = ((info.venue || '') + ' ' + (info.city || '')).toLowerCase();
    for (const v of cfg.venues || []) if ((v.match || []).some((a) => s.includes(a.toLowerCase()))) return v.key;
    return null;
}

const slot = (map, key, make) => { let x = map.get(key); if (!x) { x = make(); map.set(key, x); } return x; };
const newBat = () => ({ tests: new Set(), inns: 0, runs: 0, balls: 0, outs: 0, cred: 0 });
const newBowl = () => ({ tests: new Set(), inns: 0, balls: 0, runs: 0, wkts: 0 });

function addInnings(map, key, id, e, kind) {
    const x = slot(map, key, kind === 'bat' ? newBat : newBowl);
    x.tests.add(id); x.inns += 1;
    if (kind === 'bat') { x.runs += e.runs; x.balls += e.balls; x.outs += e.out ? 1 : 0; x.cred += e.cred ? 1 : 0; }
    else { x.balls += e.balls; x.runs += e.runs; x.wkts += e.wkts; }
}

/**
 * Adds one match to a series' counters and returns the match start date (or null if skipped).
 * Balls follow the site's definition for pairs: wides are not balls faced, no-balls are.
 */
export function processMatch(m, id, S) {
    const info = m.info || {};
    if (info.match_type && info.match_type !== 'Test') return null;
    const date = (info.dates || [])[0] || '';
    const roster = info.players || null;
    const teamOf = (raw) => (roster ? Object.keys(roster).find((t) => (roster[t] || []).includes(raw)) : undefined);
    const vkey = venueKey(S.cfg, info);
    let hit = false;
    // A player counts only if Cricsheet lists him for the team we expect (guards against same-named players elsewhere).
    const who = (raw) => {
        const p = S.index.get(raw);
        if (!p) return null;
        if (roster && teamOf(raw) !== p.team) return null;
        S.seen.add(p.raw); hit = true;
        return p;
    };

    let firstTotal = null; let firstTeam = null; let innNo = 0;
    for (const inn of m.innings || []) {
        if (inn.super_over) continue;
        innNo += 1;
        const bat = new Map(); const bowl = new Map(); let total = 0;
        for (const ov of inn.overs || []) {
            for (const d of ov.deliveries || []) {
                const tot = (d.runs && d.runs.total) || 0;
                total += tot;
                const wide = !!(d.extras && d.extras.wides);
                const noball = !!(d.extras && d.extras.noballs);
                const pb = who(d.bowler);
                const pa = who(d.batter);
                const wk = d.wickets || [];

                for (const w of wk) {                       // anyone dismissed, including the non-striker
                    const po = who(w.player_out);
                    if (po) { const e = slot(bat, po.name, () => ({ runs: 0, balls: 0, out: false, cred: false })); e.out = true; if (CREDITED.has(w.kind)) e.cred = true; }
                }
                if (pa) { const e = slot(bat, pa.name, () => ({ runs: 0, balls: 0, out: false, cred: false })); if (!wide) { e.balls += 1; e.runs += (d.runs && d.runs.batter) || 0; } }
                if (pb) {
                    const e = slot(bowl, pb.name, () => ({ balls: 0, runs: 0, wkts: 0 }));
                    if (!wide && !noball) e.balls += 1;
                    const ex = d.extras || {};
                    e.runs += tot - (ex.byes || 0) - (ex.legbyes || 0) - (ex.penalty || 0);
                    e.wkts += wk.filter((w) => CREDITED.has(w.kind)).length;
                }

                if (!pb || !pa || pb.team === pa.team) continue;
                const key = pb.name + '|' + pa.name;
                const c = slot(S.cells, key, () => ({ balls: 0, runs: 0, dots: 0, outs: 0, tests: new Set(), last: '' }));
                const out = wk.some((w) => w.player_out === d.batter && CREDITED.has(w.kind));
                const vc = vkey ? slot(S.vcells, vkey + '|' + key, () => ({ balls: 0, runs: 0, outs: 0 })) : null;
                if (!wide) {
                    const r = (d.runs && d.runs.batter) || 0;
                    c.balls += 1; c.runs += r; if (tot === 0) c.dots += 1;
                    if (vc) { vc.balls += 1; vc.runs += r; }
                }
                if (out) { c.outs += 1; if (vc) vc.outs += 1; }
                if (!wide || out) { c.tests.add(id); if (date > c.last) c.last = date; }
            }
        }
        for (const [name, e] of bat) { addInnings(S.bat, name, id, e, 'bat'); if (vkey) addInnings(S.vbat, vkey + '|' + name, id, e, 'bat'); }
        for (const [name, e] of bowl) { addInnings(S.bowl, name, id, e, 'bowl'); if (vkey) addInnings(S.vbowl, vkey + '|' + name, id, e, 'bowl'); }
        if (innNo === 1) { firstTotal = total; firstTeam = inn.team; }
    }

    if (hit) S.matchDates.add(date);
    if (vkey) {
        const v = slot(S.venues, vkey, () => ({ tests: 0, firstSum: 0, firstN: 0, batFirst: 0, chase: 0, draws: 0, last: '' }));
        v.tests += 1; if (date > v.last) v.last = date;
        if (firstTotal !== null) { v.firstSum += firstTotal; v.firstN += 1; }
        const oc = info.outcome || {};
        if (oc.winner && firstTeam) { if (oc.winner === firstTeam) v.batFirst += 1; else v.chase += 1; }
        else if (oc.result === 'draw') v.draws += 1;
    }
    return date;
}

const bat6 = (x) => [x.tests.size, x.inns, x.runs, x.balls, x.outs, x.cred];
const bowl5 = (x) => [x.tests.size, x.inns, x.balls, x.runs, x.wkts];

export function buildGrid(S, meta) {
    const cells = {}; const vcells = {};
    for (const [key, c] of [...S.cells.entries()].sort()) { if (c.balls === 0 && c.outs === 0) continue; cells[key] = [c.balls, c.runs, c.dots, c.outs, c.tests.size, c.last]; }
    for (const [key, c] of [...S.vcells.entries()].sort()) { if (c.balls === 0 && c.outs === 0) continue; vcells[key] = [c.balls, c.runs, c.outs]; }
    const obj = (map, f) => Object.fromEntries([...map.entries()].sort().map(([k, v]) => [k, f(v)]));
    const venues = Object.fromEntries([...S.venues.entries()].map(([k, v]) => [k, [v.tests, v.firstN ? Math.round(v.firstSum / v.firstN) : null, v.batFirst, v.chase, v.draws, v.last]]));
    return {
        id: S.cfg.id,
        generated: meta.generated,
        source: "Cricsheet men's Tests (ODC-By 1.0)",
        through: meta.through,
        matches: meta.matches,
        squads: S.squads.map((p) => ({ name: p.name, team: p.team, raw: p.raw })),
        dates: [...S.matchDates].sort(), cells, vcells,
        bat: obj(S.bat, bat6), bowl: obj(S.bowl, bowl5), vbat: obj(S.vbat, bat6), vbowl: obj(S.vbowl, bowl5),
        venues,
    };
}

export function renderModule(grids, defaultId) {
    return '// Generated by refresh/refresh.mjs. Do not edit by hand; run `npm run refresh`.\n' +
        'export const GRIDS: Record<string, any> = ' + JSON.stringify(grids) + ';\n' +
        `export const GRID: any = GRIDS[${JSON.stringify(defaultId)}] || null;\n`;
}
