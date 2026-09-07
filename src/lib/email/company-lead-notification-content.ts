import type { CompanyLead } from "../supabase/database.types";

type EmailField = {
  label: string;
  value: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character] ?? character);
}

function display(value: string | string[] | number | null) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (value === null || value === "") return "—";
  return String(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Budapest"
  }).format(new Date(value));
}

function fieldsFor(lead: CompanyLead): EmailField[] {
  return [
    { label: "Cégnév", value: display(lead.company) },
    { label: "Kapcsolattartó neve", value: display(lead.contact_name) },
    { label: "E-mail cím", value: display(lead.email) },
    { label: "Telefonszám", value: display(lead.phone) },
    { label: "Mikor hívható?", value: display(lead.call_time) },
    { label: "Munkakör", value: display(lead.role) },
    { label: "Keresett létszám", value: display(lead.headcount) },
    { label: "Munkavégzés helye", value: display(lead.location) },
    { label: "Kezdés", value: display(lead.start_urgency) },
    { label: "Műszakrend", value: display(lead.shifts) },
    { label: "Van megadott bér?", value: display(lead.has_salary) },
    { label: "Bér / bérsáv", value: display(lead.salary) },
    { label: "Alapfeltételek", value: display(lead.requirements) },
    { label: "Fontos tudnivaló", value: display(lead.must_know) },
    { label: "Legnagyobb toborzási probléma", value: display(lead.main_problems) },
    { label: "Korábbi hirdetés", value: display(lead.advertised_before) },
    { label: "Érdeklődést kiváltó csomag", value: display(lead.package) },
    { label: "Egyéb megjegyzés", value: display(lead.notes) },
    { label: "Beküldés időpontja", value: formatDate(lead.created_at) },
    { label: "Lead azonosító", value: lead.id }
  ];
}

export function buildCompanyLeadNotification(lead: CompanyLead) {
  const fields = fieldsFor(lead);
  const companyForSubject = lead.company.replace(/[\r\n]+/g, " ").trim().slice(0, 180);
  const subject = `Új céges érdeklődő – ${companyForSubject}`;
  const text = [
    "Új céges érdeklődő érkezett.",
    "",
    ...fields.map((field) => `${field.label}: ${field.value}`)
  ].join("\n");
  const rows = fields.map((field) =>
    `<tr><th style="padding:8px 12px;text-align:left;vertical-align:top;border-bottom:1px solid #e5e7eb">${escapeHtml(field.label)}</th><td style="padding:8px 12px;vertical-align:top;border-bottom:1px solid #e5e7eb;white-space:pre-wrap">${escapeHtml(field.value)}</td></tr>`
  ).join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#172033"><h1 style="font-size:22px">Új céges érdeklődő</h1><table style="border-collapse:collapse;width:100%;max-width:760px"><tbody>${rows}</tbody></table></div>`;

  return { subject, text, html };
}