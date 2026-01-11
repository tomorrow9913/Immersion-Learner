export class KeyedMutex {
  private operations = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.operations.get(key) || Promise.resolve();

    // 현재 작업 체이닝
    const current = previous.then(() => task()).catch((err) => {
       // 에러 전파를 위해 다시 throw
       throw err;
    });

    // Map 업데이트 (작업 완료 후에는 Map에서 제거하는 로직 포함 가능)
    const cleanup = current.then(() => undefined).finally(() => {
        if (this.operations.get(key) === cleanup) {
            this.operations.delete(key);
        }
    });

    this.operations.set(key, cleanup);

    return current;
  }
}
