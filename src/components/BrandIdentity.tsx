import Link from "next/link";

export const PRODUCT_NAME = "Anapau iA";

export function BrandMark({ href = "/", subtitle }: { href?: string; subtitle?: string }) {
  return (
    <Link href={href} className="brand-lockup" aria-label={PRODUCT_NAME}>
      <span className="brand-photo" />
      <span>
        <b>{PRODUCT_NAME}</b>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </Link>
  );
}
