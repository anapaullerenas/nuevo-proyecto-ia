import fs from "node:fs";
import sharp from "sharp";

await sharp({
  create: {
    width: 2,
    height: 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .png()
  .toBuffer();

if (process.platform === "linux" && process.arch === "x64") {
  const traces = [
    ".next/server/app/api/static-generate/route.js.nft.json",
    ".next/server/app/api/static-reference-analysis/route.js.nft.json",
  ];
  for (const tracePath of traces) {
    const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
    const files = trace.files || [];
    if (
      !files.some((file) => file.includes("@img/sharp-linux-x64")) ||
      !files.some((file) => file.includes("@img/sharp-libvips-linux-x64"))
    ) {
      throw new Error(`Linux sharp runtime is missing from ${tracePath}`);
    }
  }
}

console.log("sharp runtime and deployment trace verified");
