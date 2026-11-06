import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AreaLoading } from "@/components/auth/AreaLoading";
import { PageContainer } from "@/components/layout/PageContainer";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PageHeading } from "@/components/ui/PageHeading";
import { SystemStatus } from "@/components/system/SystemStatus";

export const metadata: Metadata = { title: "Stato del sistema" };

export default function StatusPage() {
  return (
    <PublicLayout>
    <PageContainer>
      <PageHeading eyebrow="Diagnostica" title="Stato del sistema">
        Verifica della configurazione e della connessione al database. I valori delle chiavi non vengono mai
        mostrati.
      </PageHeading>
      <Suspense fallback={<AreaLoading />}>
        <LiveStatus />
      </Suspense>
    </PageContainer>
    </PublicLayout>
  );
}

async function LiveStatus() {
  await connection(); // sempre calcolato al momento della richiesta
  return <SystemStatus />;
}
