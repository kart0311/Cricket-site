// India-wide Test database for the site.
//
// Joins two sources into app/indiaData.ts:
//   1. Cricsheet ball-by-ball Test files (data/tests_male_json.zip, refreshed daily) - every ball since Dec 2001.
//   2. Scorecard history for every Test since 1877 (data/history/*.csv, downloaded once with "Download history.command").
//      It supplies results, scores and innings-by-innings batting and bowling for all of India's Tests,
//      including the Tests Cricsheet has no ball data for.
//
//   node refresh/india.mjs --tests DIR --history DIR [--out FILE]
//
// Also imported by refresh.mjs, which runs buildIndia() after every Cricsheet download.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEAMS = ['India', 'Australia', 'England', 'New Zealand', 'South Africa', 'West Indies', 'Pakistan', 'Sri Lanka', 'Bangladesh', 'Zimbabwe', 'Afghanistan', 'Ireland'];
export const TEAM_CODES = ['IND', 'AUS', 'ENG', 'NZ', 'SA', 'WI', 'PAK', 'SL', 'BD', 'ZIM', 'AFG', 'IRE'];
// A player counts as still playing if his last Test is within this many days of the newest Test in the data.
export const CURRENT_WINDOW_DAYS = 365 * 3;
export const PAIRS_FROM = '2000-01-01';          // Player matchup window
const NEUTRAL_DATES = new Set(['2021-06-18', '2023-06-07']); // World Test Championship finals
// dismissal codes (batting rows) and letters (ball strings)
const OUT = { 'not out': 0, caught: 1, bowled: 2, lbw: 3, stumped: 4, 'run out': 5, 'hit wicket': 6, 'caught and bowled': 7, other: 8 };
const OUT_LETTER = ['', 'c', 'b', 'l', 's', 'r', 'h', 'k', 'o'];
const CREDITED = new Set([1, 2, 3, 4, 6, 7]);

// ---------- helpers ----------
export function parseCsv(text) {
    const rows = []; let row = []; let f = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(f); f = ''; }
        else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
        else if (c !== '\r') f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    const head = rows.shift();
    return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n) : d; };
const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const teamIdx = (name) => TEAMS.indexOf(name);

// ---------- grounds ----------
// [pattern on "stadium" text (lower case), key, display name, city]
const GROUND_RULES = [
    [/sardar patel|narendra modi|motera/, 'ahmedabad', 'Narendra Modi Stadium (Motera)', 'Ahmedabad'],
    [/gujarat stadium/, 'ahmedabad-gujarat', 'Gujarat Stadium (Navrangpura)', 'Ahmedabad'],
    [/chinnaswamy|karnataka state/, 'bengaluru', 'M Chinnaswamy Stadium', 'Bengaluru'],
    [/punjab cricket association/, 'mohali', 'PCA IS Bindra Stadium', 'Mohali'],
    [/madras cricket club|chidambaram|chepauk/, 'chennai', 'MA Chidambaram Stadium (Chepauk)', 'Chennai'],
    [/corporation stadium/, 'chennai-corporation', 'Corporation Stadium', 'Chennai'],
    [/feroz shah|arun jaitley|kotla/, 'delhi', 'Arun Jaitley Stadium (Feroz Shah Kotla)', 'Delhi'],
    [/rajiv gandhi|uppal/, 'hyderabad', 'Rajiv Gandhi International Stadium', 'Hyderabad'],
    [/vidarbha.*(stadium|jamtha)/, 'nagpur-jamtha', 'VCA Stadium, Jamtha', 'Nagpur'],
    [/vidarbha.*ground/, 'nagpur-vca-ground', 'VCA Ground (old)', 'Nagpur'],
    [/saurashtra|niranjan shah/, 'rajkot', 'Saurashtra Cricket Association Stadium', 'Rajkot'],
    [/aca-vdca|rajasekhara|andhra cricket/, 'visakhapatnam', 'ACA-VDCA Stadium', 'Visakhapatnam'],
    [/barsapara/, 'guwahati', 'Barsapara Cricket Stadium', 'Guwahati'],
    [/western australia cricket|^waca/, 'perth-waca', 'WACA Ground', 'Perth'],
    [/perth stadium|optus/, 'perth-stadium', 'Perth Stadium', 'Perth'],
    [/kennington oval|^the oval/, 'oval', 'The Oval', 'London'],
    [/rose bowl|ageas bowl/, 'southampton', 'The Rose Bowl', 'Southampton'],
    [/ma aziz|ruhul amin/, 'chattogram-old', 'MA Aziz Stadium', 'Chattogram'],
    [/zahur ahmed/, 'chattogram', 'Zahur Ahmed Chowdhury Stadium', 'Chattogram'],
    [/dacca|bangabandhu/, 'dhaka', 'Bangabandhu National Stadium', 'Dhaka'],
    [/trust bank|westpac|seddon/, 'hamilton', 'Seddon Park', 'Hamilton'],
    [/saravanamuttu|p sara/, 'colombo-psp', 'P Sara Oval', 'Colombo'],
    [/wanderers/, 'johannesburg', 'The Wanderers Stadium', 'Johannesburg'],
    [/beausejour|darren sammy/, 'st-lucia', 'Darren Sammy National Cricket Stadium', 'Gros Islet'],
    [/sir vivian richards/, 'north-sound', 'Sir Vivian Richards Stadium', 'North Sound'],
    [/^antigua recreation/, 'antigua-arg', 'Antigua Recreation Ground', "St John's"],
    [/queen.s park oval/, 'port-of-spain', "Queen's Park Oval", 'Port of Spain'],
    [/brisbane cricket|gabba/, 'brisbane', 'The Gabba', 'Brisbane'],
    [/lord.s/, 'lords', "Lord's", 'London'],
    [/crusaders|st george/, 'gqeberha', "St George's Park", 'Gqeberha'],
];
function groundKey(stadium) {
    const s = String(stadium || '').split(',')[0].trim();
    const low = s.toLowerCase();
    for (const [re, key, name, city] of GROUND_RULES) if (re.test(low) || re.test(String(stadium).toLowerCase())) return { key, name, city };
    return { key: slug(s), name: s, city: '' };
}

// ---------- Cricsheet match -> compact structure ----------
function kindCode(kind) {
    if (kind in OUT) return OUT[kind];
    if (kind === 'retired hurt' || kind === 'retired not out') return 0;
    return 8;
}
function readCricsheet(j) {
    const info = j.info; const teams = info.teams;
    const m = { n: info.match_type_number ?? 0, d: info.dates[0], teams, venue: info.venue, city: info.city || '', event: info.event?.name || '', innings: [] };
    const o = info.outcome || {};
    if (o.winner) { m.w = teams.indexOf(o.winner); m.win = o.winner; if (o.by) m.by = o.by.innings ? ['i', o.by.runs] : o.by.runs != null ? ['r', o.by.runs] : ['w', o.by.wickets]; } else m.res = o.result || 'draw';
    for (const inn of j.innings) {
        const bat = new Map(); const bowl = new Map(); const pairs = new Map();
        let runs = 0; let wkts = 0;
        const order = [];
        const touch = (name) => { if (!bat.has(name)) { bat.set(name, { name, runs: 0, balls: 0, fours: 0, sixes: 0, out: 0, bowler: null, fielders: null }); order.push(name); } return bat.get(name); };
        for (const ov of inn.overs) {
            const ob = new Map(); // per bowler in this over: legal balls, charged runs
            for (const d of ov.deliveries) {
                const ex = d.extras || {}; const wide = ex.wides || 0; const nb = ex.noballs || 0;
                runs += d.runs.total;
                const b = touch(d.batter); touch(d.non_striker);
                b.runs += d.runs.batter;
                if (!wide) b.balls++;
                if (d.runs.batter === 4 && !d.runs.non_boundary) b.fours++;
                if (d.runs.batter === 6) b.sixes++;
                // bowler
                let w = bowl.get(d.bowler); if (!w) { w = { name: d.bowler, balls: 0, runs: 0, wkts: 0, maidens: 0 }; bowl.set(d.bowler, w); }
                const charged = d.runs.batter + wide + nb;
                if (!wide && !nb) w.balls++;
                w.runs += charged;
                let o2 = ob.get(d.bowler); if (!o2) { o2 = { legal: 0, charged: 0 }; ob.set(d.bowler, o2); }
                if (!wide && !nb) o2.legal++;
                o2.charged += charged;
                // wickets
                let code = '';
                for (const wk of d.wickets || []) {
                    const kc = kindCode(wk.kind);
                    if (wk.kind === 'retired hurt' || wk.kind === 'retired not out') continue;
                    wkts++;
                    const row = touch(wk.player_out); row.out = kc;
                    if (CREDITED.has(kc)) { row.bowler = d.bowler; w.wkts++; }
                    if (wk.player_out === d.batter) code = 'W' + OUT_LETTER[kc];
                }
                if (!wide) {
                    let c = String(d.runs.batter);
                    if (nb) c += 'n'; if (ex.byes) c += 'b'; if (ex.legbyes) c += 'l';
                    c += code;
                    const key = d.bowler + '\u0001' + d.batter;
                    let p = pairs.get(key); if (!p) { p = new Map(); pairs.set(key, p); }
                    const ovn = ov.over; if (!p.has(ovn)) p.set(ovn, []); p.get(ovn).push(c);
                }
            }
            for (const [bn, o2] of ob) if (o2.legal === 6 && o2.charged === 0) bowl.get(bn).maidens++;
        }
        m.innings.push({ team: inn.team, runs, wkts, declared: !!inn.declared, bat: order.map((n) => bat.get(n)), bowl: [...bowl.values()], pairs });
    }
    return m;
}

// ---------- main ----------
export function buildIndia({ testsDir, historyDir, outFile, extras = [], log = console.log }) {
    // --- load Cricsheet
    const cs = [];
    const files = readdirSync(testsDir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
        try {
            const j = JSON.parse(readFileSync(join(testsDir, f), 'utf8'));
            if (j.info?.match_type !== 'Test') continue;
            const m = readCricsheet(j); m.registry = j.info.registry?.people || {}; m.file = f; cs.push(m);
        } catch (e) { log('skip', f, e.message); }
    }
    log(`Cricsheet: ${cs.length} Tests read`);
    const hasHist = historyDir && existsSync(join(historyDir, 'test_Matches_Data.csv'));
    let hm = [], hbat = [], hbowl = [], hpl = new Map();
    if (hasHist) {
        hm = parseCsv(readFileSync(join(historyDir, 'test_Matches_Data.csv'), 'utf8'));
        hbat = parseCsv(readFileSync(join(historyDir, 'test_Batting_Card.csv'), 'utf8'));
        hbowl = parseCsv(readFileSync(join(historyDir, 'test_Bowling_Card.csv'), 'utf8'));
        for (const r of parseCsv(readFileSync(join(historyDir, 'players_info.csv'), 'utf8'))) hpl.set(r.player_id, r);
        log(`History: ${hm.length} Tests, ${hbat.length} batting rows, ${hbowl.length} bowling rows`);
    } else log('No history files found: Country matchup and Player analysis will only cover the Cricsheet era.');
    const histEnd = hm.reduce((a, r) => (r['Match Start Date'] > a ? r['Match Start Date'] : a), '');
    const hById = new Map(hm.map((r) => [r['Match ID'], r]));
    const hByNo = new Map(hm.map((r) => [r['TEST Match No'], r]));
    const batBy = new Map(); for (const r of hbat) { if (!batBy.has(r['Match ID'])) batBy.set(r['Match ID'], []); batBy.get(r['Match ID']).push(r); }
    const bowlBy = new Map(); for (const r of hbowl) { if (!bowlBy.has(r['Match ID'])) bowlBy.set(r['Match ID'], []); bowlBy.get(r['Match ID']).push(r); }

    // --- which grounds count: every ground India has played at
    const isInd = (a, b) => a === 'India' || b === 'India';
    const gInfo = new Map(); // key -> {name, city, country}
    const addGround = (stadium, city, country) => {
        const g = groundKey(stadium);
        const cur = gInfo.get(g.key);
        const rec = cur || { key: g.key, name: g.name || stadium, city: g.city || city || '', country: country || '' };
        if (!rec.city && city) rec.city = city;
        if (!rec.country && country) rec.country = country;
        gInfo.set(g.key, rec);
        return g.key;
    };
    const hKey = new Map(); for (const r of hm) hKey.set(r['Match ID'], addGround(r['Match Venue (Stadium)'], r['Match Venue (City)'], r['Match Venue (Country)']));
    for (const m of cs) { const t = m.event.match(/ tour of (.+)$/); m.host = t ? t[1].trim() : ''; m.gkey = addGround(m.venue, m.city, m.host && teamIdx(m.host) >= 0 ? m.host : ''); }
    const indGrounds = new Set();
    for (const r of hm) if (isInd(r['Team1 Name'], r['Team2 Name'])) indGrounds.add(hKey.get(r['Match ID']));
    for (const m of cs) if (m.teams.includes('India')) indGrounds.add(m.gkey);
    for (const x of extras) { const g = groundKey(x.ground); gInfo.set(g.key, gInfo.get(g.key) || { key: g.key, name: g.name, city: x.city || g.city, country: x.country || '' }); indGrounds.add(g.key); }

    // --- unify matches (History for everything up to its last date, Cricsheet after that)
    const csByNo = new Map(cs.map((m) => [String(m.n), m]));
    const T = []; // match records
    const csUsed = new Set();
    // Every Test ever played is kept, so a player still playing can have his whole career here.
    // indGrounds still marks the grounds India has played at: the ground screen lists only those.
    const wantMatch = () => true;
    const mk = (o) => { T.push(o); return o; };
    const hostOf = (country, date, india) => (india && NEUTRAL_DATES.has(date) ? -1 : teamIdx(country));
    for (const r of hm) {
        const a = r['Team1 Name']; const b = r['Team2 Name']; const gk = hKey.get(r['Match ID']);
        const cards = batBy.get(r['Match ID']) || [];
        // innings order from the batting card
        const order = []; const seen = new Set();
        for (const c of cards) { const k = c.innings; if (!seen.has(k)) { seen.add(k); order[Number(k) - 1] = c.team; } }
        const cnt = { [a]: 0, [b]: 0 };
        const val = (team, k) => {
            const side = team === a ? '1' : '2';
            return [num(r[`Innings${k} Team${side} Runs Scored`], -1), num(r[`Innings${k} Team${side} Wickets Fell`], 10)];
        };
        const inns = [];
        const seq = order.length ? order : [a, b, a, b];
        for (let n = 0; n < 4; n++) {
            const team = seq[n]; if (!team || !(team in cnt)) continue;
            cnt[team]++;
            const [runs, wk] = val(team, cnt[team]);
            if (runs < 0) continue;
            inns.push([teamIdx(team), runs, wk, n < 3 && wk < 10 ? 1 : 0]);
        }
        const txt = r['Match Result Text']; const winner = r['Match Winner'];
        let res = 'draw'; let by = null;
        if (winner) { res = teamIdx(winner); const mm = txt.match(/won by an innings and (\d+) runs/) || null; if (mm) by = ['i', +mm[1]]; else { const rr = txt.match(/won by (\d+) runs?/); const ww = txt.match(/won by (\d+) wickets?/); by = rr ? ['r', +rr[1]] : ww ? ['w', +ww[1]] : null; } } else if (/tie/i.test(txt)) res = 'tie'; else if (!/draw/i.test(txt)) res = 'other';
        const cm = csByNo.get(r['TEST Match No']);
        if (cm && cm.d === r['Match Start Date']) csUsed.add(cm.file);
        const rec = mk({ n: num(r['TEST Match No']), d: r['Match Start Date'], t: [teamIdx(a), teamIdx(b)], gk, h: hostOf(r['Match Venue (Country)'], r['Match Start Date'], isInd(a, b)), res, by, i: inns, bb: cm && cm.d === r['Match Start Date'] ? 1 : 0, hid: r['Match ID'], cs: cm && cm.d === r['Match Start Date'] ? cm : null });
        if (res === 'other') rec.note = txt;
    }
    for (const m of cs) {
        if (csUsed.has(m.file)) continue;
        if (histEnd && m.d <= histEnd) { // history has no record of it (should not happen); keep it
        }
        const inns = m.innings.map((x) => [teamIdx(x.team), x.runs, x.wkts, x.declared ? 1 : 0]);
        const res = m.win ? teamIdx(m.win) : m.res === 'tie' ? 'tie' : m.res === 'draw' ? 'draw' : 'other';
        const hostIdx = m.host ? teamIdx(m.host) : -2;
        mk({ n: m.n, d: m.d, t: [teamIdx(m.teams[0]), teamIdx(m.teams[1])], gk: m.gkey, h: m.teams.includes('India') && NEUTRAL_DATES.has(m.d) ? -1 : hostIdx, res, by: m.by || null, i: inns, bb: 1, cs: m });
    }
    for (const x of extras) {
        const a = teamIdx(x.teams[0]); const b = teamIdx(x.teams[1]);
        const dup = T.find((t) => t.t.includes(a) && t.t.includes(b) && Math.abs(Date.parse(t.d) - Date.parse(x.date)) <= 2 * 864e5);
        if (dup) continue;
        const g = groundKey(x.ground);
        mk({ n: 0, d: x.date, t: [a, b], gk: g.key, h: teamIdx(x.host ?? x.teams[1]), res: x.result === 'draw' ? 'draw' : x.result === 'tie' ? 'tie' : teamIdx(x.result), by: x.by || null, i: x.innings.map(([t, r, w, d]) => [teamIdx(t), r, w, d ? 1 : 0]), bb: 0, extra: 1 });
    }
    T.sort((p, q) => (p.d < q.d ? -1 : p.d > q.d ? 1 : p.n - q.n));
    T.forEach((t, i) => { t.idx = i; });
    const indT = T.filter((t) => t.t.includes(0));
    log(`Matches kept: ${T.length} (India: ${indT.length}, with ball-by-ball: ${indT.filter((t) => t.bb).length})`);

    // --- players: link Cricsheet registry ids to history ids by lining up batting and bowling cards
    const votes = new Map(); // registryId -> Map(hid -> n)
    const hidName = new Map(); // history id -> Cricsheet name (for ids the player list lacks)
    const vote = (reg, hid, name) => { if (!reg || !hid) return; let m = votes.get(reg); if (!m) { m = new Map(); votes.set(reg, m); } m.set(hid, (m.get(hid) || 0) + 1); if (name) hidName.set(hid, name); };
    for (const t of T) {
        if (!t.cs || !t.hid) continue;
        const cards = batBy.get(t.hid) || []; const bcards = bowlBy.get(t.hid) || [];
        t.cs.innings.forEach((inn, k) => {
            const hrows = cards.filter((c) => c.innings === String(k + 1) && c.wicketType !== 'DNB');
            if (hrows.length && hrows[0].team === inn.team) inn.bat.forEach((b, i) => { const h = hrows[i]; if (h && num(h.runs) === b.runs) vote(t.cs.registry[b.name], h.batsman, b.name); });
            const hb = bcards.filter((c) => c.innings === String(k + 1));
            const sig = (o) => `${o.wkts}|${o.runs}|${o.balls}`;
            const cnt = new Map(); for (const w of inn.bowl) cnt.set(sig(w), (cnt.get(sig(w)) || 0) + 1);
            for (const w of inn.bowl) {
                if (cnt.get(sig(w)) !== 1) continue;
                const c = hb.filter((x) => num(x.wickets) === w.wkts && num(x.conceded) === w.runs && Math.abs(num(x.balls) - w.balls) <= 2);
                if (c.length === 1) vote(t.cs.registry[w.name], c[0]['bowler id'], w.name);
            }
        });
    }
    const reg2h = new Map();
    for (const [reg, m] of votes) { const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; reg2h.set(reg, best[0]); }
    log(`Players linked to history ids: ${reg2h.size}`);

    const csName = (m, n) => m.registry[n];

    // --- player table
    const P = []; const pIdx = new Map(); // key -> idx
    const pkey = (hid, reg, name) => (hid ? 'h' + hid : reg ? 'c' + reg : 'n' + name);

    // --- who is still playing
    // A player who has appeared in a Test within CURRENT_WINDOW of the latest Test in the data keeps a
    // complete career: every Test he has played, not only the ones against India. Everyone else is kept
    // India-only, which is all the matchup screens need. India's own players are complete either way.
    const lastSeen = new Map(); // player key -> date of his last Test
    const seen = (key, d) => { if (key && (!lastSeen.has(key) || lastSeen.get(key) < d)) lastSeen.set(key, d); };
    for (const t of T) {
        if (t.hid && batBy.has(t.hid)) {
            for (const c of batBy.get(t.hid)) if (c.wicketType !== 'DNB') seen('h' + c.batsman, t.d);
            for (const c of bowlBy.get(t.hid) || []) seen('h' + c['bowler id'], t.d);
        } else if (t.cs) {
            for (const inn of t.cs.innings) {
                for (const b of inn.bat) { const reg = csName(t.cs, b.name); seen(pkey(reg2h.get(reg) || '', reg, b.name), t.d); }
                for (const w of inn.bowl) { const reg = csName(t.cs, w.name); seen(pkey(reg2h.get(reg) || '', reg, w.name), t.d); }
            }
        }
    }
    const lastTestDate = T.length ? T[T.length - 1].d : '';
    const currentFrom = lastTestDate ? new Date(Date.parse(lastTestDate) - CURRENT_WINDOW_DAYS * 864e5).toISOString().slice(0, 10) : '';
    const isCurrent = (key) => (lastSeen.get(key) || '') >= currentFrom;
    log(`Still playing (a Test since ${currentFrom}): ${[...lastSeen.values()].filter((d) => d >= currentFrom).length} players`);
    const style = (hid) => {
        const r = hpl.get(hid); if (!r) return null;
        const bat = /left/i.test(r.batting_style || '') ? 'LHB' : /right/i.test(r.batting_style || '') ? 'RHB' : '';
        const bowl = (r.bowling_style || '').replace(/\s+/g, ' ').trim();
        return [bat, bowl];
    };
    const player = (hid, reg, name, team) => {
        const key = pkey(hid, reg, name);
        let i = pIdx.get(key);
        if (i === undefined) {
            const hp = hid ? hpl.get(hid) : null;
            i = P.length; pIdx.set(key, i);
            P.push({ name: hp?.player_name || name || hidName.get(hid) || 'Unknown player', team, hid: hid || '', st: hid ? style(hid) : null, bornYear: hp?.dob ? hp.dob.slice(0, 4) : '', last: '', full: team === 0 || isCurrent(key) });
        }
        return i;
    };
    const gidx = new Map(); const G = [];
    const groundIndex = (key) => { let i = gidx.get(key); if (i === undefined) { const g = gInfo.get(key); i = G.length; gidx.set(key, i); G.push({ key, name: g?.name || key, city: g?.city || '', country: g?.country || '' }); } return i; };

    const BAT = []; const BOWL = []; const PAIRS = {}; const addPair = (b, t) => { const k = b + ',' + t; return (PAIRS[k] ||= { m: [], c: [] }); };
    const styleOf = (hid) => { const r = hpl.get(hid); const s = (r?.bowling_style || '').toLowerCase(); if (!s) return 'u'; if (/fast|medium/.test(s)) return 'p'; if (/break|spin|orthodox|googly|chinaman|offbreak|legbreak/.test(s)) return 's'; return 'u'; };

    // ground aggregates (all teams) -- built from every kept match at an India ground
    const GA = new Map(); // gkey -> {k:[kinds], ps:[pace,spin,unk], bat:Map, bowl:Map}
    const ga = (gk) => { let g = GA.get(gk); if (!g) { g = { k: [0, 0, 0, 0, 0, 0, 0, 0, 0], ps: [0, 0, 0], inn: 0, bat: new Map(), bowl: new Map() }; GA.set(gk, g); } return g; };
    const addAgg = (gk, kind, bstyle, name, runs, out, bowlerName, bowlerWkts) => { /* placeholder to keep structure clear */ };

    for (const t of T) {
        const g = groundIndex(t.gk); t.g = g;
        const india = t.t.includes(0);
        const agg = ga(t.gk);
        const inWindow = t.d >= PAIRS_FROM;
        const useHist = t.hid && batBy.has(t.hid);
        const aggBat = (name, key, runs, balls, out, kind, bowlerStyle, bowlerName, bowlerKey) => {
            let b = agg.bat.get(key); if (!b) { b = { name, inns: 0, runs: 0, outs: 0, hs: 0, hsNo: 0, h: 0 }; agg.bat.set(key, b); }
            b.inns++; b.runs += runs; if (out) b.outs++; if (runs > b.hs || (runs === b.hs && !out)) { b.hs = runs; b.hsNo = out ? 0 : 1; } if (runs >= 100) b.h++;
        };
        if (useHist) {
            const cards = batBy.get(t.hid); const bcards = bowlBy.get(t.hid) || [];
            const rowMeta = new Map();
            for (const c of cards) {
                if (c.wicketType === 'DNB') continue;
                const team = teamIdx(c.team);
                const runs = num(c.runs); const out = c.isOut === 'True';
                let kind = c.wicketType === 'caught' ? 1 : c.wicketType === 'bowled' ? 2 : c.wicketType === 'lbw' ? 3 : c.wicketType === 'stumping' ? 4 : c.wicketType === 'run out' ? 5 : c.wicketType === 'hitwicket' ? 6 : (out ? 8 : 0);
                if (!out) kind = 0;
                const bowlerId = c.bowler ? String(num(c.bowler)) : '';
                if (kind === 1 && bowlerId && /^\[/.test(c.fielders || '')) { const f = (c.fielders.match(/\d+/g) || []); if (f.length === 1 && f[0] === bowlerId) kind = 7; }
                agg.k[kind === 0 ? 0 : kind]++; // index 0 collects not-outs, ignored later
                if (CREDITED.has(kind)) agg.ps[{ p: 0, s: 1, u: 2 }[styleOf(bowlerId)]]++;
                aggBat(hpl.get(c.batsman)?.player_name || c.batsman, 'h' + c.batsman, runs, num(c.balls, -1), out);
                if (india || isCurrent('h' + c.batsman)) {
                    const pi = player(c.batsman, '', '', team);
                    const bi = bowlerId && CREDITED.has(kind) ? player(bowlerId, '', '', team === t.t[0] ? t.t[1] : t.t[0]) : -1;
                    BAT.push([t.idx, num(c.innings), pi, runs, num(c.balls, -1), num(c.fours, -1), num(c.sixes, -1), kind, bi]);
                    if (india && inWindow && bi >= 0 && !t.bb) addPair(bi, pi).c.push([t.idx, num(c.innings), kind, runs, num(c.balls, -1)]);
                }
            }
            const bm = new Map();
            for (const c of bcards) {
                const key = 'h' + c['bowler id'];
                let b = agg.bowl.get(key); if (!b) { b = { name: hpl.get(c['bowler id'])?.player_name || c['bowler id'], inns: 0, balls: 0, runs: 0, wkts: 0, bw: 0, br: 9999 }; agg.bowl.set(key, b); }
                b.inns++; b.balls += num(c.balls); b.runs += num(c.conceded); const w = num(c.wickets); b.wkts += w;
                if (w > b.bw || (w === b.bw && num(c.conceded) < b.br)) { b.bw = w; b.br = num(c.conceded); }
                if (india || isCurrent('h' + c['bowler id'])) {
                    const team = teamIdx(c.team);
                    const pi = player(c['bowler id'], '', '', team);
                    BOWL.push([t.idx, num(c.innings), pi, num(c.balls), num(c.conceded), w, num(c.maidens), num(c.dots, -1)]);
                }
            }
        } else if (t.cs) { // Cricsheet-only match
            const m = t.cs;
            m.innings.forEach((inn, k) => {
                const bowlTeam = inn.team === m.teams[0] ? m.teams[1] : m.teams[0];
                for (const b of inn.bat) {
                    const reg = csName(m, b.name); const hid = reg2h.get(reg) || '';
                    const out = b.out > 0; const kind = b.out;
                    agg.k[kind]++;
                    let bst = 'u';
                    if (b.bowler) { const bh = reg2h.get(csName(m, b.bowler)) || ''; bst = styleOf(bh); }
                    if (CREDITED.has(kind)) agg.ps[{ p: 0, s: 1, u: 2 }[bst]]++;
                    aggBat(hid ? hpl.get(hid)?.player_name || b.name : b.name, hid ? 'h' + hid : 'c' + reg, b.runs, b.balls, out);
                    if (india || isCurrent(pkey(hid, reg, b.name))) {
                        const pi = player(hid, reg, b.name, teamIdx(inn.team));
                        const bi = b.bowler ? player(reg2h.get(csName(m, b.bowler)) || '', csName(m, b.bowler), b.bowler, teamIdx(bowlTeam)) : -1;
                        BAT.push([t.idx, k + 1, pi, b.runs, b.balls, b.fours, b.sixes, kind, bi]);
                    }
                }
                for (const w of inn.bowl) {
                    const reg = csName(m, w.name); const hid = reg2h.get(reg) || '';
                    const key = hid ? 'h' + hid : 'c' + reg;
                    let a = agg.bowl.get(key); if (!a) { a = { name: hid ? hpl.get(hid)?.player_name || w.name : w.name, inns: 0, balls: 0, runs: 0, wkts: 0, bw: 0, br: 9999 }; agg.bowl.set(key, a); }
                    a.inns++; a.balls += w.balls; a.runs += w.runs; a.wkts += w.wkts;
                    if (w.wkts > a.bw || (w.wkts === a.bw && w.runs < a.br)) { a.bw = w.wkts; a.br = w.runs; }
                    if (india || isCurrent(key)) BOWL.push([t.idx, k + 1, player(hid, reg, w.name, teamIdx(bowlTeam)), w.balls, w.runs, w.wkts, w.maidens, -1]);
                }
            });
        }
        // ball-by-ball meetings (Cricsheet) for India Tests inside the matchup window
        if (india && t.cs && inWindow) {
            const m = t.cs;
            m.innings.forEach((inn, k) => {
                const bowlTeam = inn.team === m.teams[0] ? m.teams[1] : m.teams[0];
                for (const [key, ov] of inn.pairs) {
                    const [bn, tn] = key.split('\u0001');
                    const bReg = csName(m, bn); const tReg = csName(m, tn);
                    const bi = player(reg2h.get(bReg) || '', bReg, bn, teamIdx(bowlTeam));
                    const ti = player(reg2h.get(tReg) || '', tReg, tn, teamIdx(inn.team));
                    const s = [...ov.entries()].sort((a, b) => a[0] - b[0]).map(([o, c]) => `${o + 1}:${c.join(',')}`).join(';');
                    addPair(bi, ti).m.push([t.idx, k + 1, s]);
                }
            });
        }
    }
    // extras: no player data
    // last Test played, for sorting lists by recency
    const lastIdx = new Map();
    for (const r of BAT) lastIdx.set(r[2], Math.max(lastIdx.get(r[2]) ?? -1, r[0]));
    for (const r of BOWL) lastIdx.set(r[2], Math.max(lastIdx.get(r[2]) ?? -1, r[0]));

    // --- ground aggregates -> compact
    const GR = {};
    for (const [gk, a] of GA) {
        const gi = gidx.get(gk); if (gi === undefined) continue;
        const bat = [...a.bat.values()].sort((x, y) => y.runs - x.runs).slice(0, 5).map((b) => [b.name, b.inns, b.runs, b.hs, b.hsNo, b.outs, b.h]);
        const bowl = [...a.bowl.values()].sort((x, y) => y.wkts - x.wkts || x.runs - y.runs).slice(0, 5).map((b) => [b.name, b.inns, b.wkts, b.runs, b.balls, b.bw, b.br === 9999 ? 0 : b.br]);
        GR[gi] = { k: a.k.slice(1), ps: a.ps, bat, bowl };
    }

    // --- output
    const out = {
        generated: new Date().toISOString(), through: indT.length ? indT[indT.length - 1].d : '', historyEnd: histEnd, pairsFrom: PAIRS_FROM, currentFrom,
        teams: TEAMS, codes: TEAM_CODES,
        grounds: G.map((g) => [g.name, g.city, g.country, indGrounds.has(g.key) ? 1 : 0]),
        tests: T.map((t) => [t.n, t.d, t.t[0], t.t[1], t.g, t.h, t.res, t.by, t.i, t.bb ? 1 : 0, t.extra ? 1 : 0]),
        players: P.map((p, i) => [p.name, p.team, p.st, p.bornYear, lastIdx.get(i) ?? -1, p.full ? 1 : 0]),
        bat: BAT, bowl: BOWL, pairs: PAIRS, ground: GR,
    };
    // players with no rows or no India Test are dropped by the UI; nothing else to prune here
    const body = JSON.stringify(out);
    writeFileSync(outFile, `// Generated by refresh/india.mjs - do not edit.\nexport const INDIA: any = JSON.parse(${JSON.stringify(body)});\n`);
    log(`indiaData: ${(body.length / 1e6).toFixed(2)} MB JSON; ${T.length} Tests, ${P.length} players, ${BAT.length} batting rows, ${BOWL.length} bowling rows, ${Object.keys(PAIRS).length} pairs, ${G.length} grounds`);
    return { out, T, P };
}

// ---------- CLI ----------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
    const here = dirname(fileURLToPath(import.meta.url));
    const root = resolve(here, '..');
    const extrasFile = join(here, 'extras.json');
    const extras = existsSync(extrasFile) ? JSON.parse(readFileSync(extrasFile, 'utf8')) : [];
    buildIndia({
        testsDir: opt('--tests', join(here, '.cache', 'tests')),
        historyDir: opt('--history', join(root, 'data', 'history')),
        outFile: resolve(opt('--out', join(root, 'app', 'indiaData.ts'))),
        extras,
    });
}
