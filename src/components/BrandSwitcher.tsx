"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorkspaceBrand } from "@/lib/workspace";

export function BrandSwitcher({
  activeBrandId,
  brandList,
}: {
  activeBrandId: string;
  brandList: WorkspaceBrand[];
}) {
  const router = useRouter();
  const brands = brandList.length ? brandList : [];
  const hasMultipleBrands = brands.length > 1;

  return (
    <div className="brand-switcher">
      <label>
        <span>Usar marca</span>
        <select
          value={activeBrandId}
          disabled={!hasMultipleBrands}
          onChange={(event) => {
            document.cookie = `active_brand_id=${event.target.value}; path=/; max-age=31536000; SameSite=Lax`;
            router.refresh();
          }}
        >
          {brands.map((brand) => (
            <option value={brand.id} key={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>
      <Link href="/marcas">{hasMultipleBrands ? "Cambiar memoria" : "Agregar marca"}</Link>
    </div>
  );
}
