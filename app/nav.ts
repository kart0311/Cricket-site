// A tiny "go there" channel: the home search and the duel shortcuts tell the right screen what to show.
export type GoKind = 'player' | 'ground' | 'team' | 'duel';
export type GoDetail = { kind: GoKind; value: any };
export const go = (kind: GoKind, value: any) => window.dispatchEvent(new CustomEvent('crx-go', { detail: { kind, value } }));
export const onGo = (fn: (d: GoDetail) => void) => { const h = (e: Event) => fn((e as CustomEvent).detail); window.addEventListener('crx-go', h); return () => window.removeEventListener('crx-go', h); };
