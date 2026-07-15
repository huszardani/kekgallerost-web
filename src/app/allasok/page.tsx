import Link from "next/link";

export default function JobsPage() {
  return (
    <main className="page-shell">
      <p className="eyebrow">Álláskeresőknek</p>
      <h1>Aktuális állások</h1>
      <p className="lead">
        Ez az oldal listázza majd a publikált, aktív álláshirdetéseket a
        Supabase `jobs` táblából.
      </p>
      <section className="grid" aria-label="Minta állások">
        <article className="panel">
          <h2>Raktári komissiózó</h2>
          <p>Gyál · teljes munkaidő · gyors kezdés</p>
          <Link className="button secondary" href="/allas/raktari-komissiozo-gyal">
            Részletek
          </Link>
        </article>
      </section>
    </main>
  );
}
