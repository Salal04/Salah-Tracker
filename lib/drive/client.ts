import type { GoogleDriveFile, TrackerDayBackup, TrackerSummary } from "@/lib/types";

type DriveFetchOptions = {
  errorMessage?: string;
  allowedStatuses?: number[];
};

type DriveFetchResult = {
  response: Response;
  status: number;
  etag: string | null;
};

export type DriveJsonResult<T> = {
  data: T | undefined;
  status: number;
  etag: string | null;
};

const driveFetch = async (
  token: string,
  url: string,
  init: RequestInit = {},
  options: DriveFetchOptions = {},
): Promise<DriveFetchResult> => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  const status = response.status;
  const etag = response.headers.get("ETag");
  if (!response.ok && !options.allowedStatuses?.includes(status)) {
    throw new Error(options.errorMessage || `Google Drive request failed with status ${status}.`);
  }
  return { response, status, etag };
};

const readDriveJson = async <T>(
  token: string,
  fileId: string,
  errorMessage: string,
  allowedStatuses: number[] = [],
): Promise<DriveJsonResult<T>> => {
  const { response, status, etag } = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {},
    { errorMessage, allowedStatuses },
  );
  const data = response.ok ? await response.json() as T : undefined;
  return { data, status, etag };
};

export const downloadDriveJson = <T>(token: string, fileId: string, errorMessage: string, allowedStatuses: number[] = []) =>
  readDriveJson<T>(token, fileId, errorMessage, allowedStatuses);

export const uploadDriveJson = async (
  token: string,
  fileId: string | null,
  name: string,
  data: TrackerDayBackup | TrackerSummary,
): Promise<string> => {
  if (fileId) {
    await driveFetch(
      token,
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) },
      { errorMessage: `Could not update ${name}.` },
    );
    return fileId;
  }

  const metadata = { name, mimeType: "application/json" };
  const boundary = `salah_tracker_${Date.now()}`;
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
  const { response } = await driveFetch(
    token,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body },
    { errorMessage: `Could not create ${name}.` },
  );
  return (await response.json() as GoogleDriveFile).id;
};

export const listDriveFiles = async (
  token: string,
  query: string,
  pageSize: number,
  errorMessage: string,
): Promise<GoogleDriveFile[]> => {
  const encodedQuery = encodeURIComponent(query);
  const { response } = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${encodedQuery}&fields=files(id,name)&pageSize=${pageSize}`,
    {},
    { errorMessage },
  );
  return (await response.json() as { files?: GoogleDriveFile[] }).files || [];
};

export const findDriveFileByName = async (token: string, name: string): Promise<GoogleDriveFile | undefined> => {
  const query = `name='${name}' and trashed=false`;
  return (await listDriveFiles(token, query, 10, "Could not look for your tracker in Drive."))[0];
};

export const renameDriveFile = async (token: string, fileId: string, name: string): Promise<void> => {
  await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) },
    { errorMessage: "Could not organize your tracker files in Drive." },
  );
};
