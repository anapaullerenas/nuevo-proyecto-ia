import assert from "node:assert/strict";
import {
  CURATED_STATIC_FORMATS,
  isStaticFormatUnlocked,
  selectAutomaticStaticFormat,
  type BrandEvidence,
} from "../src/lib/static-format-catalog";

const noEvidence: BrandEvidence = {
  testimonial: false,
  verified_numbers: false,
  before_after: false,
  price_comparison: false,
};

assert.equal(
  selectAutomaticStaticFormat({ stage: "Conversión", intent: "Lanzar una oferta esta semana", evidence: noEvidence }).id,
  "oferta_directa",
  "Conversion must have a deterministic cold-start default",
);

const testimonial = CURATED_STATIC_FORMATS.find((item) => item.id === "prueba_social_flotante");
assert(testimonial);
assert.equal(isStaticFormatUnlocked(testimonial, noEvidence), false, "Testimonial styles must stay locked without evidence");

const withTestimonial = { ...noEvidence, testimonial: true };
assert.equal(
  selectAutomaticStaticFormat({ stage: "Retargeting", intent: "Usar una reseña para dar confianza", evidence: withTestimonial }).id,
  "prueba_social_flotante",
  "Real testimonials should unlock and win testimonial intent",
);

assert.notEqual(
  selectAutomaticStaticFormat({
    stage: "Conversión",
    intent: "Presentar una oferta clara",
    evidence: noEvidence,
    recentArchetypes: ["oferta_directa", "oferta_directa", "oferta_directa"],
  }).id,
  "oferta_directa",
  "Diversity should penalize a repeatedly used pattern",
);

console.log("Static selector: evidence, cold start and diversity checks passed.");
