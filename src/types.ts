export type RelayrCommand = {
  id: string;
  robotId: string;
  robotLabel: string;
  action: string;
  streamUrl: string;
  price: number;
  payMint: string;
  userWallet: string;
  /**
   * On-chain USDG payment tx hash on Robinhood Chain (Settlement Splitter).
   * Usually present once a paid command is delivered. May be `null` only on
   * rare pending/legacy paths.
   */
  txSignature: string | null;
  status: string;
  createdAt: string;
};

export type RelayrCompleteInput = {
  outcome?: "success" | "fail";
  clipUrl?: string;
  videoHash?: string;
};

export type RelayrCompleteResult = {
  ok: boolean;
  paidActionId: string;
  status: string;
  clipUrl: string | null;
  videoHash: string | null;
  /** True when the action was already settled (idempotent retry). */
  alreadySettled?: boolean;
};

export type RelayrOptions = {
  apiKey: string;
  apiUrl?: string;
  robotId?: string;
  /**
   * Poll interval for `listen()`. Default 2000ms.
   * Very low values increase API load; prefer webhooks for production.
   */
  pollIntervalMs?: number;
  /**
   * HMAC secret (`whsec_…`) for verifying inbound webhooks.
   * Prefer Settings → reveal webhook secret, or `RELAYR_WEBHOOK_SECRET`.
   */
  webhookSecret?: string;
};

export type RelayrListenOptions = {
  signal?: AbortSignal;
  onError?: (error: unknown, context: "poll" | "handler" | "complete") => void;
  maxRetries?: number;
  retryBaseMs?: number;
};

export type RelayrListener = {
  stop: () => void;
  done: Promise<void>;
};

export type RelayrCommandHandler = (
  command: RelayrCommand,
) => Promise<RelayrCompleteInput | void>;

export type RelayrActionWebhookPayload = {
  type: "relayr.action_started";
  paidActionId: string;
  robotId: string;
  action: string;
  streamUrl: string;
  price: number;
  payMint: string;
  userWallet: string;
  /** Settlement Splitter pay tx (or null on rare pending paths). */
  txSignature: string | null;
  status?: string;
  ts: number;
};

export type RelayrLifecycleWebhookPayload = {
  type:
    | "relayr.action_completed"
    | "relayr.action_failed"
    | "relayr.action_settled";
  paidActionId: string;
  status: string;
  outcome: string;
  txSignature: string | null;
  clipUrl: string | null;
  videoHash: string | null;
  explorerUrl: string | null;
  settlement: {
    gross: number;
    operatorAmount: number;
    stakersAmount: number;
    treasuryAmount: number;
    burnAmount: number;
    paidOnChain: boolean;
  } | null;
  ts: number;
};

export type RelayrWebhookTestPayload = {
  type: "relayr.webhook_test";
  operatorId: string;
  ts: number;
};

export type RelayrWebhookPayload =
  | RelayrActionWebhookPayload
  | RelayrLifecycleWebhookPayload
  | RelayrWebhookTestPayload;
