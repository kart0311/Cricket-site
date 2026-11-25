// Finds freely licensed photo candidates for every ground India has played Tests at, using Wikimedia Commons.
// Run in GitHub Actions (the sandbox cannot reach Commons). Writes thumbnails + contact sheets to out/photos/.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); const root = resolve(here, '..');
const out = resolve(process.env.OUT || join(root, 'out', 'photos')); mkdirSync(out, { recursive: true });
const { build } = await import('esbuild'); const tmp = join(root, '.card-tmp'); mkdirSync(tmp, { recursive: true });
writeFileSync(join(tmp, 'entry.ts'), `export { GROUNDS, TESTS, isIndia } from '${join(root, 'app', 'india').replace(/\\/g, '/')}';`);
await build({ entryPoints: [join(tmp, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outfile: join(tmp, 'g.mjs'), logLevel: 'warning', define: { __BUILD_DATE__: '""' } });
const { GROUNDS, TESTS, isIndia } = await import(pathToFileURL(join(tmp, 'g.mjs')).href);

const count = new Map(); for (const t of TESTS) if (isIndia(t)) count.set(t.g, (count.get(t.g) || 0) + 1);
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
const grounds = [...count.entries()].map(([i, n]) => ({ i, n, ...GROUNDS[i] })).filter((g) => !ONLY || ONLY.test(g.name)).sort((a, b) => b.n - a.n);
const UA = { 'User-Agent': 'IndianCricketBeyondTheScoreboard/1.0 (https://github.com/kart0311/Cricket-site; hobby stats site)' };
const OK = /^(CC0|Public domain|PD|CC[ -]BY(-SA)?\b)/i; const BAD = /\b(NC|ND)\b|non-?commercial/i;
const BADNAME = /rugby|football|soccer|united|logo|map|flag|ticket|scorecard|plan|diagram|poster|stamp|coin|crest|svg|screenshot|sketch|painting|\.png/i;
const strip = (h) => String(h || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
async function api(params) { const u = 'https://commons.wikimedia.org/w/api.php?format=json&origin=*&' + new URLSearchParams(params); for (let k = 0; k < 4; k++) { const r = await fetch(u, { headers: UA }); if (r.ok) return r.json(); await new Promise((s) => setTimeout(s, 1500 * (k + 1))); } throw new Error('api ' + u); }

const ALIAS = {
    'Narendra Modi': ['Narendra Modi Stadium cricket Ahmedabad', 'Narendra Modi Stadium', 'Sardar Patel Gujarat Stadium Motera'],
    'Old Trafford': ['Old Trafford Cricket Ground', 'Emirates Old Trafford cricket'],
    'Headingley': ['Headingley Cricket Ground', 'Headingley Stadium cricket Test'],
    'Trent Bridge': ['Trent Bridge Cricket Ground', 'Trent Bridge cricket Nottingham'],
    'Newlands': ['Newlands Cricket Ground Cape Town', 'Newlands cricket stadium'],
    'WACA': ['WACA Ground cricket Perth', 'Western Australian Cricket Association Ground'],
    'SuperSport Park': ['SuperSport Park Centurion cricket', 'Centurion Park cricket'],
    'Kingsmead': ['Kingsmead Cricket Ground Durban'],
    'Lal Bahadur': ['Lal Bahadur Shastri Stadium cricket Hyderabad Fateh Maidan'],
    'Chepauk': ['M. A. Chidambaram Stadium', 'Chepauk Stadium Chennai', 'Chepauk cricket'],
    'Jamtha': ['Vidarbha Cricket Association Stadium', 'VCA Stadium Jamtha Nagpur', 'Jamtha stadium'],
    'Holkar': ['Holkar Stadium Indore', 'Holkar Cricket Stadium'],
    'Sawai Mansingh': ['Sawai Mansingh Stadium Jaipur'],
    'Barsapara': ['Barsapara Cricket Stadium', 'ACA Stadium Guwahati', 'Barsapara stadium Guwahati'],
    'JSCA': ['JSCA International Stadium Complex Ranchi', 'JSCA Stadium Ranchi', 'Ranchi cricket stadium'],
    'Motera': ['Narendra Modi Stadium', 'Sardar Patel Stadium Motera', 'Motera stadium Ahmedabad'],
    'Gujarat Stadium': ['Sardar Patel Gujarat Stadium Navrangpura'],
    'Harare': ['Harare Sports Club'], 'Rawalpindi': ['Rawalpindi Cricket Stadium'],
};
const result = [];
for (const g of grounds) {
    const plain = g.name.replace(/\s*\(.*?\)/g, '').trim(); const parens = (g.name.match(/\(([^)]*)\)/) || [])[1];
    const extra = Object.entries(ALIAS).filter(([k]) => g.name.includes(k)).flatMap(([, v]) => v);
    const queries = [...new Set([`${plain} ${g.city}`, `${plain} stadium`, ...(parens ? [`${parens} ${g.city}`] : []), ...extra])];
    const seen = new Map();
    for (const q of queries) {
        let d; try { d = await api({ action: 'query', generator: 'search', gsrsearch: q + ' filetype:bitmap', gsrnamespace: '6', gsrlimit: '20', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '900' }); } catch (e) { console.log('skip', q, e.message); continue; }
        for (const p of Object.values(d.query?.pages || {})) {
            const ii = p.imageinfo?.[0]; if (!ii || seen.has(p.title)) continue;
            const m = ii.extmetadata || {}; const lic = strip(m.LicenseShortName?.value);
            if (!OK.test(lic) || BAD.test(lic) || BADNAME.test(p.title)) continue;
            if (ii.mime !== 'image/jpeg' || ii.width < 800 || ii.width < ii.height * 1.2) continue;
            const text = (p.title + ' ' + strip(m.ImageDescription?.value)).toLowerCase();
            const key = [...g.name.toLowerCase().split(/[ ,()]/), ...extra.flatMap((e) => e.toLowerCase().split(' '))].filter((w) => w.length > 3 && !['stadium', 'cricket', 'ground', 'international', 'association', 'complex'].includes(w));
            const score = (key.some((w) => text.includes(w)) ? 2 : 0) + (text.includes(g.city.toLowerCase()) ? 1 : 0) + (/stadium|ground|oval|park|cricket/.test(text) ? 1 : 0);
            seen.set(p.title, { title: p.title, license: lic, author: strip(m.Artist?.value), page: ii.descriptionurl, thumb: ii.thumburl, w: ii.width, h: ii.height, score });
        }
        await new Promise((s) => setTimeout(s, 400));
    }
    let pool = [...seen.values()]; let cands = pool.filter((c) => c.score >= 2);
    if (cands.length < 2) cands = pool.filter((c) => c.score >= 1);
    console.log('  raw', pool.length); cands = cands.sort((a, b) => b.score - a.score || b.w - a.w).slice(0, 5);
    result.push({ ground: g.name, city: g.city, country: g.country, tests: g.n, cands });
    console.log(g.n, g.name, '|', g.city, '→', cands.length, 'candidates');
}
// download thumbnails and make contact sheets
for (const [gi, r] of result.entries()) for (const [ci, c] of r.cands.entries()) {
    try { const b = Buffer.from(await (await fetch(c.thumb, { headers: UA })).arrayBuffer()); const f = `g${gi}-${ci}.jpg`; writeFileSync(join(out, f), b); c.file = f; } catch (e) { console.log('dl fail', c.title); }
    await new Promise((s) => setTimeout(s, 250));
}
writeFileSync(join(out, 'candidates.json'), JSON.stringify(result, null, 1));
const { chromium } = await import('playwright'); const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1500, height: 900 } });
const per = 6; for (let s = 0; s * per < result.length; s++) {
    const rows = result.slice(s * per, s * per + per).map((r, k) => `<div class="r"><h3>#${s * per + k} ${r.ground} · ${r.city} (${r.tests} Tests)</h3><div class="c">${r.cands.map((c, ci) => `<figure><img src="g${s * per + k}-${ci}.jpg"><figcaption>${ci}: ${c.license}</figcaption></figure>`).join('') || '<i>no candidates</i>'}</div></div>`).join('');
    writeFileSync(join(out, `sheet${s}.html`), `<style>body{margin:0;background:#222;color:#eee;font:14px sans-serif}.r{padding:6px 10px}h3{margin:4px 0}.c{display:flex;gap:8px}figure{margin:0;width:285px}img{width:285px;height:150px;object-fit:cover;display:block}figcaption{font-size:12px}</style>${rows}`);
    await pg.goto(pathToFileURL(join(out, `sheet${s}.html`)).href); await pg.waitForTimeout(500); await pg.screenshot({ path: join(out, `sheet${s}.jpg`), type: 'jpeg', quality: 80, fullPage: true });
}
await br.close(); console.log('done', result.length, 'grounds');
