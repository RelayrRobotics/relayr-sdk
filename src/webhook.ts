import type { Relayr } from "./client.js";
import type {
  RelayrActionWebhookPayload,
  RelayrCommandHandler,
  RelayrWebhookPayload,
  RelayrWebhookTestPayload,
} from "./types.js";

export function isActionWebhookPayload(
  payload: RelayrWebhookPayload,
): payload is RelayrActionWebhookPayload {
  return payload.type === "relayr.action_started";
}

export function isWebhookTestPayload(
  payload: RelayrWebhookPayload,
): payload is RelayrWebhookTestPayload {
  return payload.type === "relayr.webhook_test";
}

export function parseWebhookPayload(body: unknown): RelayrWebhookPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Webhook body must be a JSON object");
  }

  const payload = body as Record<string, unknown>;
  const type = payload.type;

  if (type === "relayr.webhook_test") {
    if (typeof payload.operatorId !== "string" || typeof payload.ts !== "number") {
      throw new Error("Invalid relayr.webhook_test payload");
    }
    return {
      type: "relayr.webhook_test",
      operatorId: payload.operatorId,
      ts: payload.ts,
    };
  }

  if (type !== "relayr.action_started") {
    throw new Error(`Unsupported webhook type: ${String(type)}`);
  }

  const required = [
    "paidActionId",
    "robotId",
    "action",
    "streamUrl",
    "price",
    "payMint",
    "userWallet",
    "ts",
  ] as const;

  for (const key of required) {
    if (payload[key] === undefined || payload[key] === null) {
      throw new Error(`Missing webhook field: ${key}`);
    }
  }

  if (typeof payload.price !== "number" || typeof payload.ts !== "number") {
    throw new Error("Invalid webhook numeric fields");
  }

  return {
    type: "relayr.action_started",
    paidActionId: String(payload.paidActionId),
    robotId: String(payload.robotId),
    action: String(payload.action),
    streamUrl: String(payload.streamUrl),
    price: payload.price,
    payMint: String(payload.payMint),
    userWallet: String(payload.userWallet),
    txSignature:
      payload.txSignature === null || typeof payload.txSignature === "string"
        ? payload.txSignature
        : null,
    ts: payload.ts,
  };
}

export function actionWebhookToCommand(
  payload: RelayrActionWebhookPayload,
): {
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
} {
  return {
    id: payload.paidActionId,
    robotId: payload.robotId,
    robotLabel: payload.robotId,
    action: payload.action,
    streamUrl: payload.streamUrl,
    price: payload.price,
    payMint: payload.payMint,
    userWallet: payload.userWallet,
    txSignature: payload.txSignature,
    status: "settling",
    createdAt: new Date(payload.ts * 1000).toISOString(),
  };
}

export type RelayrWebhookHandlerOptions = {
  onTest?: (payload: RelayrWebhookTestPayload) => void | Promise<void>;
  onInvalid?: (error: unknown) => void | Promise<void>;
};

export function createWebhookHandler(
  relayr: Relayr,
  handler: RelayrCommandHandler,
  options: RelayrWebhookHandlerOptions = {},
) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let payload: RelayrWebhookPayload;
    try {
      payload = parseWebhookPayload(await req.json());
    } catch (error) {
      await options.onInvalid?.(error);
      return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    if (isWebhookTestPayload(payload)) {
      await options.onTest?.(payload);
      return Response.json({ ok: true, type: payload.type });
    }

    const command = actionWebhookToCommand(payload);
    try {
      const result = await handler(command);
      const completion = await relayr.complete(command.id, result ?? { outcome: "success" });
      return Response.json({ ok: true, completion });
    } catch (error) {
      await options.onInvalid?.(error);
      return Response.json({ error: "Webhook handler failed" }, { status: 500 });
    }
  };
}
