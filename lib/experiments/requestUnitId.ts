import { NextResponse, type NextRequest } from 'next/server';
import { UID_COOKIE, UID_HEADER, UNIT_ID_SHAPE } from './unit';

// Experiments' own proxy concern: make sure the request carries a stable
// randomization unit, and that it is one we issued.
export function attachUnitId(request: NextRequest): NextResponse {
  const cookie = request.cookies.get(UID_COOKIE)?.value;
  const existing = cookie && UNIT_ID_SHAPE.test(cookie) ? cookie : null;
  const unitId = existing ?? crypto.randomUUID();

  // Set, never merged: `x-kpw-uid` is internal, so an inbound one is a caller
  // choosing their own assignment and is overwritten either way.
  //
  // It also carries a fresh id through the render that mints it — a cookie set
  // on the RESPONSE is not on the REQUEST that set it, so the RSC would find
  // nothing. The cookie takes over from request two on.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(UID_HEADER, unitId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!existing) {
    response.cookies.set(UID_COOKIE, unitId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // a year — stickiness is long-lived
      path: '/',
    });
  }
  return response;
}
