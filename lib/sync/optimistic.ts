export async function commitOptimistically<T>(args: {
  apply: () => void;
  persistLocal: () => Promise<T> | T;
  rollback: () => void;
  enqueueDrive?: () => Promise<unknown> | unknown;
}): Promise<T> {
  args.apply();
  let result: T;
  try { result = await args.persistLocal(); }
  catch (error) { args.rollback(); throw error; }
  try { await args.enqueueDrive?.(); } catch { /* Local data remains authoritative while Drive is queued for retry. */ }
  return result;
}
