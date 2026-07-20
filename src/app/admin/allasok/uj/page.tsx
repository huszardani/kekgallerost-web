import Link from "next/link";
import JobForm from "@/app/admin/allasok/job-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NewJobPage() {
  const supabase = await createServerSupabaseClient();
  const { data: companies, error } = await supabase.from("companies").select("*").eq("status", "active").order("name");
  if (error) throw new Error(error.message);
  return <><header className="admin-page-header"><div><span className="admin-eyebrow">Új hirdetés</span><h2>Új állás létrehozása</h2><p>Először mentsd el piszkozatként, majd add hozzá az egyedi jelentkezési kérdéseket.</p></div><Link className="admin-button secondary" href="/admin/allasok">Vissza az állásokhoz</Link></header><JobForm companies={companies ?? []} /></>;
}
