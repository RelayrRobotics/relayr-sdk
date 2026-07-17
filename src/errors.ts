export class RelayrError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "RelayrError";
    this.status = status;
    this.body = body;
  }
}

export async function relayrErrorFromResponse(
  label: string,
  response: Response,
): Promise<RelayrError> {
  const body = await response.text();
  return new RelayrError(
    `${label} failed (${response.status}): ${body}`,
    response.status,
    body,
  );
}
