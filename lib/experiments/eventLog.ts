import { appendFileSync } from 'node:fs';
import { type EventSink, consoleSink } from './events';

// Server-only (imports node:fs) — never re-export through index.ts, for the
// same reason server.ts is kept out of the barrel.

// One JSON object per line, appended: the file is the event log, and the
// readout replays it. Sync on purpose — an exposure that only maybe got
// written is worse than a slow one, and this sink is a dev/demo stand-in for
// a real pipeline, not the pipeline.
export function fileSink(path: string): EventSink {
  return (event) => {
    appendFileSync(path, JSON.stringify(event) + '\n');
  };
}

// The server's one sink, chosen by env at startup: point
// EXPERIMENT_EVENTS_FILE at a path to collect a readable log, leave it unset
// to keep the console behaviour every test already knows.
export function serverSink(): EventSink {
  const path = process.env.EXPERIMENT_EVENTS_FILE;
  return path ? fileSink(path) : consoleSink;
}
