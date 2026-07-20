"use client";

import { type ReactNode } from "react";

export function ConfirmForm({ action, message, children, className }: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return <form action={action} className={className} onSubmit={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{children}</form>;
}

export function PrintButton() {
  return <button className="admin-button secondary no-print" onClick={() => window.print()} type="button">Nyomtatható nézet</button>;
}
