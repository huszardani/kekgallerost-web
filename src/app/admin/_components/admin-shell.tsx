"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOutAction } from "@/app/auth/actions";

const navigation = [
  { href: "/admin/attekintes", label: "Áttekintés", icon: "⌂" },
  { href: "/admin/allasok", label: "Állások", icon: "▣" },
  { href: "/admin/jelentkezok", label: "Jelentkezők", icon: "◎" },
  { href: "/admin/cegek", label: "Cégek", icon: "◇" },
  { href: "/admin/email-sablon", label: "E-mail sablon", icon: "✉" },
  { href: "/admin/beallitasok", label: "Beállítások", icon: "⚙" }
];

function pageTitle(pathname: string) {
  if (pathname.includes("/jelentkezok/")) return "Jelentkező adatlapja";
  if (pathname.includes("/allasok/uj")) return "Új állás";
  if (/\/allasok\/[^/]+/.test(pathname)) return "Állás adatlapja";
  return navigation.find((item) => pathname.startsWith(item.href))?.label ?? "Admin";
}

export default function AdminShell({ profileName, children }: { profileName: string; children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`admin-app${collapsed ? " is-collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
      <button className="admin-mobile-backdrop" aria-label="Menü bezárása" onClick={() => setMobileOpen(false)} />
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">K</span>
          <span className="admin-brand-copy"><strong>Kékgalléros</strong><small>Admin CRM</small></span>
        </div>
        <nav className="admin-nav" aria-label="Admin navigáció">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={item.href} key={item.href} onClick={() => setMobileOpen(false)}>
                <span aria-hidden="true" className="admin-nav-icon">{item.icon}</span><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <form action={signOutAction}><button type="submit"><span aria-hidden="true">↪</span><span>Kijelentkezés</span></button></form>
          <button className="admin-collapse" onClick={() => setCollapsed((value) => !value)} type="button" aria-label={collapsed ? "Oldalsáv kinyitása" : "Oldalsáv összecsukása"}>
            <span aria-hidden="true">{collapsed ? "›" : "‹"}</span><span>Oldalsáv összecsukása</span>
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <button className="admin-menu-button" onClick={() => setMobileOpen(true)} type="button" aria-label="Navigáció megnyitása">☰</button>
            <div><span>Kékgalléros admin</span><h1>{pageTitle(pathname)}</h1></div>
          </div>
          <div className="admin-account"><span className="admin-avatar">{profileName.trim().charAt(0).toUpperCase() || "A"}</span><div><strong>{profileName}</strong><small>Adminisztrátor</small></div></div>
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
