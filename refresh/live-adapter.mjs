// The only file that knows where the live ball-by-ball comes from. It must return the neutral feed described in
// live-lib.mjs, or null when no source is configured.
//
//   Put these in the environment, or in refresh/live.env (one KEY=value per line):
//   LIVE_FEED_FILE=/path/to/feed.json            read a file (handy for testing)
//   LIVE_FEED_URL=https://...  [LIVE_FEED_AUTH="Header-Name: value"]   fetch JSON from your cricket data provider
//
// Providers do not all use this shape. If yours differs, convert it inside toNeutral() below. This has not been
// tested against any provider; it is a place to plug one in.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Settings can live in refresh/live.env (one KEY=value per line) so the hourly background job picks them up.
function envFromFile() {
    const f = fileURLToPath(new URL('./live.env', import.meta.url));
    const out = {};
    if (!existsSync(f)) return out;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
        if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
}

function toNeutral(json /* , { cfg, fixture } */) {
    return json; // replace with a mapping from your provider's ball-by-ball JSON when needed
}

export async function loadFeed(ctx, env = { ...envFromFile(), ...process.env }) {
    if (env.LIVE_FEED_FILE) return toNeutral(JSON.parse(readFileSync(env.LIVE_FEED_FILE, 'utf8')), ctx);
    if (env.LIVE_FEED_URL) {
        const headers = { 'User-Agent': 'cricket-site-live/1.0' };
        if (env.LIVE_FEED_AUTH) { const i = env.LIVE_FEED_AUTH.indexOf(':'); headers[env.LIVE_FEED_AUTH.slice(0, i).trim()] = env.LIVE_FEED_AUTH.slice(i + 1).trim(); }
        const res = await fetch(env.LIVE_FEED_URL, { headers });
        if (!res.ok) throw new Error(`Live feed answered HTTP ${res.status}`);
        return toNeutral(await res.json(), ctx);
    }
    return null;
}
