import { describe, expect, it } from 'vitest';
import { articleFixture, browseBehavior, userFixture } from '../../src/fixtures';

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

  it('selects weighted browse behaviors deterministically', () => {
    expect(browseBehavior(0).name).toBe('quick-reader');
    expect(browseBehavior(50).name).toBe('article-reader');
    expect(browseBehavior(85).name).toBe('deep-reader');
  });
});
