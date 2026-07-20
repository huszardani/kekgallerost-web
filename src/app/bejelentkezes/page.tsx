import Link from "next/link";
import { signInAction } from "@/app/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
};

const errors: Record<string, string> = {
  "invalid-credentials": "Hibás e-mail-cím vagy jelszó.",
  "missing-company": "A partner profilhoz még nincs cég rendelve. Kérd az admin segítségét.",
  "recovery-link": "A helyreállító link érvénytelen vagy lejárt. Kérj újat.",
  "recovery-session": "A jelszó módosításához nyisd meg az e-mailben kapott helyreállító linket."
};

const messages: Record<string, string> = {
  "password-updated": "Az új jelszót beállítottuk. Most már bejelentkezhetsz vele."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/partner";

  return (
    <main className="page-shell narrow-shell">
      <p className="eyebrow">Belső hozzáférés</p>
      <h1>Bejelentkezés</h1>
      <p className="lead">Admin és partner felhasználók Supabase Auth bejelentkezése.</p>
      {params.error ? <p className="alert error">{errors[params.error] ?? "A bejelentkezés sikertelen."}</p> : null}
      {params.message ? <p className="alert success">{messages[params.message] ?? "A művelet sikerült."}</p> : null}
      <form action={signInAction} className="panel form-stack">
        <input name="next" type="hidden" value={nextPath} />
        <label>
          E-mail-cím
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <label>
          Jelszó
          <input autoComplete="current-password" name="password" required type="password" />
        </label>
        <button className="button" type="submit">Bejelentkezés</button>
        <div className="form-help">
          <Link className="text-link" href="/elfelejtett-jelszo">
            Elfelejtetted a jelszavad?
          </Link>
        </div>
      </form>
    </main>
  );
}

