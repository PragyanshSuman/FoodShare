"use client";

import { Printer } from "lucide-react";
import { Button } from "./ui";

/** Browser print-to-PDF: free PDF generation with no server-side renderer. */
export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="no-print">
      <Printer size={16} /> {label}
    </Button>
  );
}
