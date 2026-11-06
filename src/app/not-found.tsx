import { PageContainer } from "@/components/layout/PageContainer";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeading } from "@/components/ui/PageHeading";
import { ROUTES } from "@/lib/config";

export default function NotFound() {
  return (
    <PublicLayout>
    <PageContainer>
      <PageHeading eyebrow="Errore 404" title="Pagina non trovata">
        L&apos;indirizzo richiesto non esiste.
      </PageHeading>
      <ButtonLink href={ROUTES.home}>Torna alla pagina iniziale</ButtonLink>
    </PageContainer>
    </PublicLayout>
  );
}
