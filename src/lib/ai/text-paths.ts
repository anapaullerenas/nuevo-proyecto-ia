import fs from "node:fs";
import path from "node:path";
import { parse, type Font, type Glyph, type PathCommand } from "opentype.js";

export const PACKAGED_FONTS = {
  dmSansBold: "DMSans-Bold.ttf",
  dmSansRegular: "DMSans-Regular.ttf",
  spaceGroteskBold: "SpaceGrotesk-Bold.ttf",
  caveatBold: "Caveat-Bold.ttf",
} as const;

export type PackagedFont = keyof typeof PACKAGED_FONTS;

type TextPathOptions = {
  font: PackagedFont;
  size: number;
  x: number;
  y: number;
  letterSpacing?: number;
};

type MeasureTextOptions = Pick<TextPathOptions, "font" | "size" | "letterSpacing">;

const fontCache = new Map<PackagedFont, Font>();

function loadFont(fontName: PackagedFont) {
  const cached = fontCache.get(fontName);
  if (cached) return cached;

  const filePath = path.join(process.cwd(), "assets", "fonts", PACKAGED_FONTS[fontName]);
  const bytes = fs.readFileSync(filePath);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const font = parse(arrayBuffer);
  fontCache.set(fontName, font);
  return font;
}

function glyphAdvance(font: Font, glyph: Glyph, size: number) {
  return ((glyph.advanceWidth || font.unitsPerEm) / font.unitsPerEm) * size;
}

function coordinate(value: number) {
  return String(Math.round(value * 100) / 100);
}

function glyphPathData(glyph: Glyph, x: number, y: number, size: number) {
  const scale = size / (glyph.path.unitsPerEm || 1000);
  const point = (value: number, origin: number, invert = false) => coordinate(origin + value * scale * (invert ? -1 : 1));
  return glyph.path.commands.map((command: PathCommand) => {
    if (command.type === "M" || command.type === "L") return `${command.type}${point(command.x, x)} ${point(command.y, y, true)}`;
    if (command.type === "Q") return `Q${point(command.x1, x)} ${point(command.y1, y, true)} ${point(command.x, x)} ${point(command.y, y, true)}`;
    if (command.type === "C") return `C${point(command.x1, x)} ${point(command.y1, y, true)} ${point(command.x2, x)} ${point(command.y2, y, true)} ${point(command.x, x)} ${point(command.y, y, true)}`;
    return "Z";
  }).join("");
}

function glyphRun(text: string, options: MeasureTextOptions) {
  const font = loadFont(options.font);
  const glyphs = font.stringToGlyphs(text);
  const scale = options.size / font.unitsPerEm;
  const letterSpacing = options.letterSpacing || 0;
  let width = 0;

  glyphs.forEach((glyph, index) => {
    if (index > 0) width += font.getKerningValue(glyphs[index - 1], glyph) * scale;
    width += glyphAdvance(font, glyph, options.size);
    if (index < glyphs.length - 1) width += letterSpacing;
  });

  return { font, glyphs, width, scale, letterSpacing };
}

/** Returns the real advance width of packaged-font text in output pixels. */
export function measureText(text: string, options: MeasureTextOptions) {
  if (!text) return 0;
  return glyphRun(text, options).width;
}

/**
 * Converts text to self-contained SVG outlines. The returned markup contains
 * only vector paths and therefore has no runtime system-font dependency.
 */
export function textToPath(text: string, options: TextPathOptions) {
  if (!text) return "";
  const run = glyphRun(text, options);
  const paths: string[] = [];
  let cursor = options.x;

  run.glyphs.forEach((glyph, index) => {
    if (index > 0) cursor += run.font.getKerningValue(run.glyphs[index - 1], glyph) * run.scale;
    // Build path data directly so every TrueType contour keeps its closing Z.
    // This also avoids a v2 opentype.js fill-only serialization regression.
    const data = glyphPathData(glyph, cursor, options.y, options.size);
    if (data) paths.push(`<path d="${data}"/>`);
    cursor += glyphAdvance(run.font, glyph, options.size);
    if (index < run.glyphs.length - 1) cursor += run.letterSpacing;
  });

  return paths.join("");
}

export function fontVerticalMetrics(fontName: PackagedFont, size: number) {
  const font = loadFont(fontName);
  const scale = size / font.unitsPerEm;
  return {
    ascender: font.ascender * scale,
    descender: Math.abs(font.descender * scale),
    height: (font.ascender - font.descender) * scale,
  };
}
