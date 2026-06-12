export class SharedArray<T> extends Array<T> {
  constructor(_name: string, factory: () => T[]) {
    super(...factory());
  }
}
