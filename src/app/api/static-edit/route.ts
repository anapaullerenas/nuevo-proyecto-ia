import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getImageSize, StaticBrief } from "@/lib/ai/static-machine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 300;

type EditInput = { staticId: string; instruction: string };

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "La plataforma no está conectada." }, { status: 500 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para corregir la imagen." }, { status: 401 });

  const body = (await request.json()) as EditInput;
  const instruction = body.instruction?.trim();
  if (!body.staticId || !instruction || instruction.length < 6) {
    return NextResponse.json({ error: "Describe la corrección puntual que quieres hacer." }, { status: 400 });
  }

  const { data: source } = await supabase
    .from("static_creatives")
    .select("id,brand_id,storage_path,prompt,ficha,archetype,format,funnel_stage,quality,version")
    .eq("id", body.staticId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!source?.storage_path) return NextResponse.json({ error: "No encontré la imagen que quieres corregir." }, { status: 404 });

  const { data: sourceBlob, error: sourceError } = await supabase.storage.from("creative-assets").download(source.storage_path);
  if (sourceError || !sourceBlob) return NextResponse.json({ error: "No pudimos abrir la versión elegida." }, { status: 400 });

  try {
    const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer());
    const currentFicha = source.ficha as StaticBrief;
    const replacement = parseTextReplacement(instruction);
    const nextFicha = replacement ? replaceFichaText(currentFicha, replacement.from, replacement.to) : currentFicha;
    const changedFichaText = JSON.stringify(nextFicha) !== JSON.stringify(currentFicha);

    let output: Buffer;
    if (replacement && changedFichaText && currentFicha.text_render_mode === "layered") {
      output = await replaceExactTextBlock(sourceBuffer, nextFicha);
    } else {
      output = await editWithImageModel(sourceBuffer, source.format || "4:5 Feed", source.quality === "high" ? "high" : "medium", instruction);
    }

    const storagePath = `${user.id}/${source.brand_id}/static-edit-${Date.now()}-${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage.from("creative-assets").upload(storagePath, output, { contentType: "image/png" });
    if (uploadError) throw uploadError;
    const { data: signed } = await supabase.storage.from("creative-assets").createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    const { data: saved, error: saveError } = await supabase.from("static_creatives").insert({
      brand_id: source.brand_id,
      owner_id: user.id,
      storage_path: storagePath,
      prompt: `${source.prompt || ""}\nCORRECCIÓN: ${instruction}`,
      ficha: nextFicha,
      archetype: source.archetype,
      format: source.format,
      funnel_stage: source.funnel_stage,
      quality: source.quality,
      version: (source.version || 1) + 1,
      parent_id: source.id,
      concept: { edit_instruction: instruction, source_static_id: source.id, text_only_edit: Boolean(replacement && changedFichaText) },
      qa_report: { status: "version_corregida", instruction },
      status: "edited",
    }).select("id,storage_path,prompt,ficha,archetype,format,funnel_stage,quality,version,parent_id,status,created_at").single();
    if (saveError) throw saveError;

    return NextResponse.json({ static: { ...saved, public_url: signed?.signedUrl || null } });
  } catch (error) {
    console.error("static edit failed", error);
    return NextResponse.json({ error: "No pude aplicar esa corrección sin comprometer la imagen. Intenta describir un solo cambio concreto." }, { status: 500 });
  }
}

async function editWithImageModel(source: Buffer, format: string, quality: "medium" | "high", instruction: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Image editing is not configured");
  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
  form.append("size", getImageSize(format));
  form.append("quality", quality);
  form.append("n", "1");
  form.append("output_format", "png");
  form.append("image[]", new Blob([new Uint8Array(source)], { type: "image/png" }), "version-original.png");
  form.append("prompt", `Edita esta pieza publicitaria. Aplica SOLAMENTE este cambio: ${instruction}. Conserva exactamente composición, dimensiones, producto, envase, iluminación, modelo, logo, colores y todos los demás textos. No rediseñes la pieza. No añadas elementos. Devuelve una sola imagen terminada.`);
  const response = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${apiKey}` }, body: form });
  if (!response.ok) throw new Error(`Image edit ${response.status}`);
  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned");
  return Buffer.from(b64, "base64");
}

function parseTextReplacement(instruction: string) {
  const normalized = instruction.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const patterns = [
    /(?:en lugar de)\s+["']([^"']+)["']\s+(?:pon|ponle|escribe|coloca)\s+["']([^"']+)["']/i,
    /(?:cambia|reemplaza|sustituye)\s+["']([^"']+)["']\s+(?:por|a)\s+["']([^"']+)["']/i,
    /(?:en lugar de)\s+(.+?)\s+(?:pon|ponle|escribe|coloca)\s+(.+?)(?:\.|$)/i,
    /(?:cambia|reemplaza|sustituye)\s+(.+?)\s+(?:por|a)\s+(.+?)(?:\.|$)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return { from: match[1].trim(), to: match[2].trim() };
  }
  return null;
}

function replaceFichaText(ficha: StaticBrief, from: string, to: string) {
  const replace = (value: string) => value.replace(new RegExp(escapeRegExp(from), "gi"), to);
  return {
    ...ficha,
    concepto: replace(ficha.concepto),
    texto_principal: replace(ficha.texto_principal),
    texto_secundario: replace(ficha.texto_secundario),
    cta: replace(ficha.cta),
    disclaimer: replace(ficha.disclaimer),
  };
}

async function replaceExactTextBlock(source: Buffer, ficha: StaticBrief) {
  const image = sharp(source);
  const metadata = await image.metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1350;
  const margin = Math.round(width * .07);
  const headlineSize = Math.round(width * .058);
  const secondarySize = Math.round(width * .029);
  const disclaimerSize = Math.round(width * .018);
  const boxHeight = Math.round(height * (ficha.disclaimer ? .22 : .18));
  const boxY = height - boxHeight - margin;
  const palette = /^#[0-9a-f]{6}$/i.test(ficha.paleta[0] || "") ? ficha.paleta[0] : "#632E59";
  const headline = textLines(ficha.texto_principal, 30, margin * 1.45, boxY + headlineSize * 1.18, headlineSize * 1.05);
  const secondaryY = boxY + headlineSize * (headline.count > 1 ? 3.05 : 2.05);
  const cta = escapeSvg(ficha.cta);
  const ctaWidth = Math.min(width * .3, Math.max(170, cta.length * secondarySize * .56));
  const overlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>.copy{font-family:'Helvetica Neue',Arial,sans-serif;fill:#fff}.h{font-size:${headlineSize}px;font-weight:800}.s{font-size:${secondarySize}px;font-weight:600}.c{font-size:${secondarySize}px;font-weight:800;fill:${palette}}.l{font-size:${disclaimerSize}px;font-weight:500;fill:rgba(255,255,255,.86)}</style><rect x="${margin}" y="${boxY}" width="${width-margin*2}" height="${boxHeight}" rx="${Math.round(width*.025)}" fill="${palette}"/><text class="copy h">${headline.svg}</text><text x="${margin*1.45}" y="${secondaryY}" class="copy s">${escapeSvg(ficha.texto_secundario)}</text><rect x="${width-margin*1.45-ctaWidth}" y="${boxY+headlineSize*1.15}" width="${ctaWidth}" height="${secondarySize*1.75}" rx="${secondarySize*.88}" fill="#fff6f0"/><text x="${width-margin*1.45-ctaWidth/2}" y="${boxY+headlineSize*1.15+secondarySize*1.15}" text-anchor="middle" class="copy c">${cta}</text>${ficha.disclaimer?`<text x="${margin*1.45}" y="${boxY+boxHeight-disclaimerSize*1.5}" class="copy l">${escapeSvg(ficha.disclaimer)}</text>`:""}</svg>`;
  return image.composite([{ input: Buffer.from(overlay) }]).png().toBuffer();
}

function textLines(value: string, max: number, x: number, y: number, lineHeight: number) {
  const words = escapeSvg(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1) || "";
    if (!current || `${current} ${word}`.length > max) lines.push(word); else lines[lines.length - 1] = `${current} ${word}`;
  }
  const visible = lines.slice(0, 2);
  return { count: visible.length, svg: visible.map((line, index) => `<tspan x="${x}" y="${y+index*lineHeight}">${line}</tspan>`).join("") };
}

function escapeSvg(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] || character); }
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
