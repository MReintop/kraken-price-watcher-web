import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP_DIR = resolve('app');

// Folders the App Router does not turn into URL segments.
const isRouteGroup = (name: string) =>
  name.startsWith('(') && name.endsWith(')');
const isPrivate = (name: string) => name.startsWith('_');
const isParallelSlot = (name: string) => name.startsWith('@');
const isDynamic = (segment: string) => segment.includes('[');

// Walks app/ for page files and rebuilds the URLs they answer to, so a new route
// is covered the moment it exists rather than when someone remembers this list.
function collectRoutes(dir: string, segments: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const routes: string[] = [];

  if (entries.some((entry) => /^page\.(tsx|ts|jsx|js)$/.test(entry.name))) {
    routes.push('/' + segments.join('/'));
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const { name } = entry;
    if (isPrivate(name) || isParallelSlot(name) || name === 'api') continue;
    routes.push(
      ...collectRoutes(
        join(dir, name),
        isRouteGroup(name) ? segments : [...segments, name],
      ),
    );
  }

  return routes;
}

export const PAGE_ROUTES = collectRoutes(APP_DIR).map((route) =>
  route === '/' ? route : route.replace(/\/$/, ''),
);

// A dynamic route needs a real value before it can be visited. Adding one without
// adding a sample here fails the coverage test in a11y.spec.ts.
export const DYNAMIC_ROUTE_SAMPLES: Record<string, string> = {
  '/coins/[id]': '/coins/bitcoin',
};

export const uncoveredDynamicRoutes = () =>
  PAGE_ROUTES.filter(
    (route) => isDynamic(route) && !DYNAMIC_ROUTE_SAMPLES[route],
  );

export const visitableRoutes = () =>
  PAGE_ROUTES.map((route) => DYNAMIC_ROUTE_SAMPLES[route] ?? route).filter(
    (route) => !isDynamic(route),
  );
