import sharp from "sharp";
import { buildTextOverlaySvg, composeStaticCreative } from "../src/lib/ai/static-composer";
import { normalizeStaticBrief } from "../src/lib/ai/static-machine";

const width = 1080;
const height = 1350;
const outputPath = "/tmp/compose-test.png";

async function main() {
  const background = Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8e6df"/><stop offset="1" stop-color="#e7bfd1"/></linearGradient></defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="760" cy="480" r="250" fill="#fff8f2" fill-opacity=".72"/>
  <rect x="630" y="280" width="260" height="430" rx="90" fill="#fff" fill-opacity=".84"/>
</svg>`);
  const base = await sharp(background).png().toBuffer();

  const bakedFicha = normalizeStaticBrief({
    texto_principal: "Áéíóú ñ: piel más uniforme",
    texto_secundario: "Textura ligera para tu rutina diaria",
    cta: "Compra ahora",
    cta_usage: "button",
    disclaimer: "Resultados pueden variar · Información publicitaria",
    text_render_mode: "layered",
    logo_usage: "none",
    paleta: ["#E42278", "#FFE8F2", "#FDF6F1"],
  });
  if (bakedFicha.text_render_mode !== "baked") {
    throw new Error("La generación normal volvió a activar una capa de texto automática.");
  }
  const cleanResult = await composeStaticCreative({ base, ficha: bakedFicha });
  if (!cleanResult.buffer.equals(base) || cleanResult.verification.expectedRegions !== 0) {
    throw new Error("El modo baked modificó la imagen final o añadió una superposición.");
  }

  const ficha = { ...bakedFicha, text_render_mode: "layered" as const };

  const overlay = buildTextOverlaySvg(width, height, ficha);
  const svgMarkup = overlay.fullSvg?.toString("utf8") || "";
  if (/<text(?:\s|>)/i.test(svgMarkup) || /font-family/i.test(svgMarkup)) {
    throw new Error("La capa SVG volvió a depender de nodos tipográficos o fuentes del sistema.");
  }

  const result = await composeStaticCreative({ base, ficha });
  if (!result.verification.passed || result.verification.expectedRegions !== 4) {
    throw new Error(`Falló la verificación de contraste: ${JSON.stringify(result.verification)}`);
  }
  await sharp(result.buffer).png().toFile(outputPath);

  const withoutOptionalCopy = {
    ...ficha,
    cta: "",
    cta_usage: "none",
    disclaimer: "",
  } as const;
  const optionalOverlay = buildTextOverlaySvg(width, height, withoutOptionalCopy);
  const labels = optionalOverlay.regions.map((region) => region.label);
  if (labels.includes("cta") || labels.includes("disclaimer")) {
    throw new Error("Se generó una forma opcional sin CTA o disclaimer.");
  }

  const headlineOnly = {
    ...ficha,
    texto_secundario: "   ",
    cta: "   ",
    cta_usage: "button",
    disclaimer: "   ",
  } as const;
  const headlineOnlyLabels = buildTextOverlaySvg(width, height, headlineOnly).regions.map((region) => region.label);
  if (headlineOnlyLabels.join(",") !== "headline") {
    throw new Error(`Aparecieron módulos sin contenido: ${headlineOnlyLabels.join(",")}`);
  }

  for (const arquetipo of ["post_its", "anotaciones_manuscritas"]) {
    const handwrittenFicha = { ...ficha, arquetipo };
    const handwrittenResult = await composeStaticCreative({ base, ficha: handwrittenFicha });
    if (!handwrittenResult.verification.passed || handwrittenResult.verification.expectedRegions !== 4) {
      throw new Error(`Falló la composición manuscrita ${arquetipo}: ${JSON.stringify(handwrittenResult.verification)}`);
    }
  }

  console.log(`Composición verificada: ${outputPath}`);
  console.log(JSON.stringify(result.verification, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
