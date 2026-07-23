// The pipeline's null-experiment check. Seeds visitors through the real
// assignment path — each GET is assigned and exposed on the server, every
// third visitor taps under the cookie it was handed — so the true effect is
// zero by construction. A readout over these events that finds a significant
// lift has found a bug in the pipeline, not a result.
//
//   npm run build && EXPERIMENT_EVENTS_FILE=.events/events.jsonl npx next start
//   node scripts/seed-null-experiment.mjs [visitors] [baseUrl]

const visitors = Number(process.argv[2] ?? 120);
const base = process.argv[3] ?? 'http://localhost:3000';

const cookieOf = (res) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('kpw_uid='));

let taps = 0;
for (let i = 1; i <= visitors; i++) {
  const res = await fetch(base, { headers: { accept: 'text/html' } });
  await res.text();
  const cookie = cookieOf(res);
  if (!cookie) {
    console.error(`visitor ${i}: no kpw_uid cookie on the response`);
    process.exit(1);
  }

  if (i % 3 === 0) {
    const tap = await fetch(`${base}/api/outcomes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'coin_tap' }),
    });
    if (tap.status !== 204) {
      console.error(`visitor ${i}: outcome answered ${tap.status}`);
      process.exit(1);
    }
    taps++;
  }
}

console.log(`${visitors} visitors, ${taps} taps`);
