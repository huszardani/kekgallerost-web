import type { Database } from "@/lib/supabase/database.types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CompanyLeadInsert = Database["public"]["Tables"]["company_leads"]["Insert"];

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function text(body: Record<string, unknown>, key: string, maxLength: number) {
  const value = body[key];
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function textList(body: Record<string, unknown>, key: string, maxItems = 20, maxLength = 200) {
  const value = body[key];
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems)
    .map((item) => typeof item === "string" ? item.trim().slice(0, maxLength) : "")
    .filter(Boolean);
}

export function validateCompanyLead(input: unknown): { lead: CompanyLeadInsert; error?: never } | { lead?: never; error: string } {
  const body = record(input);
  const lead: CompanyLeadInsert = {
    request_id: text(body, "requestId", 36),
    company: text(body, "company", 200),
    contact_name: text(body, "contactName", 200),
    email: text(body, "email", 254).toLowerCase(),
    phone: text(body, "phone", 80),
    call_time: text(body, "callTime", 100) || null,
    role: text(body, "role", 200),
    headcount: Number(body.headcount),
    location: text(body, "location", 300),
    start_urgency: text(body, "startUrgency", 100),
    shifts: textList(body, "shift"),
    has_salary: text(body, "hasSalary", 100),
    salary: text(body, "salary", 200) || null,
    requirements: textList(body, "requirements"),
    must_know: text(body, "mustKnow", 5000) || null,
    main_problems: textList(body, "mainProblem"),
    advertised_before: text(body, "advertisedBefore", 100) || null,
    package: text(body, "package", 200) || null,
    notes: text(body, "notes", 5000) || null,
    status: "new",
    source: "company_interest_form"
  };

  const requiredText = [lead.company, lead.contact_name, lead.email, lead.phone, lead.role, lead.location, lead.start_urgency, lead.has_salary];
  if (!UUID_PATTERN.test(lead.request_id)
    || requiredText.some((item) => !item)
    || !EMAIL_PATTERN.test(lead.email)
    || !Number.isInteger(lead.headcount)
    || lead.headcount < 1
    || lead.shifts.length === 0
    || lead.main_problems.length === 0) {
    return { error: "Kérjük, töltsd ki az összes kötelező mezőt." };
  }

  return { lead };
}