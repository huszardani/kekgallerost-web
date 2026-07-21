import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type PublicSiteFrameProps = {
  children: ReactNode;
  detail?: boolean;
};

function Brand({ detail = false }: { detail?: boolean }) {
  return (
    <Link aria-label="Kékgallérost.hu főoldal" className="kg-brand" href="/">
      <span className="kg-brand-logo-frame"><Image alt="" height={50} src="/assets/logo-mark.png" width={50} /></span>
      <span className="kg-brand-copy">
        <strong>Kékgallérost.hu</strong>
        <small>{detail ? "állás részletei" : "aktív állások"}</small>
      </span>
    </Link>
  );
}

export default function PublicSiteFrame({ children, detail = false }: PublicSiteFrameProps) {
  return (
    <div className={`kg-public-site${detail ? " kg-job-detail-page" : " kg-jobs-page"}`}>
      <a className="kg-skip-link" href={detail ? "#application" : "#job-list"}>
        {detail ? "Ugrás a jelentkezéshez" : "Ugrás az álláslistához"}
      </a>
      <header className="kg-site-header">
        <Brand detail={detail} />
        <nav aria-label="Fő navigáció" className="kg-main-nav">
          {detail ? <Link href="/allasok">Állások</Link> : <Link href="/">Főoldal</Link>}
          <Link href="/#companies">Cégeknek</Link>
          {!detail ? <Link href="/#pricing">Árak</Link> : null}
          <Link href="/#faq">GYIK</Link>
        </nav>
        {!detail ? <Link aria-current="page" className="kg-jobs-nav-link" href="/allasok">
          <span>Állások</span>
        </Link> : null}
        <Link className="kg-nav-cta" href={detail ? "#application" : "/#company-request"}>
          {detail ? "Jelentkezem" : "Ajánlatkérés"}
        </Link>
      </header>

      {children}

      <footer className="kg-site-footer">
        <Brand />
        <nav aria-label="Lábléc navigáció">
          <Link href="/">Főoldal</Link>
          <Link href="/allasok">Állások</Link>
          <Link href="/#companies">Cégeknek</Link>
          <Link href="/#company-request">Ajánlatkérés</Link>
          <Link href="/#faq">GYIK</Link>
        </nav>
        <nav aria-label="Jogi információk" className="kg-legal-links">
          <Link href="/jogi-dokumentumok#adatkezeles">Adatkezelés</Link>
          <Link href="/jogi-dokumentumok#cookie">Cookie tájékoztató</Link>
          <Link href="/jogi-dokumentumok#aszf">ÁSZF</Link>
          <Link href="/jogi-dokumentumok#impresszum">Impresszum</Link>
        </nav>
      </footer>
    </div>
  );
}
