/**
 * Minimal in-process circuit breaker. Each carrier gets its own instance.
 * Distributed/coordinated breakers can replace this without API churn.
 */
export interface CircuitBreakerOptions {
  /** How many consecutive failures before opening. */
  failureThreshold: number;
  /** How long to stay open before transitioning to half-open. */
  openMs: number;
}

type State = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private state: State = "closed";
  private failures = 0;
  private openedAt = 0;

  constructor(private readonly opts: CircuitBreakerOptions) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.openedAt >= this.opts.openMs) {
        this.state = "half_open";
      } else {
        throw new Error("circuit_open");
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.failures >= this.opts.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  get currentState(): State {
    return this.state;
  }
}
