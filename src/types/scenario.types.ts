import type { Options } from 'k6/options';

export type ScenarioOptions = NonNullable<Options['scenarios']>[string];

export interface UserJourney<TContext = void> {
  name: string;
  execute(context: TContext): void;
}

export interface ScenarioDefinition<TContext = void> {
  options: ScenarioOptions;
  journey: UserJourney<TContext>;
}
