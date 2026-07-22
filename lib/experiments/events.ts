// The event contract, whole: everything the analysis will ever see is one of
// these two shapes, and `unitId` is the join key between them. Same contract
// whether the sink is a console, a file, or a managed SDK.
export interface ExposureEvent {
  kind: 'exposure';
  experiment: string;
  variant: string;
  unitId: string;
  at: number;
}

export interface OutcomeEvent {
  kind: 'outcome';
  name: string;
  unitId: string;
  at: number;
}

export type ExperimentEvent = ExposureEvent | OutcomeEvent;

export type EventSink = (event: ExperimentEvent) => void;

// The only destination that exists by default. A real one replaces it here.
export const consoleSink: EventSink = (event) => {
  console.log(`[${event.kind}]`, JSON.stringify(event));
};
