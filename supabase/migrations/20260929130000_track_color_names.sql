-- Track colors can carry a name ("Voz 1", "Pista"), edited in Ajustes → Pistas.
-- A stored value is {hue, intensity, name?} or {neutral: true, name?}; the name is
-- optional, a non-empty string of at most 40 characters.
CREATE OR REPLACE FUNCTION public.is_valid_color_spec(p_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_value IS NULL OR jsonb_typeof(p_value) <> 'object' THEN false
    WHEN p_value ? 'name' AND (
      jsonb_typeof(p_value -> 'name') <> 'string'
      OR length(btrim(p_value ->> 'name')) NOT BETWEEN 1 AND 40
    ) THEN false
    WHEN p_value ? 'neutral' THEN (p_value - 'name') = '{"neutral": true}'::jsonb
    ELSE jsonb_typeof(p_value -> 'hue') = 'number'
      AND (p_value ->> 'hue')::numeric = trunc((p_value ->> 'hue')::numeric)
      AND (p_value ->> 'hue')::numeric BETWEEN 0 AND 359
      AND p_value ->> 'intensity' IN ('suave', 'media', 'intensa')
      AND (SELECT count(*) FROM jsonb_object_keys(p_value - 'name')) = 2
  END;
$$;
