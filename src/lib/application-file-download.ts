export type ApplicationFileProfile = {
  role: "admin" | "partner";
  company_id: string | null;
};

export type ApplicationFileDownloadDependencies = {
  getFile: (fileId: string) => Promise<{ applicationId: string; storageBucket: string; storagePath: string } | null>;
  getApplication: (applicationId: string) => Promise<{ jobId: string } | null>;
  getJob: (jobId: string, companyId: string) => Promise<{ companyId: string } | null>;
  createSignedUrl: (bucket: string, path: string) => Promise<string | null>;
};

export type ApplicationFileDownloadResult =
  | { kind: "signed"; signedUrl: string }
  | { kind: "error"; status: 400 | 401 | 403 | 404; error: string };

const notFound = (): ApplicationFileDownloadResult => ({ kind: "error", status: 404, error: "A fájl nem található." });

export async function authorizeApplicationFileDownload(
  profile: ApplicationFileProfile | null,
  fileId: string,
  dependencies: ApplicationFileDownloadDependencies
): Promise<ApplicationFileDownloadResult> {
  if (!profile) return { kind: "error", status: 401, error: "Nincs bejelentkezve." };
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return { kind: "error", status: 400, error: "Érvénytelen fájlazonosító." };
  if (profile.role !== "admin" && !profile.company_id) return notFound();

  const file = await dependencies.getFile(fileId);
  if (!file || file.storageBucket !== "application-files") return notFound();

  const application = await dependencies.getApplication(file.applicationId);
  if (!application || !file.storagePath.startsWith(`applications/${file.applicationId}/`)) return notFound();

  if (profile.role === "partner") {
    const job = await dependencies.getJob(application.jobId, profile.company_id!);
    if (!job || job.companyId !== profile.company_id) return notFound();
  }

  const signedUrl = await dependencies.createSignedUrl(file.storageBucket, file.storagePath);
  return signedUrl
    ? { kind: "signed", signedUrl }
    : { kind: "error", status: 403, error: "A letöltési link nem hozható létre." };
}
