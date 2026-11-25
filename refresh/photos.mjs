// Downloads the stadium photos listed in app/stadiumPhotos.manifest.json from Wikimedia Commons, checks each one's
// licence again, and writes public/stadiums/*.jpg plus app/stadiumPhotos.generated.json (who took it, which licence).
// Never fails the build: a photo that cannot be fetched is simply left out.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'app', 'stadiumPhotos.manifest.json'), 'utf8'));
const outDir = join(root, 'public', 'stadiums'); mkdirSync(outDir, { recursive: true });
const UA = { 'User-Agent': 'IndianCricketBeyondTheScoreboard/1.0 (https://github.com/kart0311/Cricket-site; hobby stats site)' };
const OK = /^(CC0|Public domain|PD|CC[ -]BY(-SA)?\b)/i; const BAD = /\b(NC|ND)\b|non-?commercial/i;
const strip = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, asJson) {
    for (let k = 0; k < 4; k++) {
        try { const r = await fetch(url, { headers: UA }); if (r.ok) return asJson ? r.json() : Buffer.from(await r.arrayBuffer()); } catch { /* retry */ }
        await sleep(1500 * (k + 1));
    }
    return null;
}
const entries = Object.entries(manifest); const result = {};
for (let i = 0; i < entries.length; i += 20) {
    const chunk = entries.slice(i, i + 20);
    const q = new URLSearchParams({ action: 'query', format: 'json', origin: '*', prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '1100', titles: chunk.map(([, t]) => t).join('|') });
    const d = await get('https://commons.wikimedia.org/w/api.php?' + q, true);
    const pages = Object.values(d?.query?.pages || {}); const norm = new Map((d?.query?.normalized || []).map((n) => [n.from, n.to]));
    for (const [key, title] of chunk) {
        const p = pages.find((x) => x.title === (norm.get(title) || title)); const ii = p?.imageinfo?.[0];
        if (!ii) { console.log('missing', key); continue; }
        const m = ii.extmetadata || {}; const license = strip(m.LicenseShortName?.value);
        if (!OK.test(license) || BAD.test(license)) { console.log('licence not allowed', key, license); continue; }
        const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
        const file = join(outDir, slug + '.jpg');
        if (!existsSync(file)) { const buf = await get(ii.thumburl, false); if (!buf || buf.length < 5000) { console.log('download failed', key); continue; } writeFileSync(file, buf); await sleep(250); }
        result[key] = { file: 'stadiums/' + slug + '.jpg', author: strip(m.Artist?.value).slice(0, 80), license, page: ii.descriptionurl };
    }
}
writeFileSync(join(root, 'app', 'stadiumPhotos.generated.json'), JSON.stringify(result));
console.log(`stadium photos: ${Object.keys(result).length} of ${entries.length}`);
