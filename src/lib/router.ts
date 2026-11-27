import { writable } from 'svelte/store';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export type Route = 'tune' | 'method';

function normalise(pathname: string): Route {
  const withoutBase = BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const path = withoutBase.replace(/\/+$/, '') || '/';
  return path === '/method' ? 'method' : 'tune';
}

function routeFromLocation(): Route {
  return normalise(window.location.pathname);
}

export const route = writable<Route>(routeFromLocation());

export function pathFor(routeValue: Route): string {
  return routeValue === 'method' ? `${BASE}/method` : `${BASE}/`;
}

export function navigate(routeValue: Route): void {
  window.history.pushState({ route: routeValue }, '', pathFor(routeValue));
  route.set(routeValue);
}

export function startRouter(): () => void {
  const onPopState = () => route.set(routeFromLocation());
  window.addEventListener('popstate', onPopState);
  route.set(routeFromLocation());
  return () => window.removeEventListener('popstate', onPopState);
}
