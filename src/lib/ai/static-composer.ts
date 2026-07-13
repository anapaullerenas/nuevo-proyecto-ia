import sharp from "sharp";
import type { StaticBrief } from "./static-machine";
import { fontVerticalMetrics, measureText, textToPath, type PackagedFont } from "./text-paths";

export type LogoSource = { buffer: Buffer; variant: "primary" | "light" | "dark" };

export type TextContrastRegion = {
  label: "headline" | "secondary" | "cta" | "disclaimer";
  text: string;
  contrastPixels: number;
  minimumContrastPixels: number;
  passed: boolean;
};

export type TextCompositionVerification = {
  passed: boolean;
  expectedRegions: number;
  totalContrastPixels: number;
  emptyShapeCount: number;
  regions: TextContrastRegion[];
};

type TextRegionPlan = {
  label: TextContrastRegion["label"];
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
};

type OverlayPlan = {
  fullSvg: Buffer | null;
  shapesSvg: Buffer | null;
  regions: TextRegionPlan[];
};

type SvgParts = {
  shapes: string[];
  text: string[];
  regions: TextRegionPlan[];
};

export class TextCompositionError extends Error {
  verification: TextCompositionVerification;

  constructor(message: string, verification: TextCompositionVerification) {
    super(message);
    this.name = "TextCompositionError";
    this.verification = verification;
  }
}

export async function composeStaticCreative({
  base,
  ficha,
  logoSources = [],
}: {
  base: Buffer;
  ficha: StaticBrief;
  logoSources?: LogoSource[];
}) {
  if (ficha.text_render_mode !== "layered") {
    return {
      buffer: base,
      verification: {
        passed: true,
        expectedRegions: 0,
        totalContrastPixels: 0,
        emptyShapeCount: 0,
        regions: [],
      } satisfies TextCompositionVerification,
    };
  }

  const metadata = await sharp(base).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1350;
  const logoOverlays = await buildLogoOverlays(base, width, height, ficha, logoSources);
  const overlay = buildTextOverlaySvg(width, height, ficha);
  const shapeOverlays = overlay.shapesSvg ? [...logoOverlays, { input: overlay.shapesSvg }] : logoOverlays;
  const fullOverlays = overlay.fullSvg ? [...logoOverlays, { input: overlay.fullSvg }] : logoOverlays;

  const [withoutText, output] = await Promise.all([
    sharp(base).composite(shapeOverlays).png().toBuffer(),
    sharp(base).composite(fullOverlays).png().toBuffer(),
  ]);
  const verification = await verifyTextContrast(withoutText, output, overlay.regions);

  if (!verification.passed) {
    const failures = verification.regions.filter((region) => !region.passed).map((region) => region.label).join(", ");
    throw new TextCompositionError(`La capa de texto no produjo contraste verificable: ${failures || "sin trazados visibles"}.`, verification);
  }

  return { buffer: output, verification };
}

export function buildTextOverlaySvg(width: number, height: number, ficha: StaticBrief): OverlayPlan {
  const parts = ficha.arquetipo === "post_its"
    ? buildPostIts(width, height, ficha)
    : ficha.arquetipo === "anotaciones_manuscritas"
      ? buildAnnotations(width, height, ficha)
      : buildStandardCard(width, height, ficha);

  if (!parts.shapes.length && !parts.text.length) return emptyOverlayPlan();
  const defs = `<defs><filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#281423" flood-opacity=".18"/></filter></defs>`;
  const svg = (content: string) => Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${defs}${content}</svg>`);

  return {
    fullSvg: svg([...parts.shapes, ...parts.text].join("")),
    shapesSvg: svg(parts.shapes.join("")),
    regions: parts.regions,
  };
}

function emptyOverlayPlan(): OverlayPlan {
  return { fullSvg: null, shapesSvg: null, regions: [] };
}

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function paletteColor(ficha: StaticBrief) {
  return /^#[0-9a-f]{6}$/i.test(ficha.paleta[0] || "") ? ficha.paleta[0] : "#632E59";
}

function wrapText(text: string, font: PackagedFont, size: number, maxWidth: number, letterSpacing = 0) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1) || "";
    const candidate = current ? `${current} ${word}` : word;
    if (current && measureText(candidate, { font, size, letterSpacing }) > maxWidth) lines.push(word);
    else if (!current) lines.push(word);
    else lines[lines.length - 1] = candidate;
  }
  return lines;
}

function fitLines({
  text,
  font,
  initialSize,
  minimumSize,
  maxWidth,
  preferredLines,
  letterSpacing = 0,
}: {
  text: string;
  font: PackagedFont;
  initialSize: number;
  minimumSize: number;
  maxWidth: number;
  preferredLines: number;
  letterSpacing?: number;
}) {
  let size = initialSize;
  let lines = wrapText(text, font, size, maxWidth, letterSpacing);
  const exceedsWidth = () => lines.some((line) => measureText(line, { font, size, letterSpacing }) > maxWidth);
  while ((lines.length > preferredLines || exceedsWidth()) && size > minimumSize) {
    size = Math.max(minimumSize, size - 2);
    lines = wrapText(text, font, size, maxWidth, letterSpacing);
  }
  return { size, lines };
}

function renderTextLines({
  label,
  text,
  lines,
  font,
  size,
  x,
  firstBaseline,
  lineHeight,
  fill,
  letterSpacing = 0,
  stroke,
  strokeWidth,
  transform,
}: {
  label: TextRegionPlan["label"];
  text: string;
  lines: string[];
  font: PackagedFont;
  size: number;
  x: number;
  firstBaseline: number;
  lineHeight: number;
  fill: string;
  letterSpacing?: number;
  stroke?: string;
  strokeWidth?: number;
  transform?: string;
}) {
  const metrics = fontVerticalMetrics(font, size);
  const paths = lines.map((line, index) => textToPath(line, {
    font,
    size,
    x,
    y: firstBaseline + index * lineHeight,
    letterSpacing,
  })).join("");
  const maxLineWidth = Math.max(1, ...lines.map((line) => measureText(line, { font, size, letterSpacing })));
  const attributes = [
    `fill="${fill}"`,
    stroke ? `stroke="${stroke}"` : "",
    strokeWidth ? `stroke-width="${strokeWidth}"` : "",
    stroke ? "paint-order=\"stroke fill\"" : "",
    stroke ? "stroke-linejoin=\"round\"" : "",
    transform ? `transform="${transform}"` : "",
  ].filter(Boolean).join(" ");

  return {
    markup: `<g ${attributes}>${paths}</g>`,
    region: {
      label,
      text,
      left: x - (strokeWidth || 0) - 4,
      top: firstBaseline - metrics.ascender - (strokeWidth || 0) - 4,
      width: maxLineWidth + (strokeWidth || 0) * 2 + 8,
      height: Math.max(metrics.height, (lines.length - 1) * lineHeight + metrics.height) + (strokeWidth || 0) * 2 + 8,
      fontSize: size,
    } satisfies TextRegionPlan,
  };
}

function buildStandardCard(width: number, height: number, ficha: StaticBrief): SvgParts {
  const headline = clean(ficha.texto_principal);
  const secondary = clean(ficha.texto_secundario);
  const cta = ficha.cta_usage === "none" ? "" : clean(ficha.cta);
  const disclaimer = clean(ficha.disclaimer);
  const parts: SvgParts = { shapes: [], text: [], regions: [] };
  if (!headline && !secondary && !cta && !disclaimer) return parts;

  const margin = Math.round(width * .07);
  const maxBoxWidth = width - margin * 2;
  const paddingX = Math.round(width * .042);
  const paddingY = Math.round(width * .028);
  const maxContentWidth = maxBoxWidth - paddingX * 2;
  const sectionGap = Math.round(width * .013);
  const palette = paletteColor(ficha);
  const headlineFit = fitLines({ text: headline, font: "spaceGroteskBold", initialSize: Math.round(width * .052), minimumSize: Math.round(width * .038), maxWidth: maxContentWidth, preferredLines: 2, letterSpacing: -Math.max(0, width * .00055) });
  const secondaryFit = fitLines({ text: secondary, font: "dmSansRegular", initialSize: Math.round(width * .027), minimumSize: Math.round(width * .021), maxWidth: maxContentWidth, preferredLines: 2 });
  const disclaimerFit = fitLines({ text: disclaimer, font: "dmSansRegular", initialSize: Math.max(15, Math.round(width * .016)), minimumSize: Math.max(13, Math.round(width * .013)), maxWidth: maxContentWidth, preferredLines: 2 });
  const headlineLineHeight = headlineFit.size * 1.08;
  const secondaryLineHeight = secondaryFit.size * 1.24;
  const disclaimerLineHeight = disclaimerFit.size * 1.2;
  const ctaSize = Math.max(20, Math.round(width * .026));
  const ctaTextWidth = cta ? measureText(cta, { font: "dmSansBold", size: ctaSize }) : 0;
  const ctaPaddingX = Math.round(ctaSize * .9);
  const ctaHeight = cta ? Math.round(ctaSize * (ficha.cta_usage === "button" ? 1.85 : 1.25)) : 0;
  const measuredContentWidth = Math.max(
    0,
    ...headlineFit.lines.map((line) => measureText(line, { font: "spaceGroteskBold", size: headlineFit.size, letterSpacing: -Math.max(0, width * .00055) })),
    ...secondaryFit.lines.map((line) => measureText(line, { font: "dmSansRegular", size: secondaryFit.size })),
    ...disclaimerFit.lines.map((line) => measureText(line, { font: "dmSansRegular", size: disclaimerFit.size })),
    cta ? ctaTextWidth + ctaPaddingX * 2 : 0,
  );
  const boxWidth = Math.min(maxBoxWidth, Math.max(Math.round(width * .34), Math.ceil(measuredContentWidth + paddingX * 2)));
  const contentWidth = boxWidth - paddingX * 2;

  const sections = [
    headline ? headlineFit.lines.length * headlineLineHeight : 0,
    secondary ? secondaryFit.lines.length * secondaryLineHeight : 0,
    cta ? ctaHeight : 0,
    disclaimer ? disclaimerFit.lines.length * disclaimerLineHeight : 0,
  ].filter((section) => section > 0);
  const boxHeight = Math.ceil(paddingY * 2 + sections.reduce((sum, section) => sum + section, 0) + Math.max(0, sections.length - 1) * sectionGap);
  const boxY = Math.round(height - margin - boxHeight);
  const textX = margin + paddingX;
  let cursor = boxY + paddingY;

  parts.shapes.push(`<rect x="${margin}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="${Math.round(width * .025)}" fill="${palette}" fill-opacity=".94"/>`);

  if (headline) {
    const metrics = fontVerticalMetrics("spaceGroteskBold", headlineFit.size);
    const rendered = renderTextLines({ label: "headline", text: headline, lines: headlineFit.lines, font: "spaceGroteskBold", size: headlineFit.size, x: textX, firstBaseline: cursor + metrics.ascender, lineHeight: headlineLineHeight, fill: "#ffffff", letterSpacing: -Math.max(0, width * .00055) });
    parts.text.push(rendered.markup);
    parts.regions.push(rendered.region);
    cursor += headlineFit.lines.length * headlineLineHeight + sectionGap;
  }

  if (secondary) {
    const metrics = fontVerticalMetrics("dmSansRegular", secondaryFit.size);
    const rendered = renderTextLines({ label: "secondary", text: secondary, lines: secondaryFit.lines, font: "dmSansRegular", size: secondaryFit.size, x: textX, firstBaseline: cursor + metrics.ascender, lineHeight: secondaryLineHeight, fill: "#ffffff" });
    parts.text.push(rendered.markup);
    parts.regions.push(rendered.region);
    cursor += secondaryFit.lines.length * secondaryLineHeight + sectionGap;
  }

  if (cta) {
    const ctaWidth = Math.min(contentWidth, Math.ceil(ctaTextWidth + ctaPaddingX * 2));
    const ctaX = margin + boxWidth - paddingX - ctaWidth;
    if (ficha.cta_usage === "button") {
      parts.shapes.push(`<rect x="${ctaX}" y="${cursor}" width="${ctaWidth}" height="${ctaHeight}" rx="${Math.round(ctaHeight / 2)}" fill="#fff6f0"/>`);
    }
    const metrics = fontVerticalMetrics("dmSansBold", ctaSize);
    const pathX = ficha.cta_usage === "button" ? ctaX + (ctaWidth - ctaTextWidth) / 2 : textX;
    const baseline = cursor + (ctaHeight - metrics.height) / 2 + metrics.ascender;
    const rendered = renderTextLines({ label: "cta", text: cta, lines: [cta], font: "dmSansBold", size: ctaSize, x: pathX, firstBaseline: baseline, lineHeight: ctaSize, fill: ficha.cta_usage === "button" ? palette : "#ffffff" });
    parts.text.push(rendered.markup);
    parts.regions.push(rendered.region);
    cursor += ctaHeight + sectionGap;
  }

  if (disclaimer) {
    const metrics = fontVerticalMetrics("dmSansRegular", disclaimerFit.size);
    const rendered = renderTextLines({ label: "disclaimer", text: disclaimer, lines: disclaimerFit.lines, font: "dmSansRegular", size: disclaimerFit.size, x: textX, firstBaseline: cursor + metrics.ascender, lineHeight: disclaimerLineHeight, fill: "#ffffff" });
    parts.text.push(rendered.markup);
    parts.regions.push(rendered.region);
  }

  return parts;
}

function buildPostIts(width: number, height: number, ficha: StaticBrief): SvgParts {
  const parts: SvgParts = { shapes: [], text: [], regions: [] };
  const margin = Math.round(width * .07);
  const headline = clean(ficha.texto_principal);
  const secondary = clean(ficha.texto_secundario);
  const cta = ficha.cta_usage === "none" ? "" : clean(ficha.cta);
  const disclaimer = clean(ficha.disclaimer);

  const addPostIt = ({
    label,
    value,
    left,
    top,
    maxWidth,
    color,
    angle,
    initialSize,
  }: {
    label: "headline" | "secondary" | "cta";
    value: string;
    left: number;
    top: number;
    maxWidth: number;
    color: string;
    angle: number;
    initialSize: number;
  }) => {
    if (!value) return;
    const paddingX = Math.round(width * .025);
    const paddingY = Math.round(width * .022);
    const fit = fitLines({ text: value, font: "caveatBold", initialSize, minimumSize: Math.round(initialSize * .72), maxWidth: maxWidth - paddingX * 2, preferredLines: 3 });
    const lineHeight = fit.size * 1.02;
    const textWidth = Math.max(...fit.lines.map((line) => measureText(line, { font: "caveatBold", size: fit.size })));
    const cardWidth = Math.min(maxWidth, Math.max(Math.round(width * .21), Math.ceil(textWidth + paddingX * 2)));
    const cardHeight = Math.ceil(paddingY * 2 + fit.lines.length * lineHeight);
    const centerX = left + cardWidth / 2;
    const centerY = top + cardHeight / 2;
    const transform = `rotate(${angle} ${centerX} ${centerY})`;
    const metrics = fontVerticalMetrics("caveatBold", fit.size);
    const rendered = renderTextLines({ label, text: value, lines: fit.lines, font: "caveatBold", size: fit.size, x: left + paddingX, firstBaseline: top + paddingY + metrics.ascender, lineHeight, fill: "#392a35", transform });
    parts.shapes.push(`<rect x="${left}" y="${top}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="${color}" filter="url(#soft-shadow)" transform="${transform}"/>`);
    parts.text.push(rendered.markup);
    parts.regions.push({ ...rendered.region, left: rendered.region.left - 14, top: rendered.region.top - 14, width: rendered.region.width + 28, height: rendered.region.height + 28 });
  };

  addPostIt({ label: "headline", value: headline, left: margin, top: Math.round(height * .12), maxWidth: Math.round(width * .44), color: "#fff1a8", angle: -3, initialSize: Math.round(width * .043) });
  addPostIt({ label: "secondary", value: secondary, left: Math.round(width * .51), top: Math.round(height * .43), maxWidth: Math.round(width * .41), color: "#f6c6df", angle: 3, initialSize: Math.round(width * .033) });
  addPostIt({ label: "cta", value: cta, left: Math.round(width * .12), top: Math.round(height * .72), maxWidth: Math.round(width * .4), color: "#dce8c8", angle: -2, initialSize: Math.round(width * .032) });

  if (disclaimer) addLegalPill(parts, width, height, disclaimer, margin);
  return parts;
}

function buildAnnotations(width: number, height: number, ficha: StaticBrief): SvgParts {
  const parts: SvgParts = { shapes: [], text: [], regions: [] };
  const margin = Math.round(width * .07);
  const headline = clean(ficha.texto_principal);
  const secondary = clean(ficha.texto_secundario);
  const cta = ficha.cta_usage === "none" ? "" : clean(ficha.cta);
  const disclaimer = clean(ficha.disclaimer);

  const addAnnotation = ({
    label,
    value,
    x,
    baseline,
    maxWidth,
    size,
    arrow,
  }: {
    label: "headline" | "secondary" | "cta";
    value: string;
    x: number;
    baseline: number;
    maxWidth: number;
    size: number;
    arrow: "down-right" | "up-left" | "right";
  }) => {
    if (!value) return;
    const fit = fitLines({ text: value, font: "caveatBold", initialSize: size, minimumSize: Math.round(size * .74), maxWidth, preferredLines: 2 });
    const lineHeight = fit.size * 1.05;
    const rendered = renderTextLines({ label, text: value, lines: fit.lines, font: "caveatBold", size: fit.size, x, firstBaseline: baseline, lineHeight, fill: "#ffffff", stroke: "rgba(30,20,28,.42)", strokeWidth: Math.max(2, Math.round(width * .003)) });
    const lineWidth = Math.max(...fit.lines.map((line) => measureText(line, { font: "caveatBold", size: fit.size })));
    const arrowStartX = arrow === "up-left" ? x - width * .018 : x + Math.min(lineWidth, maxWidth) + width * .012;
    const arrowStartY = baseline + (fit.lines.length - 1) * lineHeight - fit.size * .25;
    const dx = arrow === "up-left" ? -width * .065 : width * .065;
    const dy = arrow === "down-right" ? height * .045 : arrow === "up-left" ? -height * .04 : 0;
    const endX = arrowStartX + dx;
    const endY = arrowStartY + dy;
    const direction = dx >= 0 ? 1 : -1;
    parts.shapes.push(`<path d="M${arrowStartX.toFixed(1)} ${arrowStartY.toFixed(1)} Q${(arrowStartX + dx * .55).toFixed(1)} ${(arrowStartY + dy * .2).toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)} M${(endX - direction * width * .017).toFixed(1)} ${(endY - height * .006).toFixed(1)} L${endX.toFixed(1)} ${endY.toFixed(1)} L${(endX - direction * width * .008).toFixed(1)} ${(endY - Math.sign(dy || 1) * height * .018).toFixed(1)}" fill="none" stroke="#ffffff" stroke-width="${Math.max(3, Math.round(width * .004))}" stroke-linecap="round" stroke-linejoin="round"/>`);
    parts.text.push(rendered.markup);
    parts.regions.push(rendered.region);
  };

  addAnnotation({ label: "headline", value: headline, x: margin, baseline: Math.round(height * .18), maxWidth: width * .43, size: Math.round(width * .043), arrow: "down-right" });
  addAnnotation({ label: "secondary", value: secondary, x: Math.round(width * .49), baseline: Math.round(height * .72), maxWidth: width * .39, size: Math.round(width * .032), arrow: "up-left" });
  addAnnotation({ label: "cta", value: cta, x: Math.round(width * .12), baseline: Math.round(height * .84), maxWidth: width * .36, size: Math.round(width * .032), arrow: "right" });
  if (disclaimer) addLegalPill(parts, width, height, disclaimer, margin);
  return parts;
}

function addLegalPill(parts: SvgParts, width: number, height: number, disclaimer: string, margin: number) {
  if (!disclaimer) return;
  const font: PackagedFont = "dmSansRegular";
  const fit = fitLines({ text: disclaimer, font, initialSize: Math.max(15, Math.round(width * .016)), minimumSize: 13, maxWidth: width - margin * 2 - width * .04, preferredLines: 2 });
  const lineHeight = fit.size * 1.2;
  const paddingX = Math.round(width * .02);
  const paddingY = Math.round(width * .012);
  const textWidth = Math.max(...fit.lines.map((line) => measureText(line, { font, size: fit.size })));
  const pillWidth = Math.min(width - margin * 2, Math.ceil(textWidth + paddingX * 2));
  const pillHeight = Math.ceil(fit.lines.length * lineHeight + paddingY * 2);
  const x = margin;
  const y = height - margin - pillHeight;
  const metrics = fontVerticalMetrics(font, fit.size);
  const rendered = renderTextLines({ label: "disclaimer", text: disclaimer, lines: fit.lines, font, size: fit.size, x: x + paddingX, firstBaseline: y + paddingY + metrics.ascender, lineHeight, fill: "#ffffff" });
  parts.shapes.push(`<rect x="${x}" y="${y}" width="${pillWidth}" height="${pillHeight}" rx="${Math.round(pillHeight / 2)}" fill="#211426" fill-opacity=".78"/>`);
  parts.text.push(rendered.markup);
  parts.regions.push(rendered.region);
}

async function buildLogoOverlays(base: Buffer, width: number, height: number, ficha: StaticBrief, logoSources: LogoSource[]) {
  if (ficha.logo_usage === "none" || logoSources.length === 0) return [] as Array<{ input: Buffer; left?: number; top?: number }>;
  const margin = Math.round(width * .07);
  const sampleWidth = Math.max(1, Math.round(width * .28));
  const sampleHeight = Math.max(1, Math.round(height * .12));
  const { channels } = await sharp(base).extract({ left: width - sampleWidth, top: 0, width: sampleWidth, height: sampleHeight }).stats();
  const luminance = channels.slice(0, 3).reduce((sum, channel) => sum + channel.mean, 0) / Math.max(1, Math.min(3, channels.length));
  const preferredVariant = luminance < 138 ? "light" : "dark";
  const chosen = logoSources.find((source) => source.variant === preferredVariant)
    || logoSources.find((source) => source.variant === "primary")
    || logoSources[0];
  const logoWidth = Math.round(width * (ficha.logo_usage === "prominent" ? .19 : .13));
  const logo = await sharp(chosen.buffer).resize({ width: logoWidth, height: Math.round(height * .065), fit: "inside" }).png().toBuffer();
  const logoMeta = await sharp(logo).metadata();
  return [{ input: logo, left: width - margin - (logoMeta.width || logoWidth), top: margin }];
}

export async function verifyTextContrast(beforeText: Buffer, finalImage: Buffer, regions: TextRegionPlan[]): Promise<TextCompositionVerification> {
  if (regions.length === 0) {
    return { passed: true, expectedRegions: 0, totalContrastPixels: 0, emptyShapeCount: 0, regions: [] };
  }

  const [before, after] = await Promise.all([
    sharp(beforeText).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(finalImage).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const width = Math.min(before.info.width, after.info.width);
  const height = Math.min(before.info.height, after.info.height);
  const channels = Math.min(before.info.channels, after.info.channels);
  const results: TextContrastRegion[] = [];

  for (const region of regions) {
    const left = Math.max(0, Math.floor(region.left));
    const top = Math.max(0, Math.floor(region.top));
    const right = Math.min(width, Math.ceil(region.left + region.width));
    const bottom = Math.min(height, Math.ceil(region.top + region.height));
    let contrastPixels = 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const pixel = (y * width + x) * channels;
        const difference = Math.max(
          Math.abs(before.data[pixel] - after.data[pixel]),
          Math.abs(before.data[pixel + 1] - after.data[pixel + 1]),
          Math.abs(before.data[pixel + 2] - after.data[pixel + 2]),
        );
        if (difference >= 18) contrastPixels += 1;
      }
    }
    const minimumContrastPixels = Math.max(24, Math.round(region.text.length * region.fontSize * .075));
    results.push({ label: region.label, text: region.text, contrastPixels, minimumContrastPixels, passed: contrastPixels >= minimumContrastPixels });
  }

  const totalContrastPixels = results.reduce((sum, result) => sum + result.contrastPixels, 0);
  return {
    passed: results.every((result) => result.passed),
    expectedRegions: results.length,
    totalContrastPixels,
    emptyShapeCount: 0,
    regions: results,
  };
}
