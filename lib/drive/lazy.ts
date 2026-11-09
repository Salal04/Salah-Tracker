export async function fetchRequestedDriveFiles<T>(index: Record<string, string>, requestedDates: string[], fetchFile: (id: string, date: string) => Promise<T>): Promise<Record<string, T>> {
  const unique = [...new Set(requestedDates)];
  const values = await Promise.all(unique.filter((date) => !!index[date]).map(async (date) => [date, await fetchFile(index[date], date)] as const));
  return Object.fromEntries(values);
}
