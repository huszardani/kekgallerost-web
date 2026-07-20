import { env } from "@/lib/env";

export default function SettingsPage() {
  const values = [
    ["NEXT_PUBLIC_SUPABASE_URL", Boolean(env.supabaseUrl)],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", Boolean(env.supabaseAnonKey)],
    ["SUPABASE_SERVICE_ROLE_KEY", Boolean(env.supabaseServiceRoleKey)],
    ["RESEND_API_KEY", Boolean(env.resendApiKey)],
    ["EMAIL_FROM", Boolean(env.emailFrom)],
    ["NEXT_PUBLIC_SITE_URL", Boolean(env.siteUrl)]
  ] as const;
  return <><header className="admin-page-header"><div><span className="admin-eyebrow">Rendszer</span><h2>Beállítások</h2><p>A biztonságos szerveroldali integrációk állapota. Titkos érték soha nem jelenik meg ezen az oldalon.</p></div></header><div className="admin-detail-grid"><section className="admin-card"><div className="admin-form-section-header"><h3>Környezeti változók</h3><p>Csak a konfiguráltság állapota látható.</p></div><div className="admin-env-list">{values.map(([name, ready]) => <div className="admin-env-row" key={name}><code>{name}</code><span className={ready ? "admin-ok" : "admin-missing"}>{ready ? "Beállítva" : "Hiányzik"}</span></div>)}</div></section><section className="admin-card"><div className="admin-form-section-header"><h3>Fájl- és e-mail-kezelés</h3></div><dl className="admin-definition-list"><div><dt>Önéletrajzok</dt><dd>Privát <code>application-files</code> Supabase Storage bucket</dd></div><div><dt>Maximális méret</dt><dd>10 MB</dd></div><div><dt>Formátumok</dt><dd>PDF, DOC, DOCX</dd></div><div><dt>E-mail-szolgáltató</dt><dd>Resend</dd></div><div><dt>Küldő</dt><dd>{env.emailFrom}</dd></div></dl></section></div></>;
}
