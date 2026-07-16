import { signInAction } from "@/app/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

const errors: Record<string, string> = {
  "invalid-credentials": "Hibás e-mail-cím vagy jelszó.",
  "missing-company": "A partner profilhoz még nincs cég rendelve. Kérd az admin segítségét."
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
      </form>
    </main>
  );
}

