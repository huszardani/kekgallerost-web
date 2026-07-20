import { redirect } from "next/navigation";
import { updatePasswordAction } from "@/app/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type UpdatePasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errors: Record<string, string> = {
  "password-too-short": "Az új jelszó legalább 12 karakter hosszú legyen.",
  "password-mismatch": "A két jelszó nem egyezik.",
  "update-failed": "Az új jelszót most nem sikerült beállítani. Kérj új helyreállító linket."
};

export default async function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/bejelentkezes?error=recovery-session");
  }

  return (
    <main className="page-shell narrow-shell">
      <p className="eyebrow">Fiók-helyreállítás</p>
      <h1>Új jelszó beállítása</h1>
      <p className="lead">Válassz legalább 12 karakteres, egyedi jelszót.</p>
      {params.error ? <p className="alert error">{errors[params.error] ?? "A módosítás sikertelen."}</p> : null}
      <form action={updatePasswordAction} className="panel form-stack">
        <label>
          Új jelszó
          <input autoComplete="new-password" minLength={12} name="password" required type="password" />
        </label>
        <label>
          Új jelszó ismét
          <input autoComplete="new-password" minLength={12} name="passwordConfirmation" required type="password" />
        </label>
        <button className="button" type="submit">Új jelszó mentése</button>
      </form>
    </main>
  );
}
