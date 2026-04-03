const SLUG_PATTERN = /^[a-z0-9-]+$/;

const VALIDATION_ERRORS = {
  TITLE_REQUIRED: "El título es obligatorio",
  SLUG_REQUIRED: "El slug es obligatorio",
  SLUG_INVALID: "El slug solo puede contener letras minúsculas, números y guiones",
  TRACKS_REQUIRED: "Debe haber al menos una pista de audio"
} as const;

export function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateSongForm(formData: {
  title: string;
  slug: string;
  audio_tracks: unknown[];
}): {
  isValid: boolean;
  errors: { title: string; slug: string; audio_tracks: string };
} {
  const errors = { title: "", slug: "", audio_tracks: "" };
  let isValid = true;

  if (!formData.title.trim()) {
    errors.title = VALIDATION_ERRORS.TITLE_REQUIRED;
    isValid = false;
  }

  if (!formData.slug.trim()) {
    errors.slug = VALIDATION_ERRORS.SLUG_REQUIRED;
    isValid = false;
  } else if (!SLUG_PATTERN.test(formData.slug)) {
    errors.slug = VALIDATION_ERRORS.SLUG_INVALID;
    isValid = false;
  }

  if (formData.audio_tracks.length === 0) {
    errors.audio_tracks = VALIDATION_ERRORS.TRACKS_REQUIRED;
    isValid = false;
  }

  return { isValid, errors };
}
