// Daily data refresh: downloads the Cricsheet men's Test archive and recomputes, for every series in refresh/series/*.json,
// the bowler-vs-batter grid, ground-by-ground pairings and each player's career and ground form.
// Writes app/gridData.ts. Run with `npm run refresh` (refresh + rebuild).
//
//   node refresh/refresh.mjs                 download from Cricsheet, then recompute
//   node refresh/refresh.mjs --from-dir DIR  use a folder of Cricsheet *.json files instead (offline / testing)
//   node refresh/refresh.mjs --zip FILE      use an already downloaded tests_male_json.zip
//   node refresh/refresh.mjs --force         recompute even if Cricsheet reports no change
//   node refresh/refresh.mjs --out FILE      write somewhere else (testing)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { teamsOf, collectNames, resolveSquad, makeSeries, processMatch, buildGrid, renderModule } from './lib.mjs';
import { buildIndia } from './india.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const force = args.includes('--force');
const outFile = resolve(opt('--out') || join(root, 'app', 'gridData.ts'));
const indiaFile = join(root, 'app', 'indiaData.ts');
const URL_ZIP = process.env.CRICSHEET_URL || 'https://cricsheet.org/downloads/tests_male_json.zip';
const cache = join(here, '.cache');
mkdirSync(cache, { recursive: true });

const log = (...a) => console.log('[refresh]', ...a);
const seriesDir = join(here, 'series');
const configs = readdirSync(seriesDir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(seriesDir, f), 'utf8')));
if (configs.length === 0) throw new Error('No series files found in refresh/series');

function listJson(dir) {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) out.push(...listJson(p));
        else if (e.name.endsWith('.json')) out.push(p);
    }
    return out;
}

async function download() {
    const etagFile = join(cache, 'etag.txt');
    const headers = { 'User-Agent': 'cricket-site-refresh/1.1' };
    if (!force && existsSync(etagFile) && existsSync(outFile) && existsSync(indiaFile) && /generated/.test(readFileSync(outFile, 'utf8'))) {
        headers['If-None-Match'] = readFileSync(etagFile, 'utf8').trim();
    }
    const zip = join(cache, 'tests_male_json.zip');
    // Cricsheet now and then answers with an error page instead of the zip; try again a few times before giving up.
    for (let attempt = 1; ; attempt++) {
        try {
            log('Downloading', URL_ZIP, attempt > 1 ? `(attempt ${attempt})` : '');
            const res = await fetch(URL_ZIP, { headers });
            if (res.status === 304) return null;
            if (!res.ok) throw new Error(`Cricsheet answered HTTP ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length < 1000 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error(`Cricsheet sent ${buf.length} bytes that are not a zip file`);
            writeFileSync(zip, buf);
            const etag = res.headers.get('etag');
            if (etag) writeFileSync(etagFile, etag);
            return zip;
        } catch (e) {
            if (attempt >= 5) throw e;
            log(String(e.message || e), '- retrying in', attempt * 10, 's');
            await new Promise((r) => setTimeout(r, attempt * 10000));
        }
    }
}

async function main() {
    let dir = opt('--from-dir');
    let cleanup = false;
    if (!dir) {
        let zip = opt('--zip');
        if (!zip) {
            zip = await download();
            if (!zip) { log('Cricsheet has no new data since the last run. Nothing to recompute.'); return; }
        }
        dir = join(cache, 'tests');
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(dir, { recursive: true });
        log('Unzipping', zip);
        execFileSync('unzip', ['-o', '-q', zip, '-d', dir], { stdio: 'inherit' }); // unzip ships with macOS
        cleanup = true;
    }

    const files = listJson(dir);
    if (files.length === 0) throw new Error('No match files found in ' + dir);
    const read = (f) => JSON.parse(readFileSync(f, 'utf8'));

    // Pass 1: which names does Cricsheet use for these teams? Lets a slightly wrong "raw" name in a series file still resolve.
    const wanted = teamsOf(configs); const names = new Map();
    for (const f of files) { try { collectNames(read(f), wanted, names); } catch { /* reported in pass 2 */ } }
    const states = configs.map((cfg) => {
        const { squad, notes } = resolveSquad(cfg.squads, names);
        notes.forEach((n) => log(`[${cfg.id}]`, n));
        return makeSeries(cfg, squad);
    });

    // Pass 2: the numbers.
    let through = ''; let matches = 0; let skipped = 0;
    for (const f of files) {
        try {
            const m = read(f);
            let date = null;
            for (const S of states) date = processMatch(m, f.split('/').pop(), S) ?? date;
            if (date === null) { skipped++; continue; }
            matches++;
            if (date > through) through = date;
        } catch (e) { skipped++; log('Skipped', f.split('/').pop(), '-', e.message); }
    }
    // India-wide database (Player matchup, Country matchup, Player analysis, Ground analysis)
    if (!args.includes('--no-india')) {
        try {
            const extrasFile = join(here, 'extras.json');
            buildIndia({ testsDir: dir, historyDir: join(root, 'data', 'history'), outFile: indiaFile, extras: existsSync(extrasFile) ? JSON.parse(readFileSync(extrasFile, 'utf8')) : [], log });
        } catch (e) { log('India data was not rebuilt:', e.message); }
    }
    if (cleanup) rmSync(dir, { recursive: true, force: true });
    if (matches === 0) throw new Error('No Test matches could be read; leaving the existing data untouched.');

    const generated = new Date().toISOString();
    const grids = {};
    for (const S of states) {
        grids[S.cfg.id] = buildGrid(S, { generated, through, matches });
        const g = grids[S.cfg.id];
        log(`[${S.cfg.id}] ${Object.keys(g.cells).length} bowler-batter pairs, ${Object.keys(g.vcells).length} ground-level pairs, ${Object.keys(g.venues).length} grounds with Tests.`);
    }
    // `GRID` (used by the full matchup grid on the main page) is the upcoming-Test series, "nz-ind".
    writeFileSync(outFile, renderModule(grids, (configs.find((c) => c.id === 'nz-ind') || configs[0]).id));
    log(`Read ${matches} Tests (${skipped} skipped), latest starts ${through}. Written to ${outFile}`);
}

main().catch((e) => { console.error('[refresh] FAILED:', e.message); process.exit(1); });
