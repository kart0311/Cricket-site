import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FileCard } from '@instinct/files';
import { IndiaCountry, IndiaGrounds, IndiaMatchup, IndiaPlayers, MatchupCoverage, duelName, popularDuels } from './IndiaViews';
import { HomeSearch } from './HomeSearch';
import { go } from './nav';
import { countryView, displayText } from './countryLabels';
import headerPhoto from './photos/cricket-header.jpg';
import { GROUNDS, TESTS, isIndia, n1, yearOf } from './india';

// One line under the masthead, counted from the data rather than typed in, so it stays true
// as the daily refresh adds matches.
const MASTHEAD_FACTS: [string, string][] = (() => {
    const bb = TESTS.filter((t) => isIndia(t) && t.bb).length;
    const first = TESTS[0] ? yearOf(TESTS[0].d) : '1877';
    return [[n1(TESTS.length), 'Tests since ' + first], [n1(bb), 'India Tests ball by ball'], [n1(GROUNDS.length), 'grounds']];
})();

const BROWSE: [string, string][] = [['players', 'Players'], ['grounds', 'Grounds'], ['countries', 'Teams'], ['matchups', 'Duels']];

function Selector({ label, value, options, open, onToggle, onChange, sort = true, placeholder, title, half, searchable = true, tone }: any) {
    const current = options.find((o: any) => o.value === value);
    const [q, setQ] = useState('');
    const sorted = useMemo(() => sort ? options.slice().sort((a: any, b: any) => a.label.localeCompare(b.label)) : options, [options, sort]);
    const needle = q.trim().toLowerCase();
    const filtered = needle ? sorted.filter((o: any) => (o.label.toLowerCase().includes(needle) || displayText(o.label).toLowerCase().includes(needle) || (o.searchText || '').toLowerCase().includes(needle))) : sorted;
    const pick = (v: string) => { setQ(''); onChange(v); };
    const rootRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDialogElement>(null);
    useLayoutEffect(() => {
        if (!open) return;
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (!dialog.open) dialog.showModal();
        return () => {
            if (dialog.open) dialog.close();
            rootRef.current?.querySelector('button')?.focus({ preventScroll: true });
        };
    }, [open]);
    const dismiss = () => { setQ(''); onToggle(); };
    return countryView(<div className={'crx-sel' + (half ? ' crx-sel-half' : '') + (tone ? ' crx-t-' + tone : '')} data-selector={label} ref={rootRef}>
        <button type="button" className={'crx-selbtn' + ((current || value != null) ? ' crx-filled' : '')} onClick={() => { setQ(''); onToggle(); }} aria-expanded={open} aria-haspopup="dialog" aria-label={label}>
            <span className="crx-sellabel">{label}</span>
            <span className={'crx-selvalue' + (!current && value == null ? ' crx-selph' : '')}>{current ? current.label : (value != null ? value : (placeholder || 'Select'))}</span>
            <span className="crx-chev">{open ? '−' : '+'}</span>
        </button>
        {open && <>
            <dialog className="crx-sheet crx-picker-dialog" ref={dialogRef} aria-label={title || label}
                onCancel={(e) => { e.preventDefault(); dismiss(); }}
                onClick={(e) => {
                    if (e.target !== e.currentTarget) return;
                    const r = e.currentTarget.getBoundingClientRect();
                    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dismiss();
                }}>
                <div className="crx-sheethead">
                    <div className="crx-sheettitle">{title || label}</div>
                    <button type="button" className="crx-sheetdone" autoFocus onClick={dismiss}>Done</button>
                </div>
                {searchable && <input type="text" className="crx-search" placeholder="Type to search" value={q}
                    onChange={(e: any) => setQ(e.target.value)}
                    onKeyDown={(e: any) => { if (e.key === 'Enter' && filtered.length) { e.preventDefault(); e.stopPropagation(); pick(filtered[0].value); } }} />} 
                <div className="crx-optlist">{filtered.map((o: any) =>
                    countryView(<button key={o.value} type="button"
                        className={'crx-opt' + (o.value === value ? ' crx-opton' : '')}
                        onClick={() => pick(o.value)}>
                        <span>{o.label}</span>
                        {o.value === value && <span className="crx-optcheck">✓</span>}
                    </button>))}
                    {filtered.length === 0 && <div className="crx-optnone">No matching option</div>}
                </div>
            </dialog>
        </>}
    </div>);
}

function InstallTip() {
    const [hide, setHide] = useState(() => { try { return localStorage.getItem('crx-tip') === '1'; } catch { return false; } });
    const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = typeof window !== 'undefined' && ((navigator as any).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches);
    if (hide || !ios || standalone) return null;
    return <div className="crx-tip"><span>Keep it on your phone: tap <b>Share</b>, then <b>Add to Home Screen</b>.</span><button type="button" aria-label="Dismiss" onClick={() => { setHide(true); try { localStorage.setItem('crx-tip', '1'); } catch { /* ignore */ } }}>×</button></div>;
}

export function App() {
    const [pageFloor] = useState(() => typeof window === 'undefined' ? 0 : window.innerHeight);
    // null = the home page; otherwise the screen being shown (players, grounds, countries, matchups)
    const [view, setView] = useState<string | null>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const toTop = () => requestAnimationFrame(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); });
    useEffect(() => {
        try { history.replaceState({ v: null }, ''); } catch { /* file:// previews */ }
        const pop = (e: PopStateEvent) => { setView(e.state && e.state.v ? e.state.v : null); toTop(); };
        window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop);
    }, []);
    const show = (id: string | null) => { setView(id); try { history.pushState({ v: id }, ''); } catch { /* ignore */ } toTop(); };
    const VIEW_OF: Record<string, string> = { player: 'players', ground: 'grounds', team: 'countries', duel: 'matchups' };
    const jump = (kind: 'player' | 'ground' | 'team' | 'duel', value: any) => { go(kind, value); show(VIEW_OF[kind]); };
    const duels = useMemo(() => popularDuels(), []);
    const compact = view !== null;
    return countryView(<div className={'crx-theme crx-dark' + (compact ? ' crx-compact' : '')}>
    <div className="crx-site" style={{ minHeight: pageFloor }}>
    <FileCard>
        <section className="crx-section">
            <header className="crx-photoheader">
                <div className="crx-stadium-photo">
                    <img className="crx-headerphoto" src={headerPhoto} alt="A bowler delivering to a batter, with close fielders waiting around the pitch" />
                </div>
                <div className="crx-masthead">
                    <h1 className="crx-title crx-noabbr"><span className="crx-title1">Indian Cricket</span><span className="crx-title2">Beyond the Scoreboard</span></h1>
                    <div className="crx-mastfacts">{MASTHEAD_FACTS.map(([v, l]) => <div key={l}><strong>{v}</strong><span>{l}</span></div>)}</div>
                </div>
            </header>
            <div className="crx-tabtop" ref={topRef} aria-hidden="true" />
            {view === null
                ? <div className="crx-home">
                    <HomeSearch onPick={(k, v) => jump(k, v)} />
                    {duels.length > 0 && <div className="crx-quick"><div className="crx-quicktitle">Or start with a famous duel</div><div className="crx-quickrow">{duels.map(([b, t, n]) => <button type="button" className="crx-quickbtn" key={b + '-' + t} onClick={() => jump('duel', [b, t])}><span className="crx-qb">{duelName(b)}</span><em>to</em><span className="crx-qt">{duelName(t)}</span><small>{n} {n === 1 ? 'meeting' : 'meetings'}</small></button>)}</div></div>}
                    <div className="crx-browse"><span>Or browse</span>{BROWSE.map(([id, l]) => <button type="button" key={id} className="crx-browsebtn" onClick={() => show(id)}>{l}</button>)}</div>
                    <InstallTip />
                </div>
                : <div className="crx-navbar"><button type="button" className="crx-back" onClick={() => { if (history.state && history.state.v) history.back(); else show(null); }} aria-label="Back to the home page"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>Home</button><HomeSearch compact onPick={(k, v) => jump(k, v)} /></div>}

            <div className="crx-tabpanel" role="region" aria-label="Player matchup" id="crx-panel-matchups" hidden={view !== 'matchups'}>
                <IndiaMatchup Selector={Selector} />
            </div>
            <div className="crx-tabpanel" role="region" aria-label="Team matchup" id="crx-panel-countries" hidden={view !== 'countries'}>
                <IndiaCountry Selector={Selector} />
            </div>
            <div className="crx-tabpanel" role="region" aria-label="Player analysis" id="crx-panel-players" hidden={view !== 'players'}>
                <IndiaPlayers Selector={Selector} />
            </div>
            <div className="crx-tabpanel" role="region" aria-label="Ground analysis" id="crx-panel-grounds" hidden={view !== 'grounds'}>
                <IndiaGrounds Selector={Selector} />
            </div>
        </section>
        {<details className="crx-datanote"><summary>About this data</summary>
            {view === 'matchups' && <p className="crx-fine"><MatchupCoverage /></p>}
            <p className="crx-credit">Ball-by-ball data: Cricsheet (cricsheet.org), ODC-By 1.0. Scorecard history since 1932: public Test dataset compiled from ESPNcricinfo records. Computed from match data, not official totals.</p>
        </details>}
    </FileCard>
    </div>
    </div>);
}
