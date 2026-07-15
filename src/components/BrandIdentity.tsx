import Image from "next/image";
import Link from "next/link";

export const PRODUCT_NAME = "Anapau iA";

export function BrandMark({ href = "/", subtitle }: { href?: string; subtitle?: string }) {
  return (
    <Link href={href} className="brand-lockup" aria-label={PRODUCT_NAME}>
      <Image
        src="/brand/anapau-ai.png"
        alt="Ana Pau, creadora de Anapau iA"
        width={76}
        height={76}
        className="brand-photo"
        priority
      />
      <span>
        <b>{PRODUCT_NAME}</b>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </Link>
  );
}
