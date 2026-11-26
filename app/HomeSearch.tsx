import React, { useMemo, useRef, useState } from 'react';
import { CODE, GROUNDS, PLAYERS, TEAMS, groundName } from './india';
import { HOME_GROUNDS, HOME_PLAYERS, HOME_TEAMS } from './IndiaViews';

export type Hit = { kind: 'player' | 'ground' | 'team'; value: number; title: string; sub: string; hay: string };
const flat = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
let INDEX: Hit[] | null = null;
function index(): Hit[] {
    if (!INDEX) {
        INDEX = [];
        for (const p of HOME_PLAYERS()) INDEX.push({ kind: 'player', value: p.i, title: p.name, sub: TEAMS[p.team], hay: flat(p.name + ' ' + TEAMS[p.team] + ' ' + CODE[p.team]) });
        for (const g of HOME_GROUNDS()) INDEX.push({ kind: 'ground', value: g, title: groundName(g), sub: 'Ground · ' + (GROUNDS[g].country || ''), hay: flat(groundName(g) + ' ' + GROUNDS[g].name + ' ' + GROUNDS[g].city) });
        for (const o of HOME_TEAMS()) INDEX.push({ kind: 'team', value: o, title: TEAMS[o], sub: 'India against ' + TEAMS[o], hay: flat(TEAMS[o] + ' ' + CODE[o]) });
    }
    return INDEX;
}
function search(q: string): Hit[] {
    const words = flat(q).split(' ').filter(Boolean); if (!words.length) return [];
    const scored: [number, Hit][] = [];
    for (const h of index()) {
        if (!words.every((w) => h.hay.includes(w))) continue;
        const t = flat(h.title); const first = words[0];
        const score = t.startsWith(words.join(' ')) ? 0 : t.split(' ').some((x) => x.startsWith(first)) ? 1 : 2;
        scored.push([score * 100 + (h.kind === 'team' ? 0 : h.kind === 'ground' ? 5 : 10) + Math.min(h.title.length, 60) / 10, h]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    const out: Hit[] = []; const per = { player: 0, ground: 0, team: 0 };
    const cap = { player: 5, ground: 3, team: 2 };
    for (const [, h] of scored) { if (per[h.kind] >= cap[h.kind]) continue; per[h.kind]++; out.push(h); }
    return out;
}
const KIND_TAG: Record<string, string> = { player: 'Player', ground: 'Ground', team: 'Team' };

export function HomeSearch({ onPick, compact }: { onPick: (kind: Hit['kind'], value: number) => void; compact?: boolean }) {
    const [q, setQ] = useState(''); const [on, setOn] = useState(0); const [focus, setFocus] = useState(false);
    const ref = useRef<HTMLInputElement>(null);
    const hits = useMemo(() => search(q), [q]);
    const pick = (h: Hit) => { onPick(h.kind, h.value); setQ(''); setFocus(false); ref.current?.blur(); };
    const showList = focus && q.trim().length > 0;
    return <div className={'crx-hsearch' + (compact ? ' crx-hsearch-s' : '')}>
        <div className="crx-hsbox">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <input ref={ref} type="search" inputMode="search" enterKeyHint="go" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Search a player, ground or team" placeholder={compact ? 'Search' : 'Search a player, ground or team'}
                value={q} onChange={(e) => { setQ(e.target.value); setOn(0); }} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setOn(Math.min(on + 1, hits.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setOn(Math.max(on - 1, 0)); }
                    else if (e.key === 'Enter' && hits[on]) { e.preventDefault(); pick(hits[on]); }
                    else if (e.key === 'Escape') { setQ(''); }
                }} />
            {q && <button type="button" className="crx-hsclear" aria-label="Clear" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(''); ref.current?.focus(); }}>×</button>}
        </div>
        {showList && <div className="crx-hslist" role="listbox">
            {hits.length === 0 && <div className="crx-hsnone">Nothing found. Try a surname, a ground or a country.</div>}
            {hits.map((h, i) => <button type="button" role="option" aria-selected={i === on} key={h.kind + h.value} className={'crx-hsopt' + (i === on ? ' crx-hson' : '')} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
                <span className="crx-hstitle">{h.title}</span><span className="crx-hssub">{h.sub}</span><span className={'crx-hstag crx-hstag-' + h.kind}>{KIND_TAG[h.kind]}</span>
            </button>)}
        </div>}
    </div>;
}
