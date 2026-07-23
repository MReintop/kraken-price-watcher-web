export const UID_COOKIE = 'kpw_uid';
export const UID_HEADER = 'x-kpw-uid';

// Shared by everything that decides whether a unit id is one we issued (the
// proxy, the outcomes route): an id that is not UUID-shaped never gets to
// carry an assignment or an outcome under its own name.
export const UNIT_ID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// What an event carries when the unit could not be established. Kept as a
// value the readout can recognize and count — an unattributable outcome is a
// signal (instrumentation broken, cookies cleared), not something to drop.
export const ANONYMOUS_UNIT = 'anonymous';
