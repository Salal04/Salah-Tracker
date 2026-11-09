import type { GoogleDriveFile, TrackerDayBackup, TrackerSummary } from "../types";

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
  version?: string | null;
};

export class DriveHttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "DriveHttpError"; }
}

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
    throw new DriveHttpError(status, options.errorMessage || `Google Drive request failed with status ${status}.`);
  }
  return { response, status, etag };
};

const readDriveJson = async <T>(
  token: string,
  fileId: string,
  errorMessage: string,
  allowedStatuses: number[] = [],
): Promise<DriveJsonResult<T>> => {
  const metadata = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,version`, {}, { errorMessage, allowedStatuses });
  if (!metadata.response.ok) return { data: undefined, status: metadata.status, etag: metadata.etag, version: null };
  const { response, status, etag } = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {},
    { errorMessage, allowedStatuses },
  );
  const data = response.ok ? await response.json() as T : undefined;
  const version = data && typeof data === "object" && "version" in data ? String((data as { version: unknown }).version) : null;
  return { data, status, etag: etag || metadata.etag, version: metadata.response.ok ? version || (await metadata.response.json() as { version?: string | number }).version?.toString() || null : null };
};

export const downloadDriveJson = <T>(token: string, fileId: string, errorMessage: string, allowedStatuses: number[] = []) =>
  readDriveJson<T>(token, fileId, errorMessage, allowedStatuses);

export const uploadDriveJson = async (
  token: string,
  fileId: string | null,
  name: string,
  data: TrackerDayBackup | TrackerSummary,
  etag?: string | null,
  parentId?: string,
): Promise<string> => {
  if (fileId) {
    await driveFetch(
      token,
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
      { method: "PATCH", headers: { "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) }, body: JSON.stringify(data) },
      { errorMessage: `Could not update ${name}.` },
    );
    return fileId;
  }

  const metadata = { name, mimeType: "application/json", ...(parentId ? { parents: [parentId] } : {}) };
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

export const uploadDriveJsonVersioned = async <T>(token: string, fileId: string, name: string, data: T, etag?: string | null): Promise<{ id: string; etag: string | null; version: string | null }> => {
  const { response, etag: nextEtag } = await driveFetch(
    token,
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,version`,
    { method: "PATCH", headers: { "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) }, body: JSON.stringify(data) },
    { errorMessage: `Could not update ${name}.` },
  );
  const result = await response.json().catch(() => ({})) as { id?: string; version?: string | number };
  return { id: result.id || fileId, etag: nextEtag, version: result.version === undefined ? null : String(result.version) };
};

export const createDriveFolder = async (token: string, name: string): Promise<GoogleDriveFile> => {
  const { response } = await driveFetch(token, "https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
  }, { errorMessage: "Could not create the Salah Tracker folder in Drive." });
  return await response.json() as GoogleDriveFile;
};

export const findDriveFileInFolder = async (token: string, name: string, parentId: string): Promise<GoogleDriveFile | undefined> => {
  const escaped = name.replace(/'/g, "\\'");
  return (await listDriveFiles(token, `name='${escaped}' and '${parentId}' in parents and trashed=false`, 10, "Could not look for your Qaza data in Drive."))[0];
};

export const createDriveJsonInFolder = async <T>(token: string, name: string, data: T, parentId: string): Promise<string> => {
  const metadata = { name, mimeType: "application/json", parents: [parentId] };
  const boundary = `salah_qaza_${Date.now()}`;
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
  const { response } = await driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body,
  }, { errorMessage: `Could not create ${name} in Drive.` });
  return (await response.json() as GoogleDriveFile).id;
};

export async function updateDriveJsonWithRetry<T>(args: {
  token: string; fileId: string; name: string; data: T; etag?: string | null;
  merge: (remote: T, local: T) => T;
}): Promise<{ data: T; etag: string | null; version: string | null }> {
  let currentEtag = args.etag;
  let currentData = args.data;
  if (!currentEtag) {
    const current = await downloadDriveJson<T>(args.token, args.fileId, `Could not check ${args.name} before updating.`);
    if (current.data !== undefined) { currentData = args.merge(current.data, args.data); currentEtag = current.etag; }
  }
  try {
    const result = await uploadDriveJsonVersioned(args.token, args.fileId, args.name, currentData, currentEtag);
    return { data: currentData, etag: result.etag, version: result.version };
  } catch (error) {
    if (!(error instanceof DriveHttpError) || error.status !== 412) throw error;
    const latest = await downloadDriveJson<T>(args.token, args.fileId, `Could not reload ${args.name} after a conflict.`);
    if (!latest.data) throw new Error(`Could not merge ${args.name} after a conflict.`);
    const data = args.merge(latest.data, currentData);
    const result = await uploadDriveJsonVersioned(args.token, args.fileId, args.name, data, latest.etag);
    return { data, etag: result.etag, version: result.version };
  }
}

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

export const findDriveFolderByName = async (token: string, name: string): Promise<GoogleDriveFile | undefined> => {
  const escaped = name.replace(/'/g, "\\'");
  return (await listDriveFiles(token, `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, 10, "Could not find the Salah Tracker folder in Drive."))[0];
};

export const renameDriveFile = async (token: string, fileId: string, name: string, etag?: string | null): Promise<void> => {
  await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    { method: "PATCH", headers: { "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) }, body: JSON.stringify({ name }) },
    { errorMessage: "Could not organize your tracker files in Drive." },
  );
};
