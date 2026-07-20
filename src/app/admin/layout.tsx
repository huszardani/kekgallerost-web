import type { ReactNode } from "react";
import AdminShell from "@/app/admin/_components/admin-shell";
import { requireRole } from "@/lib/auth";
import "./admin.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireRole("admin");
  return <AdminShell profileName={profile.full_name ?? profile.email}>{children}</AdminShell>;
}
