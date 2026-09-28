import { supabase } from "@/lib/supabaseClient";

export type UploadResult = {
  url: string;
  filename: string;
  size: number;
};

const AUDIO_BUCKET = "audio-files";

const generateRandomSuffix = (): string => {
  return Math.random().toString(36).substring(2, 8);
};

/**
 * Uploads a file to Supabase Storage
 * This is completely client-side and handles authentication through Supabase
 */
export const uploadFile = async (
  file: File,
  filename: string,
  options: {
    bucket: string;
    addRandomSuffix?: boolean;
  }
): Promise<UploadResult> => {
  try {
    const bucketName = options.bucket;

    // Generate final filename
    let finalFilename = filename || file.name;
    if (options?.addRandomSuffix) {
      const extension = finalFilename.split(".").pop();
      const nameWithoutExt = finalFilename.substring(0, finalFilename.lastIndexOf("."));
      finalFilename = `${nameWithoutExt}-${generateRandomSuffix()}.${extension}`;
    }

    const { data, error } = await supabase.storage.from(bucketName).upload(finalFilename, file, {
      cacheControl: "3600",
      upsert: false
    });

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);

    return {
      url: publicUrlData.publicUrl,
      filename: data.path,
      size: file.size
    };
  } catch (error) {
    console.error("Upload failed:", error);
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

export const getPublicStoragePath = (
  url: string,
  bucket: string,
  expectedOrigin: string
): string | null => {
  try {
    const parsedUrl = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = parsedUrl.pathname.indexOf(marker);

    if (parsedUrl.origin !== expectedOrigin || markerIndex === -1) return null;

    return decodeURIComponent(parsedUrl.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
};

export const removeUnreferencedAudioFiles = async (urls: string[]): Promise<void> => {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  const storage = supabase.storage.from(AUDIO_BUCKET);
  const storageOrigin = new URL(storage.getPublicUrl("").data.publicUrl).origin;
  const pathsByUrl = new Map(
    uniqueUrls
      .map((url) => [url, getPublicStoragePath(url, AUDIO_BUCKET, storageOrigin)] as const)
      .filter((entry): entry is readonly [string, string] => entry[1] !== null)
  );

  if (pathsByUrl.size === 0) return;

  const { data: referencedTracks, error: referenceError } = await supabase
    .from("audio_tracks")
    .select("audio_file_url")
    .in("audio_file_url", [...pathsByUrl.keys()]);

  if (referenceError) throw referenceError;

  const referencedUrls = new Set(referencedTracks.map((track) => track.audio_file_url));
  const pathsToRemove = [...pathsByUrl]
    .filter(([url]) => !referencedUrls.has(url))
    .map(([, path]) => path);

  if (pathsToRemove.length === 0) return;

  const { error } = await storage.remove(pathsToRemove);
  if (error) throw error;
};
