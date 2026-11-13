/**
 * The third external check as the demo shows it (src/data/aexCheck.ts, read from simulation/external_validation_aex*.json).
 * The expected values are the ones README Section 3.8.4 reports. If a regenerated JSON changes them, update the README,
 * the slides and video script, and this test together.
 */
import { describe, expect, it } from 'vitest';
import { AEX_CHECK, type AexMethod, type AexRunSummary } from '../aexCheck';

const pct1 = (x: number) => (x * 100).toFixed(1);
const span = ([a, b]: [number, number], digits: number) => `${a.toFixed(digits)}–${b.toFixed(digits)}`;
const row = (s: AexRunSummary, m: AexMethod) => {
  const c = s.methods[m].crossing;
  return `${pct1(s.methods[m].error)} ${c.early}/${c.inside}/${c.late}`;
};

describe('third external check (README 3.8.4)', () => {
  it('reads the registered verdicts from the workbook run', () => {
    const r = AEX_CHECK.registered;
    expect([r.twinLate, r.open]).toEqual([6, 6]);
    expect(r.twopointLate).toBe(4);
    expect([r.tracerLate, r.tracerScored]).toEqual([2, 2]);
    expect(r.verdicts).toEqual({ twinPasses: false, twopointIsFix: false, tracerSupported: false });
  });

  it('reads the time-corrected rerun', () => {
    const c = AEX_CHECK.corrected;
    expect([c.twinLate, c.twopointLate, c.tracerLate, c.tracerScored]).toEqual([6, 4, 2, 2]);
    expect(c.verdicts).toEqual(AEX_CHECK.registered.verdicts);
    expect(AEX_CHECK.correction.countsUnchanged).toBe(true);
    expect((AEX_CHECK.correction.maxErrorShift * 100).toFixed(2)).toBe('0.03');
    expect(span([AEX_CHECK.correction.timeError[0] * 100, AEX_CHECK.correction.timeError[1] * 100], 1)).toBe('0.4–1.5');
  });

  it('reads the repeat with the authors detailed data', () => {
    const p = AEX_CHECK.repeat;
    expect([p.twinLate, p.open]).toEqual([5, 6]);
    expect(p.twopointLate).toBe(5);
    expect([p.tracerLate, p.tracerScored]).toEqual([4, 4]);
    expect(p.verdicts).toEqual({ twinPasses: false, twopointIsFix: false, tracerSupported: false });
  });

  it('shows the README method rows at cut-off K1', () => {
    const r = AEX_CHECK.registered;
    const p = AEX_CHECK.repeat;
    expect(row(r, 'STATIC_ASYM')).toBe('4.9 0/1/5');
    expect(row(r, 'TWIN_ASYM')).toBe('7.5 0/0/6');
    expect(row(r, 'INDEPENDENT')).toBe('13.2 0/0/6');
    expect(row(r, 'MIDBED_ONLY')).toBe('30.7 5/1/0');
    expect(row(r, 'STATIC_OUTLET_ASYM')).toBe('3.7 3/2/1');
    expect(row(r, 'TWOPOINT_ASYM')).toBe('4.0 1/1/4');
    expect(row(p, 'STATIC_ASYM')).toBe('4.2 0/0/6');
    expect(row(p, 'TWIN_ASYM')).toBe('6.5 1/0/5');
    expect(row(p, 'INDEPENDENT')).toBe('12.7 0/0/6');
    expect(row(p, 'MIDBED_ONLY')).toBe('35.1 6/0/0');
    expect(row(p, 'STATIC_OUTLET_ASYM')).toBe('2.7 0/4/2');
    expect(row(p, 'TWOPOINT_ASYM')).toBe('4.3 1/0/5');
  });

  it('shows the README depth-spreading and replicate-scatter ranges', () => {
    const r = AEX_CHECK.registered;
    const p = AEX_CHECK.repeat;
    expect(span(r.e8.r50, 2)).toBe('1.04–1.18');
    expect(span(r.e8.slope, 2)).toBe('0.56–0.90');
    expect(span(p.e8.r50, 2)).toBe('1.07–1.18');
    expect(span(p.e8.slope, 2)).toBe('0.55–0.95');
    expect(span([r.scatter.min * 100, r.scatter.max * 100], 1)).toBe('1.3–8.4');
    expect(span([p.scatter.min * 100, p.scatter.max * 100], 1)).toBe('0.2–4.2');
    expect(pct1(p.scatter.mean)).toBe('1.7');
  });

  it('describes the setup and registration', () => {
    expect(AEX_CHECK.trainPairs).toBe(4);
    expect(AEX_CHECK.months.map(Math.round)).toEqual([9, 14]);
    expect(AEX_CHECK.commits).toEqual({
      registration: '81c12c8',
      amendmentA1: '3f734ea',
      amendmentA2: '1e0632f',
      amendmentA3: '9c29860',
    });
  });
});
