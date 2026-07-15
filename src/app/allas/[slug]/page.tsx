type JobDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { slug } = await params;

  return (
    <main className="page-shell">
      <p className="eyebrow">Állás részletei</p>
      <h1>{slug}</h1>
      <p className="lead">
        Ez a dinamikus oldal tölti majd be az adott álláshirdetést a `jobs.slug`
        mező alapján, és innen indul a jelentkezési folyamat.
      </p>
    </main>
  );
}
