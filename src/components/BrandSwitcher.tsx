"use client";

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

  if (brandList.length <= 1) return null;

  return (
    <label className="brand-switcher">
      <span>Marca activa</span>
      <select
        value={activeBrandId}
        onChange={(event) => {
          document.cookie = `active_brand_id=${event.target.value}; path=/; max-age=31536000; SameSite=Lax`;
          router.refresh();
        }}
      >
        {brandList.map((brand) => (
          <option value={brand.id} key={brand.id}>
            {brand.name}
          </option>
        ))}
      </select>
    </label>
  );
}
