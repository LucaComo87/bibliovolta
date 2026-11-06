import { Hammer } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeading } from "@/components/ui/PageHeading";
import { ROUTES } from "@/lib/config";

/** Sezione reale non ancora collegata al database: lo dice chiaramente. */
export function PhaseNotice({ eyebrow, title, phase, preview }: { eyebrow: string; title: string; phase: number; preview?: string }) {
  return (
    <>
      <PageHeading eyebrow={eyebrow} title={title} />
      <EmptyState
        icon={<Hammer />}
        title={`Disponibile dalla Fase ${phase}`}
        action={preview ? <ButtonLink href={`${ROUTES.preview}${preview}`} variant="secondary">Guarda l&apos;anteprima</ButtonLink> : undefined}
      >
        Questa sezione verrà collegata ai dati reali nella Fase {phase}. Nessun dato dimostrativo viene mostrato nell&apos;area reale.
      </EmptyState>
    </>
  );
}
