import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { isAllowedJobImage, sanitizeFilename } from "@/lib/recruitment";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const mediaKinds = new Set(["hero", "gallery", "social"]);
function numberBetween(value: FormDataEntryValue | number | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, Math.round(parsed))) : fallback;
}
function imageSignature(file: File, buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value, index) => bytes[index] === value);
  if (file.type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (file.type === "image/avif") return String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavif");
  return false;
}

export async function POST(request: Request) {
  await requireRole("admin");
  const formData = await request.formData();
  const jobId = String(formData.get("job_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const altText = String(formData.get("alt_text") ?? "").trim().slice(0, 300);
  const file = formData.get("file");
  if (!jobId || !mediaKinds.has(kind) || !(file instanceof File) || !isAllowedJobImage(file)) return NextResponse.json({ error: "Érvénytelen kép vagy médiaadat." }, { status: 400 });
  const buffer = await file.arrayBuffer();
  if (!imageSignature(file, buffer)) return NextResponse.json({ error: "A fájl tartalma nem egyezik a kép típusával." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).single();
  if (!job) return NextResponse.json({ error: "Az állás nem található." }, { status: 404 });
  const storagePath = `jobs/${jobId}/${kind}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage.from("job-media").upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "A kép nem tölthető fel." }, { status: 500 });
  const { data: publicUrl } = supabase.storage.from("job-media").getPublicUrl(storagePath);

  if (kind !== "gallery") {
    const { data: existing } = await supabase.from("job_media").select("id, storage_path").eq("job_id", jobId).eq("kind", kind);
    const paths = (existing ?? []).map((item) => item.storage_path).filter((path): path is string => Boolean(path));
    if (paths.length) await supabase.storage.from("job-media").remove(paths);
    if (existing?.length) await supabase.from("job_media").delete().in("id", existing.map((item) => item.id));
  }

  const focusX = numberBetween(formData.get("focus_x"), 50);
  const focusY = numberBetween(formData.get("focus_y"), 50);
  const { data: media, error } = await supabase.from("job_media").insert({
    job_id: jobId,
    kind: kind as "hero" | "gallery" | "social",
    storage_bucket: "job-media",
    storage_path: storagePath,
    url: publicUrl.publicUrl,
    alt_text: altText || (kind === "social" ? "Közösségi megosztási előnézet" : "Álláshirdetés képe"),
    focus_x: focusX,
    focus_y: focusY,
    sort_order: Math.max(0, Number(formData.get("sort_order") ?? 0) || 0)
  }).select("*").single();
  if (error || !media) {
    await supabase.storage.from("job-media").remove([storagePath]);
    return NextResponse.json({ error: "A kép adatai nem menthetők." }, { status: 500 });
  }
  if (kind === "hero") await supabase.from("jobs").update({ hero_image_url: media.url, hero_image_alt: media.alt_text, hero_focus_x: focusX, hero_focus_y: focusY }).eq("id", jobId);
  if (kind === "social") await supabase.from("jobs").update({ social_image_url: media.url }).eq("id", jobId);
  return NextResponse.json({ media }, { status: 201 });
}

export async function PATCH(request: Request) {
  await requireRole("admin");
  const input = await request.json() as { id?: string; altText?: string; focusX?: number; focusY?: number; sortOrder?: number };
  if (!input.id) return NextResponse.json({ error: "Hiányzó médiaazonosító." }, { status: 400 });
  const supabase = createServiceSupabaseClient();
  const { data: current } = await supabase.from("job_media").select("*").eq("id", input.id).single();
  if (!current) return NextResponse.json({ error: "A kép nem található." }, { status: 404 });
  const payload = {
    alt_text: String(input.altText ?? current.alt_text).trim().slice(0, 300),
    focus_x: numberBetween(input.focusX, current.focus_x),
    focus_y: numberBetween(input.focusY, current.focus_y),
    sort_order: Math.max(0, Number(input.sortOrder ?? current.sort_order) || 0)
  };
  const { data: media, error } = await supabase.from("job_media").update(payload).eq("id", current.id).select("*").single();
  if (error || !media) return NextResponse.json({ error: "A kép adatai nem menthetők." }, { status: 500 });
  if (current.kind === "hero") await supabase.from("jobs").update({ hero_image_alt: media.alt_text, hero_focus_x: media.focus_x, hero_focus_y: media.focus_y }).eq("id", current.job_id);
  return NextResponse.json({ media });
}

export async function DELETE(request: Request) {
  await requireRole("admin");
  const input = await request.json() as { id?: string };
  if (!input.id) return NextResponse.json({ error: "Hiányzó médiaazonosító." }, { status: 400 });
  const supabase = createServiceSupabaseClient();
  const { data: current } = await supabase.from("job_media").select("*").eq("id", input.id).single();
  if (!current) return NextResponse.json({ ok: true });
  if (current.storage_path) await supabase.storage.from("job-media").remove([current.storage_path]);
  const { error } = await supabase.from("job_media").delete().eq("id", current.id);
  if (error) return NextResponse.json({ error: "A kép nem törölhető." }, { status: 500 });
  if (current.kind === "hero") await supabase.from("jobs").update({ hero_image_url: null, hero_image_alt: null }).eq("id", current.job_id);
  if (current.kind === "social") await supabase.from("jobs").update({ social_image_url: null }).eq("id", current.job_id);
  return NextResponse.json({ ok: true });
}
