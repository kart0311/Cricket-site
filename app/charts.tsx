// Small presentation pieces: team badges, a bar chart that sits under the stat tiles, and a results strip.
// Everything is plain HTML so it scales with the page and needs no chart library.
import React, { useState } from 'react';
import { CODE } from './india';

export type Tone = 'ind' | 'opp' | 'neu';

// A small pill with the team's colour dot and code, e.g. (dot) AUS. Works on every device, unlike flag emoji.
export function Badge({ team }: { team: number }) {
    const code = CODE[team] || '';
    return <span className="crx-badge" data-team={code}>{code}</span>;
}

export interface BarItem { v: number; label: string; out?: boolean }

// Bars for a short series (runs by year, runs per meeting, innings totals). The tallest bar fills the height.
export function MiniBars({ items, tone = 'neu', title, note, foot, legend }: {
    items: BarItem[]; tone?: Tone; title: string; note?: string; foot?: [string, string]; legend?: string;
}) {
    const max = Math.max(1, ...items.map((x) => x.v));
    return <figure className={`crx-mini crx-t-${tone}`}>
        <figcaption><span>{title}</span>{note && <em>{note}</em>}</figcaption>
        <div className="crx-minibars" role="img" aria-label={`${title}. ${note || ''}`}>
            {items.map((x, i) => <i key={i} title={x.label} className={x.out ? 'crx-out' : ''} style={{ height: Math.max(4, Math.round(100 * x.v / max)) + '%' }} />)}
        </div>
        {(foot || legend) && <div className="crx-minifoot"><span>{foot ? foot[0] : ''}</span>{legend && <span className="crx-minilegend">{legend}</span>}<span>{foot ? foot[1] : ''}</span></div>}
    </figure>;
}

// One block per Test, oldest to newest: India won, opponent won, or drawn / tied / no result.
export function ResultStrip({ items, oppCode }: { items: { k: 'ind' | 'opp' | 'draw'; label: string }[]; oppCode: string }) {
    const n = (k: string) => items.filter((x) => x.k === k).length;
    return <figure className="crx-mini crx-strip">
        <figcaption><span>Results, oldest to newest</span></figcaption>
        <div className="crx-stripblocks" role="img" aria-label={`India won ${n('ind')}, ${oppCode} won ${n('opp')}, drawn ${n('draw')}`}>
            {items.map((x, i) => <i key={i} title={x.label} className={'crx-rs crx-rs-' + x.k} />)}
        </div>
        <div className="crx-stripkey"><span className="crx-rs-ind">India</span><span className="crx-rs-opp">{oppCode}</span><span className="crx-rs-draw">Drawn / other</span></div>
    </figure>;
}

// A small round "i" that opens a note underneath, for the fine print that used to sit between sections.
export function Info({ children, label = 'About these numbers' }: { children: any; label?: string }) {
    const [open, setOpen] = useState(false);
    return <>
        <button type="button" className="crx-info" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>i</button>
        {open && <span className="crx-infotext crx-noabbr">{children}</span>}
    </>;
}
