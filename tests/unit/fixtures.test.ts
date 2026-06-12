import { describe, expect, it } from 'vitest';
import { articleFixture, userFixture } from '../../src/fixtures';

describe('data fixtures', () => {
  it('creates unique users and articles without embedded secrets', () => {
    const firstUser = userFixture();
    const secondUser = userFixture();
    const firstArticle = articleFixture();
    const secondArticle = articleFixture();

    expect(firstUser.email).not.toBe(secondUser.email);
    expect(firstArticle.title).not.toBe(secondArticle.title);
    expect(firstUser.email.endsWith('@example.test')).toBe(true);
  });
});
