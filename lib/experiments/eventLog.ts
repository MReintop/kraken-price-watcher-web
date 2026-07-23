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
//
// Point it at a path you intend to keep — .events/events.jsonl in the repo is
// gitignored for exactly this. A /tmp path is an event store until the OS
// decides otherwise: the first 134 events of this experiment survive only as
// a snapshot in a note and inside Statsig, because /tmp was cleared. An
// append-only log the readout can replay is the data-ownership claim of the
// self-built half; it holds only if the file outlives the machine's mood.
export function serverSink(): EventSink {
  const path = process.env.EXPERIMENT_EVENTS_FILE;
  return path ? fileSink(path) : consoleSink;
}
