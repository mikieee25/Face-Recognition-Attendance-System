import type { Personnel } from "@/types/models";

export function formatSectionLabel(
  section: Personnel["section"] | string,
): string {
  return section === "admin" ? "Administrative" : "Operation";
}

export function buildImageUrl(
  imagePath: string | null | undefined,
): string | undefined {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http")) return imagePath;

  const assetBase =
    process.env.NEXT_PUBLIC_ASSET_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "";
  const normalizedBase = assetBase.replace(/\/+$/, "");
  const normalizedPath = imagePath.replace(/^\//, "");
  return normalizedBase ? `${normalizedBase}/${normalizedPath}` : `/${normalizedPath}`;
}

export function getPersonnelInitials(
  firstName?: string,
  lastName?: string,
): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "P";
}

export function buildCoverBackground(
  imagePath: string | null | undefined,
  fallback: string,
  overlay =
    "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.74) 100%)",
): string {
  const imageUrl = buildImageUrl(imagePath);
  if (!imageUrl) return fallback;
  return `${overlay}, url("${imageUrl}")`;
}
