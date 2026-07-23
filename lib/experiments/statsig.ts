import Statsig from 'statsig-node';
import type { Experiment, VariantOf } from './assign';

// The managed half of the comparison: same experiment, same unit, but Statsig
// owns assignment, exposure logging and the stats engine. Server-only (the
// secret key lives here), and entirely absent unless STATSIG_SERVER_SECRET is
// set — the app must keep working exactly as before without it.

export function statsigEnabled(): boolean {
  return Boolean(process.env.STATSIG_SERVER_SECRET);
}

// One initialization per process, started lazily on first use so builds and
// tests without the key never touch the network.
let ready: Promise<unknown> | null = null;
function init(): Promise<unknown> {
  ready ??= Statsig.initialize(process.env.STATSIG_SERVER_SECRET!, {
    environment: {
      tier:
        process.env.NODE_ENV === 'production' ? 'production' : 'development',
    },
  });
  return ready;
}

/**
 * Ask Statsig which variant this unit gets. The experiment in their console
 * carries the registry key as its name and a `variant` parameter whose values
 * are the registry's variants — and that contract is VALIDATED here: a value
 * the registry does not know (a console typo, an unstarted experiment
 * returning defaults) comes back as null and the caller falls back to the
 * local hash. Remote config is a boundary like any other.
 */
export async function statsigVariant<E extends Experiment>(
  unitId: string,
  exp: E,
): Promise<VariantOf<E> | null> {
  if (!statsigEnabled()) return null;
  try {
    await init();
    const config = Statsig.getExperiment({ userID: unitId }, exp.key);
    const value = config.get<string>('variant', '');
    return (exp.variants as readonly string[]).includes(value)
      ? (value as VariantOf<E>)
      : null;
  } catch {
    return null; // their outage must not take assignment down
  }
}

/** Send an outcome to Statsig under the same unit the exposure used. */
export async function statsigLogOutcome(
  unitId: string,
  name: string,
): Promise<void> {
  if (!statsigEnabled()) return;
  try {
    await init();
    Statsig.logEvent({ userID: unitId }, name);
  } catch {
    // a lost metric event is noise; an ingest route taken down by it is a bug
  }
}
