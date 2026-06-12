import { vi } from 'vitest';

export const sleep = vi.fn();
export const check = vi.fn(() => true);
export const group = vi.fn((_name: string, callback: () => void) => callback());
