export const CREATIVE_FRAME_BUDGET_BYTES = 1_200_000;
export const CREATIVE_REQUEST_BUDGET_BYTES = 3_400_000;
export const MAX_TRANSCRIPTION_SOURCE_BYTES = 24 * 1024 * 1024;

export function dataUrlByteSize(dataUrl: string) {
  const encoded = dataUrl.split(",", 2)[1] || "";
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
}

export function totalFrameBytes(
  frames: Array<string | { image: string; timestamp: number }>,
) {
  return frames.reduce(
    (total, frame) =>
      total + dataUrlByteSize(typeof frame === "string" ? frame : frame.image),
    0,
  );
}

export function canInlineAudio(audioBytes: number, frameBytes: number) {
  return audioBytes + frameBytes + 180_000 <= CREATIVE_REQUEST_BUDGET_BYTES;
}
