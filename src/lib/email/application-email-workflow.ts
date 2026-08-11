export async function runPostPersistenceEmailWorkflow(run: () => Promise<unknown>) {
  try {
    await run();
    return { emailStatus: "completed" as const };
  } catch {
    return { emailStatus: "pending" as const };
  }
}
