import { SharedArray } from 'k6/data';
import source from './browse-behaviors.json';

export interface BrowseBehavior {
  name: string;
  weight: number;
  articleLimit: number;
  inspectArticle: boolean;
}

const behaviors = new SharedArray<BrowseBehavior>('browse behaviors', () =>
  source.map((behavior) => ({ ...behavior })),
);

export function browseBehavior(iteration = __ITER): BrowseBehavior {
  const totalWeight = behaviors.reduce((sum, behavior) => sum + behavior.weight, 0);
  let selection = iteration % totalWeight;
  for (const behavior of behaviors) {
    if (selection < behavior.weight) return behavior;
    selection -= behavior.weight;
  }
  const fallback = behaviors[0];
  if (!fallback) throw new Error('At least one browse behavior is required');
  return fallback;
}
