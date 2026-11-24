// Makes a shareable JPEG for one bowler-to-batter matchup, using the site's own data.
//   node tools/card.mjs --bowler "Jasprit Bumrah" --batter "Steve Smith" --out cards/bumrah-smith.jpg
// Needs app/indiaData.ts (the daily refresh writes it) and, for the picture, the playwright package with Chromium.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const bowlerName = opt('--bowler'); const batterName = opt('--batter');
const out = resolve(opt('--out', join(root, 'cards', 'card.jpg')));
const site = opt('--site', 'kart0311.github.io/Cricket-site');
if (!bowlerName || !batterName) { console.error('Usage: node tools/card.mjs --bowler "Name" --batter "Name" [--out file.jpg]'); process.exit(2); }

const { build } = await import(process.env.ESBUILD || 'esbuild');
const tmp = resolve(process.env.CARD_TMP || join(root, '.card-tmp')); mkdirSync(tmp, { recursive: true });
await build({ entryPoints: [join(here, 'card-lib.ts')], bundle: true, format: 'esm', platform: 'node', outfile: join(tmp, 'card-lib.mjs'),
    nodePaths: process.env.NODE_PATH ? process.env.NODE_PATH.split(':') : [], logLevel: 'warning', define: { __BUILD_DATE__: '""' } });
const lib = await import(pathToFileURL(join(tmp, 'card-lib.mjs')).href + '?t=' + Date.now());

const pick = (name, side) => {
    const hits = lib.findByName(name, side);
    if (!hits.length) { console.error(`No player found for "${name}"`); process.exit(1); }
    if (hits.length > 1) console.log(`"${name}" matched ${hits.length} players; using the most recent one.`);
    return hits[0];
};
const bowler = pick(bowlerName, null); const batter = pick(batterName, null);
const photo = 'data:image/jpeg;base64,' + readFileSync(join(root, 'app', 'photos', 'cricket-header.jpg')).toString('base64');
let html;
try { html = lib.cardHtml(bowler, batter, photo, site); } catch (e) { console.error(String(e.message || e)); process.exit(1); }
const htmlFile = join(tmp, 'card.html'); writeFileSync(htmlFile, html);
console.log('wrote', htmlFile);
if (args.includes('--html-only')) process.exit(0);

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(htmlFile).href); await page.waitForTimeout(300);
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
await browser.close();
console.log('wrote', out);
