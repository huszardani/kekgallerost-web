import Link from "next/link";
import { requestPasswordResetAction } from "@/app/auth/actions";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

const errors: Record<string, string> = {
  "missing-email": "Add meg az e-mail-címedet.",
  "request-failed": "A helyreállító e-mailt most nem sikerült elküldeni. Próbáld meg később."
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <main className="page-shell narrow-shell">
      <p className="eyebrow">Fiók-helyreállítás</p>
      <h1>Elfelejtett jelszó</h1>
      <p className="lead">
        Add meg a bejelentkezéshez használt e-mail-címedet, és küldünk egy biztonságos linket az új jelszó beállításához.
      </p>

      {params.error ? <p className="alert error">{errors[params.error] ?? "A kérés sikertelen."}</p> : null}

      {params.sent ? (
        <section className="panel success-panel form-stack">
          <h2>Nézd meg a postaládádat</h2>
          <p>
            Ha az e-mail-címhez tartozik fiók, hamarosan megérkezik a helyreállító link. Ellenőrizd a spam mappát is.
          </p>
          <Link className="button secondary" href="/bejelentkezes">
            Vissza a bejelentkezéshez
          </Link>
        </section>
      ) : (
        <form action={requestPasswordResetAction} className="panel form-stack">
          <label>
            E-mail-cím
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <button className="button" type="submit">Helyreállító link küldése</button>
          <div className="form-help">
            <Link className="text-link" href="/bejelentkezes">
              Vissza a bejelentkezéshez
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
