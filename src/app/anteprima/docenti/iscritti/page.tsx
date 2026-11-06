import { Suspense } from "react";
import { AreaLoading } from "@/components/auth/AreaLoading";
import { RosterPreview } from "./RosterPreview";

export default function PreviewTeacherRoster() {
  return (
    <Suspense fallback={<AreaLoading />}>
      <RosterPreview />
    </Suspense>
  );
}
