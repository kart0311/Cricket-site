// Hourly live update while a Test is on: reads the ball-by-ball feed (see live-adapter.mjs), adds this Test's balls to the
// head-to-head numbers, writes app/liveData.ts and rebuilds. Outside a Test it does nothing and costs nothing.
//
//   node refresh/live.mjs                   normal run (also what `npm run live` and the hourly job do)
//   node refresh/live.mjs --force           ignore the match-day check (testing)
//   node refresh/live.mjs --series ID [--fixture N]   pick a series and Test for a test run
//   node refresh/live.mjs --no-build        write app/liveData.ts but do not rebuild
//   node refresh/live.mjs --out FILE        write somewhere else (testing)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregateFeed, renderLive, activeFixture } from './live-lib.mjs';
import { loadFeed } from './live-adapter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const outFile = resolve(opt('--out') || join(root, 'app', 'liveData.ts'));
const log = (...a) => console.log('[live]', ...a);

const seriesDir = join(here, 'series');
const configs = readdirSync(seriesDir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(seriesDir, f), 'utf8')));

async function main() {
    let active = activeFixture(configs, Date.now());
    if (opt('--series')) {                      // testing: --series nz-ind [--fixture 2]
        const cfg = configs.find((c) => c.id === opt('--series'));
        if (!cfg) throw new Error('No series file with id ' + opt('--series'));
        active = { cfg, fixture: cfg.fixtures.find((f) => String(f.n) === opt('--fixture')) || cfg.fixtures[0] };
    }
    if (!active && args.includes('--force')) active = { cfg: configs[0], fixture: configs[0].fixtures[0] };
    if (!active) { log('No Test in progress. Nothing to do.'); return; }
    const { cfg, fixture } = active;
    const feed = await loadFeed({ cfg, fixture });
    if (!feed) { log('A Test is on, but no live feed is configured. Set LIVE_FEED_URL (and LIVE_FEED_AUTH) or LIVE_FEED_FILE; see refresh/live-adapter.mjs.'); return; }
    const r = aggregateFeed(feed, cfg, fixture);
    if (r.total === 0) { log('The feed had no deliveries yet.'); return; }
    if (r.used === 0) { log('None of the feed\'s deliveries matched squad players on both sides; nothing written. Check the names against the series file.', r.unknown.slice(0, 8).join(', ')); return; }
    if (r.unknown.length) log('Names in the feed that match nobody in the squad file (skipped):', r.unknown.slice(0, 12).join(', '));
    const live = { series: cfg.id, fixture: fixture.n, date: fixture.date, venue: fixture.venue, asOf: feed.asOf || new Date().toISOString(), balls: r.used, cells: r.cells, vcells: r.vcells };
    writeFileSync(outFile, renderLive(live));
    log(`${cfg.title} ${fixture.label}: ${r.used} of ${r.total} deliveries counted (squad players only). Written to ${outFile}`);
    if (!args.includes('--no-build') && !opt('--out')) execFileSync('node', [join(root, 'build.mjs')], { cwd: root, stdio: 'inherit' });
}
main().catch((e) => { console.error('[live] FAILED:', e.message); process.exit(1); });
