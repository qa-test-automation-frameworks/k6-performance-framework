import { check } from 'k6';
import type { HttpResponse } from '../types';

export function checkStatus<T>(response: HttpResponse<T>, expected: number, label: string): boolean {
  return check(response.raw, { [`${label}: status ${expected}`]: () => response.status === expected });
}

export function requireData<T>(response: HttpResponse<T>, label: string): T {
  if (response.data === null) throw new Error(`${label} returned no JSON body`);
  return response.data;
}
