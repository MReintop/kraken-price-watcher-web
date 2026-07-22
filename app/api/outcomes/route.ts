import { type NextRequest } from 'next/server';
import {
  UID_COOKIE,
  UNIT_ID_SHAPE,
  ANONYMOUS_UNIT,
} from '@/lib/experiments/unit';
import { OUTCOME_NAMES, type OutcomeName } from '@/lib/experiments/registry';
import { serverSink } from '@/lib/experiments/eventLog';

const sink = serverSink();

// Outcome ingest. The unit id is stamped HERE, from the httpOnly cookie: the
// client posts only *what happened*, never *who it is* — so the id stays
// unreadable to page JS and nothing the client sends can choose or forge it.
// (A body-supplied unitId would be the outcome-side twin of the inbound
// x-kpw-uid header the proxy already refuses.)
export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const name = (body as { name?: unknown })?.name;
  if (!OUTCOME_NAMES.includes(name as OutcomeName)) {
    return new Response(null, { status: 400 });
  }

  // A missing or malformed cookie is still an event — logged as anonymous so
  // the readout can SEE unattributable volume (a spike of it means broken
  // instrumentation) — it just never joins to an exposure.
  const cookie = request.cookies.get(UID_COOKIE)?.value;
  const unitId = cookie && UNIT_ID_SHAPE.test(cookie) ? cookie : ANONYMOUS_UNIT;

  sink({ kind: 'outcome', name: name as OutcomeName, unitId, at: Date.now() });

  // 204 always: the response must not leak whether the unit was recognized.
  return new Response(null, { status: 204 });
}
