import { supabase } from "@/integrations/supabase/client";

const BUCKET = "worker-photos";

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadWorkerPhoto(workerId: string, file: File) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = auth.user?.id;
  if (!userId) throw new Error("फोटो सेव करने के लिए लॉगिन ज़रूरी है।");

  const path = `${userId}/${workerId}/profile-${Date.now()}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createWorkerPhotoUrls(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return {} as Record<string, string>;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(uniquePaths, 3600);
  if (error) throw error;

  return (data ?? []).reduce<Record<string, string>>((urls, item) => {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
    return urls;
  }, {});
}

export async function removeWorkerPhoto(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}