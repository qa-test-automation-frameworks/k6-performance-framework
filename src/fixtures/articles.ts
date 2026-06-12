import type { ArticlePayload } from '../types';
import { uniqueSuffix } from '../helpers/data-factory';

export function articleFixture(): ArticlePayload {
  const suffix = uniqueSuffix();
  return {
    title: `Performance article ${suffix}`,
    description: `Generated performance fixture ${suffix}`,
    body: `Deterministic test content for run ${suffix}.`,
    tagList: ['performance', 'k6'],
  };
}
