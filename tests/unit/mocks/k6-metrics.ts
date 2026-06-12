class Metric {
  constructor(
    public readonly name: string,
    public readonly isTime = false,
  ) {}

  add(value: number | boolean, tags?: Record<string, string>): void {
    void value;
    void tags;
  }
}

export class Trend extends Metric {}
export class Counter extends Metric {}
export class Rate extends Metric {}
export class Gauge extends Metric {}
