export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom:
    process.env.EMAIL_FROM ??
    process.env.RESEND_FROM_EMAIL ??
    "Kekgalleros.hu <info@kekgallerost.hu>",
  emailTestToken: process.env.EMAIL_TEST_TOKEN,
  emailTestTo: process.env.EMAIL_TEST_TO,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://kekgallerost.hu"
};