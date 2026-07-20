import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/app/admin/_components/ui";
import { addApplicationNoteAction, updateApplicationStatusAction } from "@/app/admin/crm-actions";
import { deleteApplicationAction } from "@/app/admin/privacy-actions";
import { applicationStatuses, formatDateTime } from "@/lib/recruitment";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function answerValue(answer: { answer_text: string | null; answer_json: unknown }) {
  if (answer.answer_text) return answer.answer_text;
  if (Array.isArray(answer.answer_json)) return answer.answer_json.join(", ");
  if (typeof answer.answer_json === "boolean") return answer.answer_json ? "Igen" : "Nem";
  return answer.answer_json ? JSON.stringify(answer.answer_json) : "—";
}

export default async function ApplicationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const [applicationResult, answersResult, filesResult, notesResult, activityResult, emailsResult] = await Promise.all([
    supabase.from("applications").select("*").eq("id", id).single(),
    supabase.from("application_answers").select("*").eq("application_id", id).order("created_at"),
    supabase.from("uploaded_files").select("*").eq("application_id", id).order("created_at"),
    supabase.from("application_notes").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("activity_logs").select("*").eq("entity_type", "application").eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("email_logs").select("*").eq("application_id", id).order("created_at", { ascending: false })
  ]);
  if (applicationResult.error || !applicationResult.data) notFound();
  const error = answersResult.error ?? filesResult.error ?? notesResult.error ?? activityResult.error ?? emailsResult.error;
  if (error) throw new Error(error.message);
  const application = applicationResult.data;
  const { data: job } = await supabase.from("jobs").select("*").eq("id", application.job_id).single();
  const { data: company } = job ? await supabase.from("companies").select("*").eq("id", job.company_id).single() : { data: null };
  const answers = answersResult.data ?? [];
  const files = filesResult.data ?? [];
  const notes = notesResult.data ?? [];
  const activity = activityResult.data ?? [];
  const emails = emailsResult.data ?? [];

  return <>
    <header className="admin-page-header"><div><span className="admin-eyebrow">Jelentkező adatlapja</span><h2>{application.applicant_name}</h2><p>{job?.title ?? "Ismeretlen állás"} · Jelentkezett: {formatDateTime(application.created_at)}</p></div><div className="admin-actions no-print"><Link className="admin-button secondary" href="/admin/jelentkezok">Vissza a listához</Link>{job ? <Link className="admin-button secondary" href={`/admin/allasok/${job.id}`}>Állás megnyitása</Link> : null}<PrintButton /></div></header>
    {query.saved === "1" ? <div className="admin-feedback no-print" role="status">A módosítás sikeresen mentve.</div> : null}
    <div className="admin-detail-grid">
      <div>
        <section className="admin-card admin-form-section"><div className="admin-form-section-header"><h3>Alapadatok</h3><p>A jelentkező által megadott kapcsolati adatok.</p></div><dl className="admin-definition-list"><div><dt>Név</dt><dd>{application.applicant_name}</dd></div><div><dt>E-mail</dt><dd><a href={`mailto:${application.applicant_email}`}>{application.applicant_email}</a></dd></div><div><dt>Telefonszám</dt><dd>{application.applicant_phone ? <a href={`tel:${application.applicant_phone}`}>{application.applicant_phone}</a> : "—"}</dd></div><div><dt>Állás</dt><dd>{job?.title ?? "—"}</dd></div><div><dt>Cég</dt><dd>{company?.name ?? "—"}</dd></div><div><dt>Jelentkezés ideje</dt><dd>{formatDateTime(application.created_at)}</dd></div><div><dt>Adatvédelmi hozzájárulás</dt><dd>{application.consent_accepted ? `Elfogadva · ${formatDateTime(application.privacy_accepted_at ?? application.created_at)}` : "Nincs elfogadva"}</dd></div></dl></section>
        <section className="admin-card admin-form-section"><div className="admin-form-section-header"><h3>Kérdések és válaszok</h3><p>A kérdés beküldéskori szövege alapján megőrzött válaszok.</p></div><dl className="admin-definition-list">{answers.map((answer) => <div key={answer.id}><dt>{answer.question_label_snapshot}</dt><dd>{answerValue(answer)}</dd></div>)}{answers.length === 0 ? <div><dt>Válaszok</dt><dd>Nincs egyedi kérdésre adott válasz.</dd></div> : null}</dl></section>
        <section className="admin-card admin-form-section"><div className="admin-form-section-header"><h3>Dokumentumok</h3><p>Privát Supabase Storage fájlok, rövid élettartamú admin letöltési linkkel.</p></div><div className="admin-actions">{files.map((file) => <Link className="admin-button secondary" href={`/api/files/${file.id}`} key={file.id}>↓ {file.original_filename}</Link>)}{files.length === 0 ? <span style={{ color: "var(--admin-muted)", fontSize: 13 }}>Nem töltött fel önéletrajzot vagy más dokumentumot.</span> : null}</div></section>
        <section className="admin-card admin-form-section" id="megjegyzesek"><div className="admin-form-section-header"><h3>Belső megjegyzések</h3><p>Ezek a megjegyzések soha nem kerülnek publikus oldalra vagy e-mailbe.</p></div><form action={addApplicationNoteAction} className="no-print"><input name="application_id" type="hidden" value={application.id} /><label className="admin-field">Új megjegyzés<textarea className="admin-textarea" maxLength={5000} name="content" required rows={4} /></label><div className="admin-form-footer"><button className="admin-button" type="submit">Megjegyzés hozzáadása</button></div></form><div className="admin-job-count-list" style={{ marginTop: 18 }}>{notes.map((note) => <article className="admin-note" key={note.id}><p>{note.content}</p><small>{formatDateTime(note.created_at)}</small></article>)}{notes.length === 0 ? <div className="admin-empty">Még nincs belső megjegyzés.</div> : null}</div></section>
      </div>
      <aside>
        <section className="admin-card admin-form-section no-print"><div className="admin-form-section-header"><h3>CRM-státusz</h3><p>A változás az aktivitási idővonalon is megjelenik.</p></div><form action={updateApplicationStatusAction}><input name="application_id" type="hidden" value={application.id} /><label className="admin-field">Aktuális státusz<select className="admin-select" defaultValue={application.status} name="status">{applicationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="admin-form-footer"><button className="admin-button" type="submit">Státusz mentése</button></div></form></section>
        <section className="admin-card admin-form-section"><div className="admin-form-section-header"><h3>Aktivitási idővonal</h3><p>Státuszváltások és automatikus e-mail-kézbesítés.</p></div>{activity.map((item) => <div className="admin-list-row" key={item.id}><span><strong>Státuszváltozás</strong><small>{item.previous_value ?? "—"} → {item.new_value ?? "—"}</small></span><small>{formatDateTime(item.created_at)}</small></div>)}{emails.map((email) => <div className="admin-list-row" key={email.id}><span><strong>Visszaigazoló e-mail: {email.status === "sent" ? "elküldve" : email.status === "failed" ? "sikertelen" : "sorban"}</strong><small>{email.to_email}</small></span><small>{formatDateTime(email.sent_at ?? email.created_at)}</small></div>)}{activity.length === 0 && emails.length === 0 ? <div className="admin-empty">Nincs naplózott aktivitás.</div> : null}</section>
        <details className="admin-card admin-form-section no-print"><summary style={{ color: "var(--admin-red)", cursor: "pointer", fontWeight: 800 }}>Adatvédelmi törlés</summary><form action={deleteApplicationAction} style={{ marginTop: 16 }}><input name="application_id" type="hidden" value={application.id} /><p style={{ color: "var(--admin-muted)", fontSize: 13, lineHeight: 1.6 }}>Ez véglegesen törli a jelentkezőt, a válaszokat, jegyzeteket és feltöltött dokumentumokat. Írd be: <strong>TÖRLÉS</strong></p><label className="admin-field">Megerősítés<input className="admin-input" name="confirmation" required /></label><div className="admin-form-footer"><button className="admin-button danger" type="submit">Jelentkező végleges törlése</button></div></form></details>
      </aside>
    </div>
  </>;
}
