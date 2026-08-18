import { formatDateTime } from "@/lib/recruitment";
import { applicationEmailAdminStatuses, type ApplicationEmailStatusRow } from "@/lib/email/application-email-admin-status";

export function ApplicationEmailStatusList({ emails }: { emails: ApplicationEmailStatusRow[] }) {
  return <section className="admin-card admin-form-section">
    <div className="admin-form-section-header">
      <h3>E-mail-kézbesítések</h3>
      <p>A jelentkezői, partner- és adminértesítés egymástól független állapota.</p>
    </div>
    {applicationEmailAdminStatuses(emails).map(({ role, email, label, status, safeError }) => {
      return <div className="admin-list-row" key={role}>
        <span>
          <strong>{label}: {status}</strong>
          <small>Címzett: {email?.to_email ?? "—"}</small>
          <small>Próbálkozások: {email?.attempt_count ?? 0}</small>
          {safeError ? <small>{safeError}</small> : null}
        </span>
        <span>
          <small>Elküldve: {email?.sent_at ? formatDateTime(email.sent_at) : "—"}</small>
          <small>Utolsó próbálkozás: {email?.last_attempt_at ? formatDateTime(email.last_attempt_at) : "—"}</small>
          <small>Következő: {email?.next_attempt_at ? formatDateTime(email.next_attempt_at) : "—"}</small>
        </span>
      </div>;
    })}
  </section>;
}
