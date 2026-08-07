import assert from "node:assert/strict";
import {
  ApiResponseError,
  readApiResponse,
} from "../src/lib/http/api-response";
import {
  canInlineAudio,
  dataUrlByteSize,
  totalFrameBytes,
} from "../src/lib/creative-request-budget";

async function run() {
  const success = await readApiResponse<{ ok: boolean }>(
    Response.json({ ok: true }),
    "fallback",
  );
  assert.equal(success.ok, true);

  await assert.rejects(
    () =>
      readApiResponse(
        new Response("Request Entity Too Large", { status: 413 }),
        "No se pudo analizar el creativo.",
      ),
    (error: unknown) =>
      error instanceof ApiResponseError &&
      error.status === 413 &&
      !error.message.includes("Unexpected token"),
  );

  await assert.rejects(
    () =>
      readApiResponse(
        Response.json({ error: "Mensaje útil", code: "useful" }, { status: 409 }),
        "fallback",
      ),
    (error: unknown) =>
      error instanceof ApiResponseError &&
      error.message === "Mensaje útil" &&
      error.code === "useful",
  );

  const oneByte = "data:image/jpeg;base64,YQ==";
  assert.equal(dataUrlByteSize(oneByte), 1);
  assert.equal(totalFrameBytes([{ image: oneByte, timestamp: 0 }, oneByte]), 2);
  assert.equal(canInlineAudio(1_500_000, 1_000_000), true);
  assert.equal(canInlineAudio(2_500_000, 1_000_000), false);

  console.log("client resilience checks passed");
}

void run();
