"use client";

import Link from "next/link";
import { useState } from "react";
import type { JobQuestion, JobQuestionOption, Json } from "@/lib/supabase/database.types";

function legacyOptions(options: Json) {
  return Array.isArray(options) ? options.filter((item): item is string => typeof item === "string") : [];
}

function optionsFor(question: JobQuestion, allOptions: JobQuestionOption[]) {
  const normalized = allOptions.filter((option) => option.question_id === question.id).sort((a, b) => a.sort_order - b.sort_order);
  return normalized.length ? normalized.map((option) => ({ value: option.value, label: option.label })) : legacyOptions(question.options).map((option) => ({ value: option, label: option }));
}

function QuestionField({ question, options }: { question: JobQuestion; options: Array<{ value: string; label: string }> }) {
  const name = `question_${question.id}`;
  const id = `${name}_field`;
  const required = question.is_required;
  const label = <>{question.question_text}{required ? " *" : ""}</>;
  const help = question.help_text ? <small id={`${id}_help`}>{question.help_text}</small> : null;
  const describedBy = question.help_text ? `${id}_help` : undefined;

  if (question.question_type === "radio" || question.question_type === "multiselect" || question.question_type === "boolean") {
    const choices = question.question_type === "boolean" ? [{ value: "true", label: "Igen" }, { value: "false", label: "Nem" }] : options;
    return <fieldset aria-describedby={describedBy} className="question-fieldset"><legend>{label}</legend><div className="choice-list">{choices.map((option, index) => <label className="checkbox-label" key={option.value}><input name={name} required={required && (question.question_type !== "multiselect" || index === 0)} type={question.question_type === "multiselect" ? "checkbox" : "radio"} value={option.value} /> <span>{option.label}</span></label>)}</div>{help}</fieldset>;
  }

  if (question.question_type === "checkbox") return <fieldset className="question-fieldset"><legend>{label}</legend><label className="checkbox-label"><input aria-describedby={describedBy} name={name} required={required} type="checkbox" value="true" /> <span>Igen</span></label>{help}</fieldset>;
  if (question.question_type === "textarea") return <label htmlFor={id}>{label}<textarea aria-describedby={describedBy} id={id} name={name} required={required} rows={5} />{help}</label>;
  if (question.question_type === "select") return <label htmlFor={id}>{label}<select aria-describedby={describedBy} id={id} name={name} required={required}><option value="">Válassz</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{help}</label>;
  if (question.question_type === "file" || question.question_type === "resume") return <label htmlFor={id}>{label}<input accept={question.question_type === "resume" ? ".pdf,.doc,.docx" : ".pdf,.doc,.docx,.jpg,.jpeg,.png"} aria-describedby={describedBy} id={id} name={`file_${question.id}`} required={required} type="file" />{help}</label>;
  const type = question.question_type === "number" ? "number" : question.question_type === "date" ? "date" : question.question_type === "email" ? "email" : question.question_type === "phone" ? "tel" : "text";
  return <label htmlFor={id}>{label}<input aria-describedby={describedBy} id={id} inputMode={type === "number" ? "decimal" : undefined} name={name} required={required} type={type} />{help}</label>;
}

export default function ApplicationForm({ jobId, questions, questionOptions, resumeEnabled }: { jobId: string; questions: JobQuestion[]; questionOptions: JobQuestionOption[]; resumeEnabled: boolean }) {
  const [state, setState] = useState<{ status: "idle" | "sending" | "success" | "error"; message?: string }>({ status: "idle" });
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "sending" });
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/applications", { method: "POST", body: new FormData(form) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) { setState({ status: "error", message: result.error ?? "A jelentkezés nem küldhető el." }); return; }
      form.reset();
      setState({ status: "success", message: "Köszönjük! A jelentkezésed megérkezett, a visszaigazolást e-mailben küldjük." });
    } catch {
      setState({ status: "error", message: "Hálózati hiba történt. Ellenőrizd a kapcsolatot, majd próbáld újra." });
    }
  }
  if (state.status === "success") return <div className="panel success-panel" role="status"><h2>Sikeres jelentkezés</h2><p>{state.message}</p></div>;
  return <form aria-busy={state.status === "sending"} className="panel form-stack application-form" encType="multipart/form-data" onSubmit={submit}>
    <input name="job_id" type="hidden" value={jobId} />
    <label aria-hidden="true" className="honeypot">Weboldal<input autoComplete="off" name="website" tabIndex={-1} /></label>
    <h2>Jelentkezés</h2><p className="muted-text">A csillaggal jelölt mezők kitöltése kötelező.</p>
    <label htmlFor="applicant_name">Név *<input autoComplete="name" id="applicant_name" maxLength={150} name="applicant_name" required /></label>
    <label htmlFor="applicant_email">E-mail-cím *<input autoComplete="email" id="applicant_email" maxLength={254} name="applicant_email" required type="email" /></label>
    <label htmlFor="applicant_phone">Telefonszám<input autoComplete="tel" id="applicant_phone" maxLength={50} name="applicant_phone" type="tel" /></label>
    {questions.map((question) => <QuestionField key={question.id} options={optionsFor(question, questionOptions)} question={question} />)}
    {resumeEnabled ? <label htmlFor="resume_file">Önéletrajz (opcionális)<input accept=".pdf,.doc,.docx" id="resume_file" name="resume_file" type="file" /><small>PDF, DOC vagy DOCX; legfeljebb 10 MB. A dokumentum privát tárhelyre kerül.</small></label> : null}
    <label className="checkbox-label consent-row"><input name="consent_accepted" required type="checkbox" /> <span>Elolvastam és elfogadom az <Link href="/jogi-dokumentumok" target="_blank">adatkezelési tájékoztatót</Link>. *</span></label>
    {state.status === "error" ? <p className="alert error" role="alert">{state.message}</p> : null}
    <button className="button" disabled={state.status === "sending"} type="submit">{state.status === "sending" ? "Küldés…" : "Jelentkezés elküldése"}</button>
  </form>;
}
