declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const DRIVE_CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID as string | undefined;
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Ashapura Samrat Backup";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

let scriptPromise: Promise<void> | null = null;

function requireClientId(): string {
  if (!DRIVE_CLIENT_ID) {
    throw new Error("Google Drive OAuth Client ID missing");
  }
  return DRIVE_CLIENT_ID;
}

function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google OAuth script failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google OAuth script failed"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function getDriveToken(): Promise<string> {
  const clientId = requireClientId();
  await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      prompt: "consent",
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        if (!response.access_token) {
          reject(new Error("Google Drive token not received"));
          return;
        }
        resolve(response.access_token);
      },
    });
    tokenClient?.requestAccessToken({ prompt: "consent" });
  });
}

async function driveFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Google Drive error ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

async function ensureBackupFolder(token: string): Promise<string> {
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME.replace(/'/g, "\\'")}' and trashed=false`);
  const found = await driveFetch<{ files: { id: string; name: string }[] }>(token, `/files?q=${q}&spaces=drive&fields=files(id,name)&pageSize=10`);
  const existing = found.files?.[0]?.id;
  if (existing) return existing;
  const created = await driveFetch<{ id: string }>(token, "/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  return created.id;
}

export async function uploadBackupToGoogleDrive(filename: string, fileText: string): Promise<{ id: string; name: string }> {
  const token = await getDriveToken();
  const folderId = await ensureBackupFolder(token);
  const boundary = `ashapura_${Date.now()}`;
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: "application/json",
    appProperties: { app: "AshapuraSamrat", type: "backup" },
  };
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    fileText,
    `--${boundary}--`,
  ].join("\r\n");
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Google Drive upload failed ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function downloadLatestBackupFromGoogleDrive(): Promise<{ name: string; text: string }> {
  const token = await getDriveToken();
  const folderId = await ensureBackupFolder(token);
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and name contains 'AshapuraSamrat_Backup_'`);
  const list = await driveFetch<{ files: { id: string; name: string; modifiedTime: string }[] }>(
    token,
    `/files?q=${q}&spaces=drive&orderBy=modifiedTime desc&pageSize=1&fields=files(id,name,modifiedTime)`,
  );
  const file = list.files?.[0];
  if (!file) throw new Error("Google Drive backup not found");
  const res = await fetch(`${DRIVE_API}/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google Drive download failed ${res.status}: ${await res.text()}`);
  return { name: file.name, text: await res.text() };
}