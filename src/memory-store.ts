import type { EvalClient } from "./index";

/**
 * In-memory implementation of the same minimal `EvalClient` interface,
 * reproducing the sliding-window Lua script's exact semantics without a
 * Redis server. Useful for tests, local dev, or single-process deployments.
 *
 * It only understands the one script shape this library sends — it is not
 * a general Lua interpreter.
 */
export class InMemoryEvalClient implements EvalClient {
  private sets: Map<string, Map<string, number>> = new Map();

  async eval(_script: string, keys: string[], args: (string | number)[]): Promise<any> {
    const key = keys[0];
    const now = Number(args[0]);
    const window = Number(args[1]);
    const limit = Number(args[2]);
    const member = String(args[3]);

    let set = this.sets.get(key);
    if (!set) {
      set = new Map();
      this.sets.set(key, set);
    }

    for (const [m, score] of set) {
      if (score < now - window) set.delete(m);
    }

    const count = set.size;

    if (count < limit) {
      set.set(member, now);
      return [1, count + 1, 0];
    }

    let oldestScore: number | undefined;
    for (const score of set.values()) {
      if (oldestScore === undefined || score < oldestScore) oldestScore = score;
    }
    const retryAfter = oldestScore !== undefined ? Math.max(0, oldestScore + window - now) : window;
    return [0, count, retryAfter];
  }

  /** Test/debug helper: clear all state. */
  reset(): void {
    this.sets.clear();
  }
}
