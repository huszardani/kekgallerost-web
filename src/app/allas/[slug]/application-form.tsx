"use client";

import { useState } from "react";
import type { JobQuestion, Json } from "@/lib/supabase/database.types";

function optionsFromJson(options: Json) {
  return Array.isArray(options) ? options.filter((item): item is string => typeof item === "string") : [];
}

function QuestionField({ question }: { question: JobQuestion }) {
  const name = `question_${question.id}`;
  const options = optionsFromJson(question.options);
  const common = { id: name, name, required: question.is_required };

  if (question.question_type === "textarea") return <textarea {...common} rows={5} />;
  if (question.question_type === "select") return <select {...common}><option value="">Válassz</option>{options.map((option) => <option key={option}>{option}</option>)}</select>;
  if (question.question_type === "multiselect") return <div className="choice-list">{options.map((option) => <label className="checkbox-label" key={option}><input name={name} type="checkbox" value={option} /> {option}</label>)}</div>;
  if (question.question_type === "boolean") return <select {...common}><option value="">Válassz</option><option value="true">Igen</option><option value="false">Nem</option></select>;
  if (question.question_type === "file") return <input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" id={`file_${question.id}`} name={`file_${question.id}`} required={question.is_required} type="file" />;
  return <input {...common} type={question.question_type === "email" ? "email" : question.question_type === "phone" ? "tel" : "text"} />;
}

export default function ApplicationForm({ jobId, questions }: { jobId: string; questions: JobQuestion[] }) {
  const [state, setState] = useState<{ status: "idle" | "sending" | "success" | "error"; message?: string }>({ status: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "sending" });
    const form = event.currentTarget;
    const response = await fetch("/api/applications", { method: "POST", body: new FormData(form) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setState({ status: "error", message: result.error ?? "A jelentkezés nem küldhető el." });
      return;
    }
    form.reset();
    setState({ status: "success", message: "Köszönjük! A jelentkezésed megérkezett." });
  }

  if (state.status === "success") return <div className="panel success-panel" role="status"><h2>Sikeres jelentkezés</h2><p>{state.message}</p></div>;

  return (
    <form className="panel form-stack application-form" encType="multipart/form-data" onSubmit={submit}>
      <input name="job_id" type="hidden" value={jobId} />
      <label className="honeypot" aria-hidden="true">Weboldal<input autoComplete="off" name="website" tabIndex={-1} /></label>
      <h2>Jelentkezés</h2>
      <label>Név *<input autoComplete="name" name="applicant_name" required /></label>
      <label>E-mail-cím *<input autoComplete="email" name="applicant_email" required type="email" /></label>
      <label>Telefonszám<input autoComplete="tel" name="applicant_phone" type="tel" /></label>
      {questions.map((question) => (
        <label key={question.id}>{question.question_text}{question.is_required ? " *" : ""}<QuestionField question={question} />{question.help_text ? <small>{question.help_text}</small> : null}</label>
      ))}
      <label className="checkbox-label consent-row"><input name="consent_accepted" required type="checkbox" /> Elfogadom az adatkezelési tájékoztatóban foglaltakat. *</label>
      <p className="muted-text file-note">Fájlonként legfeljebb 10 MB; PDF, Word vagy kép tölthető fel.</p>
      {state.status === "error" ? <p className="alert error" role="alert">{state.message}</p> : null}
      <button className="button" disabled={state.status === "sending"} type="submit">{state.status === "sending" ? "Küldés…" : "Jelentkezés elküldése"}</button>
    </form>
  );
}

