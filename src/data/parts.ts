import type { CollectionPart } from "@/data/types";
import { supabase } from "@/lib/supabaseClient";
import type { ColorSpec, Intensity } from "@/utils/palette";

function partsError(error: { message: string; code?: string }): Error {
  if (error.code === "23503" || error.message.includes("PART_IN_USE")) {
    return new Error(
      "No se puede eliminar una parte que usan versos, pistas u otras partes. Quitá esas referencias primero."
    );
  }
  if (error.code === "42501" || error.message === "FORBIDDEN") {
    return new Error("No tenés permiso para modificar las partes.");
  }
  return new Error(`No se pudieron guardar o cargar las partes: ${error.message}`);
}

export async function fetchCollectionParts(collectionId: number): Promise<CollectionPart[]> {
  const { data, error } = await supabase
    .from("collection_parts")
    .select("*")
    .eq("collection_id", collectionId)
    .order("order")
    .order("id");
  if (error) throw partsError(error);
  return data as CollectionPart[];
}

/** Atomic replacement; collection_id is assigned and validated by the server. */
export async function updateCollectionMusic(
  collectionId: number,
  parts: CollectionPart[],
  palette: {
    hue: number;
    intensity: Intensity;
    trackColors: Record<string, ColorSpec>;
    keyMap: Record<string, string>;
  }
): Promise<void> {
  const { error } = await supabase.rpc("update_collection_music", {
    p_collection_id: collectionId,
    p_hue: palette.hue,
    p_intensity: palette.intensity,
    p_track_colors: palette.trackColors,
    p_key_map: palette.keyMap,
    p_parts: parts.map(({ id, name, color_key, parent_id }, order) => ({
      id,
      name: name.trim(),
      color_key,
      parent_id,
      order
    }))
  });
  if (error) throw partsError(error);
}
