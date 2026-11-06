import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { isUiPreviewEnabled } from "@/lib/demo/preview";

export const metadata: Metadata = { title: "Anteprima", robots: { index: false, follow: false } };

export default function PreviewLayout({ children }: LayoutProps<"/anteprima">) {
  if (!isUiPreviewEnabled()) notFound();
  return (
    <>
      <DemoBanner />
      {children}
    </>
  );
}
