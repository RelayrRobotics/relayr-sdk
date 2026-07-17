import { RelayrError, relayrErrorFromResponse } from "./errors.js";
import type {
  RelayrCommand,
  RelayrCommandHandler,
  RelayrCompleteInput,
  RelayrCompleteResult,
  RelayrListenOptions,
  RelayrListener,
  RelayrOptions,
} from "./types.js";

const DEFAULT_API_URL = "https://api.relayr.tech";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      },
      { once: true },
    );
  });
}

export class Relayr {
  readonly apiKey: string;
  readonly apiUrl: string;
  readonly robotId?: string;
  readonly pollIntervalMs: number;

  constructor(options: RelayrOptions) {
    if (!options.apiKey?.startsWith("rl_")) {
      throw new Error("Relayr apiKey must start with rl_");
    }
    this.apiKey = options.apiKey;
    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "");
    this.robotId = options.robotId;
    this.pollIntervalMs = options.pollIntervalMs ?? 2_000;
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async verify(): Promise<{ ok: true; apiUrl: string }> {
    const health = await fetch(`${this.apiUrl}/health`);
    if (!health.ok) {
      throw await relayrErrorFromResponse("Relayr health check", health);
    }

    await this.listCommands();
    return { ok: true, apiUrl: this.apiUrl };
  }

  async listCommands(): Promise<RelayrCommand[]> {
    const params = new URLSearchParams();
    if (this.robotId) params.set("robotId", this.robotId);

    const url = `${this.apiUrl}/sdk/v1/commands${params.size ? `?${params}` : ""}`;
    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw await relayrErrorFromResponse("Relayr listCommands", response);
    }

    const data = (await response.json()) as { commands: RelayrCommand[] };
    return data.commands;
  }

  async complete(
    commandId: string,
    input: RelayrCompleteInput = {},
  ): Promise<RelayrCompleteResult> {
    const response = await fetch(
      `${this.apiUrl}/sdk/v1/actions/${commandId}/complete`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(input),
      },
    );

    if (!response.ok) {
      throw await relayrErrorFromResponse("Relayr complete", response);
    }

    return (await response.json()) as RelayrCompleteResult;
  }

  listen(
    handler: RelayrCommandHandler,
    options: RelayrListenOptions = {},
  ): RelayrListener {
    const controller = new AbortController();

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
    }

    const done = this.runListenLoop(handler, {
      ...options,
      signal: controller.signal,
    });

    return {
      stop: () => controller.abort(),
      done,
    };
  }

  private async runListenLoop(
    handler: RelayrCommandHandler,
    options: RelayrListenOptions & { signal: AbortSignal },
  ): Promise<void> {
    const seen = new Set<string>();
    const maxRetries = options.maxRetries ?? 8;
    const retryBaseMs = options.retryBaseMs ?? 1_000;
    let consecutiveFailures = 0;

    while (!options.signal.aborted) {
      try {
        const commands = await this.listCommands();
        consecutiveFailures = 0;

        for (const command of commands) {
          if (options.signal.aborted) return;
          if (seen.has(command.id)) continue;
          seen.add(command.id);

          try {
            const result = await handler(command);
            await this.complete(command.id, result ?? { outcome: "success" });
          } catch (error) {
            options.onError?.(error, "handler");
          }
        }

        await sleep(this.pollIntervalMs, options.signal);
      } catch (error) {
        if (options.signal.aborted || (error instanceof Error && error.message === "Aborted")) {
          return;
        }

        consecutiveFailures += 1;
        options.onError?.(error, "poll");

        if (consecutiveFailures > maxRetries) {
          throw error instanceof RelayrError
            ? error
            : new Error(
                `Relayr listen failed after ${maxRetries} retries: ${String(error)}`,
              );
        }

        const backoffMs = Math.min(
          retryBaseMs * 2 ** (consecutiveFailures - 1),
          30_000,
        );
        try {
          await sleep(backoffMs, options.signal);
        } catch {
          return;
        }
      }
    }
  }
}
