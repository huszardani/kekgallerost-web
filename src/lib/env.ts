export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  companyLeadNotificationEmail: process.env.COMPANY_LEAD_NOTIFICATION_EMAIL,
  emailFrom:
    process.env.RESEND_FROM_EMAIL ??
    process.env.EMAIL_FROM ??
    "Kekgalleros.hu <info@kekgallerost.hu>",
  emailTestToken: process.env.EMAIL_TEST_TOKEN,
  emailTestTo: process.env.EMAIL_TEST_TO,
  applicationNotificationAdminEmail: process.env.APPLICATION_NOTIFICATION_ADMIN_EMAIL,
  applicationEmailRetrySecret: process.env.APPLICATION_EMAIL_RETRY_SECRET,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://kekgallerost.hu"
};