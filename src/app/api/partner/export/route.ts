import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Nincs bejelentkezve." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", userData.user.id)
    .single();
  if (!profile || profile.role !== "partner" || !profile.company_id) {
    return NextResponse.json({ error: "Partner jogosultság szükséges." }, { status: 403 });
  }

  const { data: jobs, error: jobsError } = await supabase.from("jobs").select("id, title").order("title");
  if (jobsError) return NextResponse.json({ error: jobsError.message }, { status: 500 });
  const jobIds = jobs.map((job) => job.id);
  const { data: applications, error: applicationsError } = jobIds.length
    ? await supabase.from("applications").select("*").in("job_id", jobIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (applicationsError) return NextResponse.json({ error: applicationsError.message }, { status: 500 });

  const applicationIds = applications.map((application) => application.id);
  const { data: answers, error: answersError } = applicationIds.length
    ? await supabase.from("application_answers").select("application_id, answer_text, answer_json").in("application_id", applicationIds)
    : { data: [], error: null };
  if (answersError) return NextResponse.json({ error: answersError.message }, { status: 500 });

  const rows = [
    ["Állás", "Név", "E-mail", "Telefon", "Státusz", "Megjegyzés", "Visszahívás", "Jelentkezett", "Válaszok"],
    ...applications.map((application) => {
      const job = jobs.find((item) => item.id === application.job_id);
      const answerText = answers
        .filter((answer) => answer.application_id === application.id)
        .map((answer) => answer.answer_text ?? JSON.stringify(answer.answer_json))
        .join(" | ");
      return [
        job?.title ?? "", application.applicant_name, application.applicant_email,
        application.applicant_phone ?? "", application.status, application.partner_note ?? "",
        application.callback_at ?? "", application.created_at, answerText
      ];
    })
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jelentkezok-${date}.csv"`,
      "Cache-Control": "private, no-store"
    }
  });
}

