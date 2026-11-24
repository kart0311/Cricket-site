// Draws the shareable matchup picture (a 1080x1350 card, saved at 2x) straight onto a canvas in the browser,
// so it works on iPhone, iPad and Mac with no server. The numbers are handed in by the matchup page.
import headerPhoto from './photos/cricket-header.jpg';

export type CardModel = {
    bowler: string; bowlerTeam: string; bowlerTone: 'ind' | 'opp';
    batter: string; batterTeam: string; batterTone: 'ind' | 'opp';
    sub: string;                       // e.g. "8 Tests · 2020 to 2025 · All grounds"
    verdict: string; caveat: string;
    tiles: [string, string][];         // four big boxes; the third is highlighted
    kinds: string;                     // e.g. "caught 3 · bowled 1", empty when nobody was dismissed
    smalls: [string, string][] | null; // four small numbers, or null when there is no ball-by-ball detail
    bars: { v: number; out: boolean }[]; years: [number, number] | null;
    rows: { date: string; place: string; line: string; out: boolean }[];
    site: string;
};

const W = 1080, H = 1350, S = 2;
const SANS = "-apple-system, 'SF Pro Text', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const COL = { ind: '#f2a652', opp: '#6fc1d8', ink: '#faebd7', soft: '#c6a78c', faint: '#a58872', line: '#5a3b2e', box: '#6b4a3a', red: '#ff8a7a' };

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function spaced(c: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number, align: 'left' | 'right' = 'left') {
    const t = text.toUpperCase(); let w = 0; for (const ch of t) w += c.measureText(ch).width + gap; w -= gap;
    let cx = align === 'right' ? x - w : x; c.textAlign = 'left';
    for (const ch of t) { c.fillText(ch, cx, y); cx += c.measureText(ch).width + gap; }
    return w;
}
function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
    const words = text.split(' '); const out: string[] = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
}
function fit(c: CanvasRenderingContext2D, text: string, family: string, size: number, maxW: number, min = 30) {
    let s = size; do { c.font = `${s}px ${family}`; if (c.measureText(text).width <= maxW) break; s -= 2; } while (s > min);
}
const tone = (t: 'ind' | 'opp') => COL[t];

export async function makeCard(m: CardModel): Promise<Blob> {
    const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    const c = cv.getContext('2d')!; c.scale(S, S); c.textBaseline = 'alphabetic';
    const photo = await loadImage(headerPhoto);

    // background
    c.fillStyle = '#43281d'; c.fillRect(0, 0, W, H);
    const rg = c.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, 900); rg.addColorStop(0, 'rgba(110,66,46,.55)'); rg.addColorStop(1, 'rgba(67,40,29,0)');
    c.fillStyle = rg; c.fillRect(0, 0, W, H);

    // photo, cropped like "cover" with the focus a little above the middle
    const PH = 250; const sc = Math.max(W / photo.width, PH / photo.height); const dw = photo.width * sc, dh = photo.height * sc;
    c.save(); c.beginPath(); c.rect(0, 0, W, PH); c.clip(); c.drawImage(photo, (W - dw) / 2, -(dh - PH) * 0.46, dw, dh); c.restore();
    const pg = c.createLinearGradient(0, 0, 0, PH); pg.addColorStop(0, 'rgba(56,32,26,.15)'); pg.addColorStop(.3, 'rgba(56,32,26,0)'); pg.addColorStop(1, '#43281d');
    c.fillStyle = pg; c.fillRect(0, 0, W, PH);
    c.fillStyle = COL.ind; c.fillRect(72, 229, 34, 3);
    c.fillStyle = '#e0c3a6'; c.font = `600 21px ${SANS}`; spaced(c, 'Test cricket · ball by ball', 120, 238, 4.2);

    const footTop = H - 112;
    const paint = (off: number) => {
    c.save(); c.translate(0, off);
    // bowler and batter
    const half = 440;
    const side = (name: string, team: string, t: 'ind' | 'opp', role: string, right: boolean) => {
        const x = right ? W - 72 : 72;
        c.fillStyle = COL.faint; c.font = `19px ${SANS}`; spaced(c, role, x, 288, 3, right ? 'right' : 'left');
        fit(c, name, SERIF, 50, half); c.fillStyle = tone(t); c.textAlign = right ? 'right' : 'left'; c.fillText(name, x, 345);
        c.font = `700 20px ${SANS}`; const tw = (() => { let w = 0; for (const ch of team) w += c.measureText(ch).width + 1.6; return w - 1.6; })();
        const bw = tw + 14 * 2 + 20; const bx = right ? x - bw : x;
        c.strokeStyle = '#7a5a49'; c.lineWidth = 2; rr(c, bx, 368, bw, 38, 19); c.stroke();
        c.fillStyle = tone(t); c.beginPath(); c.arc(bx + 14 + 5.5, 387, 5.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = COL.ink; c.font = `700 20px ${SANS}`; spaced(c, team, bx + 14 + 20, 394, 1.6);
    };
    side(m.bowler, m.bowlerTeam, m.bowlerTone, 'Bowler', false); side(m.batter, m.batterTeam, m.batterTone, 'Batter', true);
    c.fillStyle = COL.faint; c.font = `italic 34px ${SERIF}`; c.textAlign = 'center'; c.fillText('to', W / 2, 345);

    // sub line between two rules
    c.font = `23px ${SANS}`; const sw = c.measureText(m.sub).width; c.fillStyle = COL.soft; c.textAlign = 'center'; c.fillText(m.sub, W / 2, 462);
    c.fillStyle = COL.line; c.fillRect(72, 454, (W - sw) / 2 - 86, 2); c.fillRect(W / 2 + sw / 2 + 14, 454, (W - sw) / 2 - 86, 2);

    // verdict
    let y = 520; c.textAlign = 'left'; c.fillStyle = '#fff3e3'; c.font = `34px ${SERIF}`;
    for (const l of wrap(c, m.verdict, W - 144)) { c.fillText(l, 72, y); y += 44; }
    if (m.caveat) { c.fillStyle = '#e6b87f'; c.font = `23px ${SANS}`; c.fillText(m.caveat, 72, y + 4); y += 34; }
    y += 6;

    // four boxes
    const gap = 14, bw = (W - 144 - gap * 3) / 4;
    m.tiles.forEach(([v, l], i) => {
        const x = 72 + i * (bw + gap), hot = i === 2;
        rr(c, x, y, bw, 124, 14); c.fillStyle = hot ? 'rgba(242,166,82,.12)' : 'rgba(255,255,255,.05)'; c.fill();
        c.strokeStyle = hot ? COL.ind : COL.box; c.lineWidth = 2; c.stroke();
        c.textAlign = 'center'; c.fillStyle = hot ? '#ffc27e' : COL.ink; c.font = `700 60px ${SANS}`; c.fillText(v, x + bw / 2, y + 68);
        c.fillStyle = COL.soft; c.font = `21px ${SANS}`; c.fillText(l, x + bw / 2, y + 102);
    });
    y += 124 + 18;
    if (m.kinds) {
        c.textAlign = 'left'; c.fillStyle = COL.faint; c.font = `19px ${SANS}`; const lw = spaced(c, 'Got out', 72, y + 26, 3);
        c.fillStyle = COL.ink; c.font = `600 24px ${SANS}`; c.fillText(m.kinds, 72 + lw + 20, y + 26); y += 50;
    } else y += 4;
    if (m.smalls) {
        y += 8;
        m.smalls.forEach(([v, l], i) => {
            const cx = 72 + i * (bw + gap) + bw / 2; c.textAlign = 'center';
            c.fillStyle = COL.ink; c.font = `700 32px ${SANS}`; c.fillText(v, cx, y + 26); c.fillStyle = COL.soft; c.font = `20px ${SANS}`; c.fillText(l, cx, y + 54);
        });
        y += 76;
    }

    // chart: runs in each meeting
    if (m.bars.length > 1) {
        const ch = 190; rr(c, 72, y, W - 144, ch, 14); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill(); c.strokeStyle = COL.box; c.lineWidth = 2; c.stroke();
        c.textAlign = 'left'; c.fillStyle = COL.ink; c.font = `600 22px ${SANS}`; c.fillText('Runs in each meeting', 96, y + 36);
        c.textAlign = 'right'; c.fillStyle = COL.soft; c.font = `22px ${SANS}`; c.fillText('dot = dismissed', W - 96, y + 36);
        const base = y + ch - 40, top = y + 62, ah = base - top - 14, n = m.bars.length, areaW = W - 192, g = 7;
        const bwid = Math.min(70, (areaW - g * (n - 1)) / n), total = bwid * n + g * (n - 1), x0 = 96 + (areaW - total) / 2;
        const max = Math.max(1, ...m.bars.map((b) => b.v));
        c.fillStyle = COL.box; c.fillRect(96, base, areaW, 2);
        m.bars.forEach((b, i) => {
            const bh = Math.max(4, Math.round(ah * b.v / max)), x = x0 + i * (bwid + g);
            c.fillStyle = tone(m.batterTone); rr(c, x, base - bh, bwid, bh, 4); c.fill();
            if (b.out) { c.fillStyle = COL.red; c.beginPath(); c.arc(x + bwid / 2, base - bh - 10, 5.5, 0, Math.PI * 2); c.fill(); }
        });
        if (m.years) { c.fillStyle = COL.faint; c.font = `18px ${SANS}`; c.textAlign = 'left'; c.fillText(String(m.years[0]), 96, y + ch - 14); c.textAlign = 'right'; c.fillText(String(m.years[1]), W - 96, y + ch - 14); }
        y += ch + 16;
    }

    // most recent meetings, as many whole rows as fit above the footer
    c.textAlign = 'left'; c.fillStyle = COL.faint; c.font = `19px ${SANS}`; spaced(c, 'Most recent meetings', 72, y + 18, 3);
    y += 30;
    for (const r of m.rows) {
        if (y + 74 > footTop - 6 - off) break;
        c.fillStyle = COL.line; c.fillRect(72, y, W - 144, 2);
        c.fillStyle = r.out ? COL.red : COL.box; c.beginPath(); c.arc(79, y + 37, 6, 0, Math.PI * 2); c.fill();
        c.textAlign = 'left'; c.fillStyle = COL.ink; c.font = `700 24px ${SANS}`; c.fillText(r.date, 106, y + 32);
        c.fillStyle = COL.soft; c.font = `20px ${SANS}`; c.fillText(r.place, 106, y + 58);
        c.textAlign = 'right'; c.fillStyle = '#f1dcc4'; c.font = `22px ${SANS}`; c.fillText(r.line, W - 72, y + 44);
        y += 74;
    }

    c.restore();
    return y;
    };
    // first pass finds how tall the content is; second pass centres it in the space above the footer
    const used = paint(0); c.clearRect(0, PH, W, footTop - PH);
    c.fillStyle = '#43281d'; c.fillRect(0, PH, W, footTop - PH); c.fillStyle = rg; c.fillRect(0, PH, W, footTop - PH);
    const spare = footTop - 6 - used; paint(Math.max(0, Math.min(90, Math.round(spare / 2) - 10)));

    // footer
    c.fillStyle = COL.line; c.fillRect(72, footTop, W - 144, 2);
    c.textAlign = 'left'; c.fillStyle = COL.ink; c.font = `27px ${SERIF}`; c.fillText('Indian Cricket · Beyond the Scoreboard', 72, footTop + 46);
    c.fillStyle = COL.faint; c.font = `17px ${SANS}`; c.fillText('Ball-by-ball data: Cricsheet (ODC-By 1.0)', 72, footTop + 74);
    c.textAlign = 'right'; c.fillStyle = COL.ind; c.font = `600 21px ${SANS}`; c.fillText(m.site, W - 72, footTop + 74);

    return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Could not make the picture'))), 'image/jpeg', 0.92));
}

// On phones and iPads this opens the share sheet (with "Save Image"); on a computer it downloads the file.
export async function saveCard(blob: Blob, filename: string) {
    const file = new File([blob], filename, { type: 'image/jpeg' });
    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [file] }) && window.matchMedia('(pointer: coarse)').matches) {
        try { await nav.share({ files: [file] }); return; } catch (e: any) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}
