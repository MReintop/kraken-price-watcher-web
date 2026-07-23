import { headers } from 'next/headers';
import { UID_HEADER, ANONYMOUS_UNIT } from './unit';
import { assignVariant, type Experiment, type VariantOf } from './assign';
import { createExposureLogger } from './exposure';
import { serverSink } from './eventLog';
import { statsigVariant } from './statsig';

// One logger for the server process, writing wherever the env points
const logExposure = createExposureLogger(serverSink());

// The header only, never the cookie: the proxy rewrites it from a validated
// cookie or a fresh id on every matched request, so it is the one form of this
// value a caller cannot choose. A request that reached here without the proxy
// having run has no assignment to read.
export async function getUnitId(): Promise<string> {
  const requestHeaders = await headers();
  return requestHeaders.get(UID_HEADER) ?? ANONYMOUS_UNIT;
}

// Assign on the server AND record the exposure here — the server is where the
// decision happens, so it's the honest place to say "this user saw this variant."
//
// When Statsig is configured IT assigns (and logs its own exposure for Pulse);
// the local hash is the fallback for an unset key, their outage, or a variant
// the registry does not recognize. Either way OUR sink records the variant
// actually served, so the self-built readout keeps working alongside theirs —
// two analyses over one truth, which is the whole point of the comparison.
export async function serverVariant<E extends Experiment>(
  exp: E,
): Promise<VariantOf<E>> {
  const unitId = await getUnitId();
  const variant =
    (await statsigVariant(unitId, exp)) ?? assignVariant(unitId, exp);
  logExposure(exp.key, variant, unitId);
  return variant;
}
