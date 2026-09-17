function primitive(record: Record<string, unknown>, key: string): string | number | undefined {
  const value = record[key];
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

export function modelErrorLogFields(error: unknown): Record<string, string | number | boolean> {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const fields: Record<string, string | number | boolean> = { failure: "upstream_model_request_failed" };
  const status = primitive(record, "status");
  const code = primitive(record, "code");
  const type = primitive(record, "type");
  const param = primitive(record, "param");
  const requestId = primitive(record, "requestID");
  if (code === "TOPIC_DRIFT") fields.failure = "model_output_grounding_failed";
  if (status !== undefined) fields.upstreamStatus = status;
  if (code !== undefined) fields.upstreamCode = code;
  if (type !== undefined) fields.upstreamType = type;
  if (param !== undefined) fields.upstreamParam = param;
  if (requestId !== undefined) fields.upstreamRequestId = requestId;
  return fields;
}
