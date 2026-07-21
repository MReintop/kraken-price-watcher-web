import { type NextRequest } from 'next/server';
import { attachUnitId } from '@/lib/experiments/requestUnitId';

// Thin dispatcher: each concern owns its logic elsewhere and is composed here.
export function proxy(request: NextRequest) {
  return attachUnitId(request);
}

// `/` is the only route that renders a variant. Every path listed here pays a
// proxy hop and hands out a tracking cookie, so the list stays as short as the
// experiments actually running — widen it when another route needs assignment.
export const config = {
  matcher: ['/'],
};
