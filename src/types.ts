export type RelayrCommand = {
  id: string;
  robotId: string;
  robotLabel: string;
  action: string;
  streamUrl: string;
  price: number;
  payMint: string;
  userWallet: string;
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
};

export type RelayrOptions = {
  apiKey: string;
  apiUrl?: string;
  robotId?: string;
  pollIntervalMs?: number;
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
  txSignature: string | null;
  ts: number;
};

export type RelayrWebhookTestPayload = {
  type: "relayr.webhook_test";
  operatorId: string;
  ts: number;
};

export type RelayrWebhookPayload =
  | RelayrActionWebhookPayload
  | RelayrWebhookTestPayload;
