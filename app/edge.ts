// "Who has the edge" model. Plain arithmetic, no hidden weights: every number the page shows can be rebuilt from the
// columns next to it. Pure functions (no React) so they can be tested on their own.

/** A typical Test wicket falls about once every 60 balls. Used as the neutral baseline. */
export const RL = 1 / 60;
const M_PAIR = 90;     // head-to-head balls that count as much as the career-based expectation
const M_CAREER = 600;  // balls of career record needed before a player's own rate is trusted over the baseline
const K_GROUND = 300;  // balls at a ground that count as much as the career rate
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export type BatRec = { tests: number; inns: number; runs: number; balls: number; outs: number; cred: number };
export type BowlRec = { tests: number; inns: number; balls: number; runs: number; wkts: number };
export type PairRec = { balls: number; runs: number; dots: number; outs: number; tests: number; last: string };

export type Inputs = {
    pair?: PairRec;                                  // all Tests, all grounds
    groundPair?: { balls: number; runs: number; outs: number };
    bowlCareer?: BowlRec; batCareer?: BatRec;
    bowlGround?: BowlRec; batGround?: BatRec;
};

export type Label = 'Strong edge' | 'Edge' | 'Even' | 'Batter ahead';
export type Confidence = 'Solid' | 'Some' | 'Thin' | 'Projected';
export type Edge = {
    p: number; ballsPerWkt: number; baseBalls: number; ratio: number; label: Label; conf: Confidence;
    balls: number; outs: number; runs: number; tests: number; last: string; sr: number | null; avg: number | null;
    groundNote: string | null; fa: number; fb: number;
};

/** Career dismissal rate for a bowler (wickets per legal ball), pulled toward the baseline when the record is short. */
export function bowlerRate(b?: BowlRec): number | null {
    if (!b || b.balls <= 0) return null;
    return (b.wkts + M_CAREER * RL) / (b.balls + M_CAREER);
}
/** Career rate at which a batter loses his wicket to a bowler (run outs excluded), pulled toward the baseline. */
export function batterRate(b?: BatRec): number | null {
    if (!b || b.balls <= 0) return null;
    return (b.cred + M_CAREER * RL) / (b.balls + M_CAREER);
}

export function pairEdge(x: Inputs): Edge | null {
    const rb = bowlerRate(x.bowlCareer); const ra = batterRate(x.batCareer);
    const B = x.pair?.balls ?? 0; const O = x.pair?.outs ?? 0;
    if (B === 0 && O === 0 && rb === null && ra === null) return null;

    // 1. What career records alone suggest: a good bowler against a hard-to-dismiss batter lands near the middle.
    const p0 = clamp(((rb ?? RL) * (ra ?? RL)) / RL, RL / 4, RL * 4);
    // 2. Pull that towards what actually happened between the two.
    const p1 = (O + M_PAIR * p0) / (B + M_PAIR);
    // 3. Nudge for form at this ground: each side's rate here against his own career rate, shrunk, capped at +/-40%.
    let fb = 1; let fa = 1;
    if (x.bowlGround && rb && x.bowlGround.balls > 0) fb = clamp(((x.bowlGround.wkts + K_GROUND * rb) / (x.bowlGround.balls + K_GROUND)) / rb, 0.7, 1.4);
    if (x.batGround && ra && x.batGround.balls > 0) fa = clamp(((x.batGround.cred + K_GROUND * ra) / (x.batGround.balls + K_GROUND)) / ra, 0.7, 1.4);
    const p = p1 * Math.sqrt(fa * fb);
    // Judged against how often THIS batter normally gets out, so a tail-ender does not make every bowler look dangerous.
    const base = ra ?? RL;
    const ratio = p / base;
    const label: Label = ratio >= 1.6 ? 'Strong edge' : ratio >= 1.2 ? 'Edge' : ratio > 0.85 ? 'Even' : 'Batter ahead';
    const conf: Confidence = B >= 150 ? 'Solid' : B >= 60 ? 'Some' : B > 0 ? 'Thin' : 'Projected';
    const g = x.groundPair;
    return {
        p, ballsPerWkt: 1 / p, baseBalls: 1 / base, ratio, label, conf, balls: B, outs: O, runs: x.pair?.runs ?? 0, tests: x.pair?.tests ?? 0, last: x.pair?.last ?? '',
        sr: B > 0 ? ((x.pair!.runs / B) * 100) : null, avg: O > 0 ? x.pair!.runs / O : null,
        groundNote: g && g.balls > 0 ? `${g.outs} out${g.outs === 1 ? '' : 's'} in ${g.balls} balls here` : null,
        fa, fb,
    };
}

export const fmt1 = (n: number) => (Math.round(n * 10) / 10).toString();
