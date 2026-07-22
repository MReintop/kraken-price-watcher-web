// The self-built half of the analysis: replay the event log and print the
// verdict. Runs on plain `node` (type stripping), no build step:
//
//   EXPERIMENT_EVENTS_FILE=events.jsonl npm run dev   # collect
//   npm run readout [-- events.jsonl]                 # analyse
import { readFileSync } from 'node:fs';
import { computeReadout } from '../lib/experiments/readout.ts';
import { CHANGE_PILL_STYLE } from '../lib/experiments/registry.ts';
import type { ExperimentEvent } from '../lib/experiments/events.ts';

const path = process.argv[2] ?? process.env.EXPERIMENT_EVENTS_FILE;
if (!path) {
  console.error(
    'usage: npm run readout -- <events.jsonl>  (or set EXPERIMENT_EVENTS_FILE)',
  );
  process.exit(2);
}

let raw: string;
try {
  raw = readFileSync(path, 'utf8');
} catch {
  console.error(
    `readout: cannot read '${path}' — did the server run with EXPERIMENT_EVENTS_FILE pointing there?`,
  );
  process.exit(2);
}

// Tolerant line-by-line parse: a torn last line (the process died mid-append)
// must not take the whole readout down — but it is counted, never silent.
const events: ExperimentEvent[] = [];
let badLines = 0;
for (const line of raw.split('\n')) {
  if (line.trim() === '') continue;
  try {
    const parsed = JSON.parse(line);
    if (parsed.kind === 'exposure' || parsed.kind === 'outcome')
      events.push(parsed);
    else badLines++;
  } catch {
    badLines++;
  }
}

const r = computeReadout(events, CHANGE_PILL_STYLE, 'coin_tap');

const pct = (x: number) => `${(100 * x).toFixed(2)}%`;
const pp = (x: number) => `${(100 * x).toFixed(2)}pp`;

console.log(`\n${r.experiment} → ${r.outcome}   (${events.length} events)\n`);
for (const arm of r.arms) {
  console.log(
    `  ${arm.variant.padEnd(8)} ${String(arm.exposures).padStart(6)} exposed  ` +
      `${String(arm.conversions).padStart(6)} converted   ${pct(arm.rate)}`,
  );
}

console.log(
  `\n  SRM         χ² = ${r.srm.chi2.toFixed(2)}, p = ${r.srm.pValue.toExponential(2)}` +
    (r.srm.triggered ? '   *** FIRED — DO NOT READ THE LIFT ***' : '   ok'),
);
const integrity = [
  badLines && `${badLines} unparseable lines`,
  r.anonymousEvents && `${r.anonymousEvents} anonymous events`,
  r.orphanOutcomes && `${r.orphanOutcomes} orphan outcomes`,
  r.mixedAssignments && `${r.mixedAssignments} mixed assignments`,
].filter(Boolean);
if (integrity.length) console.log(`  integrity   ${integrity.join(', ')}`);

if (r.lift) {
  const { absolute, z, pValue, ci95, approximationWeak } = r.lift;
  console.log(
    `  lift        ${pp(absolute)} absolute   z = ${z.toFixed(3)}, p = ${pValue.toFixed(4)}`,
  );
  console.log(`  95% CI      ${pp(ci95[0])} … ${pp(ci95[1])}`);
  if (approximationWeak)
    console.log('  caution     a cell is under 5 — the approximation is weak');
} else {
  console.log(`  lift        withheld — ${r.withheld}`);
}
console.log();
