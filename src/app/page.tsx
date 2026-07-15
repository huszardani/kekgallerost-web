import Link from "next/link";

const routes = [
  { href: "/allasok", label: "Állások" },
  { href: "/admin", label: "Admin" },
  { href: "/partner", label: "Partner" }
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <p className="eyebrow">kekgallerost.hu</p>
      <h1>Kékgalléros állások és jelentkezéskezelés egy helyen</h1>
      <p className="lead">
        Induló Next.js alap a Kékgallérost.hu álláshirdetési rendszerhez,
        Supabase adatbázissal, Resend e-mail küldéssel, admin és partner
        felület előkészítéssel.
      </p>
      <div className="button-row">
        {routes.map((route) => (
          <Link className="button" href={route.href} key={route.href}>
            {route.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
