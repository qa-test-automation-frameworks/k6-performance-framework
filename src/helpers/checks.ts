import { check } from 'k6';
import type { HttpResponse } from '../types';

/**
 * Records a named k6 status check.
 * @param response Typed HTTP response.
 * @param expected Expected HTTP status.
 * @param label Human-readable operation label.
 * @returns Whether the response matched the expected status.
 */
export function checkStatus<T>(
  response: HttpResponse<T>,
  expected: number,
  label: string,
): boolean {
  return check(response.raw, {
    [`${label}: status ${expected}`]: () => response.status === expected,
  });
}

/**
 * Returns the parsed response body.
 * @param response Typed HTTP response.
 * @param label Human-readable operation label.
 * @returns The parsed response body.
 * @throws When the response has no JSON body.
 */
export function requireData<T>(response: HttpResponse<T>, label: string): T {
  if (response.data === null) throw new Error(`${label} returned no JSON body`);
  return response.data;
}
