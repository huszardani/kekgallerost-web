export async function runPostPersistenceEmailWorkflow(run: () => Promise<unknown>) {
  try {
    await run();
    return { emailStatus: "completed" as const };
  } catch {
    return { emailStatus: "pending" as const };
  }
}

export async function runPostPersistenceEmailTransition(
  markRequested: () => Promise<unknown>,
  enqueueAndProcess: () => Promise<unknown>,
) {
  let pending = false;
  try { await markRequested(); } catch { pending = true; }
  try { await enqueueAndProcess(); } catch { pending = true; }
  return { emailStatus: pending ? "pending" as const : "completed" as const };
}
