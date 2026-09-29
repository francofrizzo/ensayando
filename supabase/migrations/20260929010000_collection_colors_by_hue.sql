-- Hue-based palette (design/fundamentos/paleta.html).
--
-- Collections store a hue (0–359) and an intensity (suave, normal, intensa);
-- track_colors values become {"hue": 195, "intensity": "normal"} or
-- {"neutral": true}. Every UI color is derived from them in the app
-- (src/utils/palette.ts). main_color is dropped.
--
-- Existing values are converted here, so the deploy is atomic. The parsing
-- mirrors parseLegacyColor() in src/utils/palette.ts and is checked against the
-- same fixtures (src/__fixtures__/legacy-colors.json, tests/db/hue-migration.check.ts).
-- Supported legacy formats: oklch(L C H) with L as number or percentage, and
-- #rgb / #rrggbb. Anything else becomes neutral (tracks) or the brand hue
-- (collections), with a notice.

create function pg_temp.color_to_spec(value text) returns jsonb
language plpgsql immutable as $$
declare
  m text[];
  hex text;
  r double precision; g double precision; b double precision;
  l double precision; mm double precision; s double precision;
  lab_a double precision; lab_b double precision;
  chroma double precision; hue double precision;
begin
  if value is null then
    return null;
  end if;

  m := regexp_match(value, '^\s*oklch\(\s*[0-9.]+%?\s+([0-9.]+)\s+([0-9.]+)(?:deg)?\s*(?:/[^)]*)?\)\s*$', 'i');
  if m is not null then
    chroma := m[1]::double precision;
    hue := m[2]::double precision;
  elsif value ~* '^\s*#([0-9a-f]{3}|[0-9a-f]{6})\s*$' then
    hex := lower(btrim(value));
    if length(hex) = 4 then
      hex := '#' || repeat(substr(hex, 2, 1), 2) || repeat(substr(hex, 3, 1), 2) || repeat(substr(hex, 4, 1), 2);
    end if;
    -- sRGB → linear → OKLab → chroma/hue (same constants as the TS mirror).
    r := ('x' || substr(hex, 2, 2))::bit(8)::int / 255.0;
    g := ('x' || substr(hex, 4, 2))::bit(8)::int / 255.0;
    b := ('x' || substr(hex, 6, 2))::bit(8)::int / 255.0;
    r := case when r <= 0.04045 then r / 12.92 else power((r + 0.055) / 1.055, 2.4) end;
    g := case when g <= 0.04045 then g / 12.92 else power((g + 0.055) / 1.055, 2.4) end;
    b := case when b <= 0.04045 then b / 12.92 else power((b + 0.055) / 1.055, 2.4) end;
    l := cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    mm := cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    s := cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    lab_a := 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s;
    lab_b := 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
    chroma := sqrt(lab_a * lab_a + lab_b * lab_b);
    hue := atan2d(lab_b, lab_a);
  else
    return null;
  end if;

  -- Same thresholds as chromaToSpec(): <0.04 neutral, ≤0.115 suave, ≤0.18 normal.
  if chroma < 0.04 then
    return '{"neutral": true}'::jsonb;
  end if;
  hue := mod(mod(round(hue)::numeric, 360) + 360, 360);
  return jsonb_build_object(
    'hue', hue::int,
    'intensity', case when chroma <= 0.115 then 'suave' when chroma <= 0.18 then 'normal' else 'intensa' end
  );
end;
$$;

alter table public.collections
  add column hue smallint,
  add column intensity text;

-- Collections: the main color's hue. A grey or unparseable main color falls back
-- to the brand violet (314), since a collection needs a hue.
do $$
declare
  rec record;
  spec jsonb;
begin
  for rec in select id, main_color from public.collections loop
    spec := pg_temp.color_to_spec(rec.main_color);
    if spec is null or spec ? 'neutral' then
      raise notice 'collection %: main_color % has no usable hue, using 314', rec.id, rec.main_color;
      update public.collections set hue = 314, intensity = 'normal' where id = rec.id;
    else
      update public.collections
        set hue = (spec ->> 'hue')::smallint, intensity = spec ->> 'intensity'
        where id = rec.id;
    end if;
  end loop;
end;
$$;

-- Track colors: every string value becomes a spec; unparseable ones turn neutral.
do $$
declare
  rec record;
  item record;
  converted jsonb;
  spec jsonb;
begin
  for rec in select id, track_colors from public.collections where track_colors <> '{}'::jsonb loop
    converted := '{}'::jsonb;
    for item in select key, value from jsonb_each(rec.track_colors) loop
      if jsonb_typeof(item.value) = 'string' then
        spec := pg_temp.color_to_spec(item.value #>> '{}');
        if spec is null then
          raise notice 'collection %: track color % = % not parseable, using neutral', rec.id, item.key, item.value;
          spec := '{"neutral": true}'::jsonb;
        end if;
      else
        spec := item.value;
      end if;
      converted := converted || jsonb_build_object(item.key, spec);
    end loop;
    update public.collections set track_colors = converted where id = rec.id;
  end loop;
end;
$$;

alter table public.collections
  alter column hue set not null,
  alter column intensity set not null,
  alter column intensity set default 'normal',
  add constraint collections_hue_range check (hue between 0 and 359),
  add constraint collections_intensity_values check (intensity in ('suave', 'normal', 'intensa')),
  drop column main_color;
