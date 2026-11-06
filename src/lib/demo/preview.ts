/**
 * Le schermate dimostrative (/anteprima) sono attive in sviluppo e,
 * in produzione, solo se ENABLE_UI_PREVIEW=true.
 */
export function isUiPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_UI_PREVIEW === "true";
}
