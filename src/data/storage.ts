import { supabase } from "@/lib/supabaseClient";

export type UploadResult = {
  url: string;
  filename: string;
  size: number;
};

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
