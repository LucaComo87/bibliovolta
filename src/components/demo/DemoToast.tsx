"use client";

import { Toast } from "@/components/ui/Toast";
import { useDemoStudent } from "@/lib/demo/student-store";

export function DemoToast() {
  const { toast, dismissToast } = useDemoStudent();
  if (!toast) return null;
  return <Toast key={toast.id} title={toast.title} body={toast.body} onClose={dismissToast} />;
}
