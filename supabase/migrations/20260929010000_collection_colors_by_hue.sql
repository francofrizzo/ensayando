-- Hue-based palette (design/fundamentos/paleta.html).
--
-- Collections store a hue (0–359) and an intensity (suave, media, intensa);
-- track_colors values become {"hue": 195, "intensity": "media"} or
-- {"neutral": true}. Every UI color is derived from them in the app
-- (src/utils/palette.ts). main_color is dropped.
--
-- Existing values are converted here, so the deploy is atomic. The parsing
-- mirrors parseLegacyColor() in src/utils/palette.ts and is checked against the
-- same fixtures (src/__fixtures__/legacy-colors.json, tests/db/hue-migration.check.ts).
-- Supported legacy formats: oklch(L C H) with L as number or percentage,
-- #rgb / #rrggbb and rgb()/rgba() with 0–255 channels. Anything else (hsl(), named
-- colors, malformed values) becomes neutral (tracks) or the brand hue
-- (collections), with a notice; a malformed value never aborts the migration.
--
-- Intensity is relative: the share of the most chroma the color's hue can show in
-- sRGB at the color's own lightness (≥ 0.72 intensa, ≥ 0.45 media, else suave;
-- chroma < 0.04 is neutral). Colors picked at full saturation map to "intensa"
-- even when their absolute chroma is low (a saturated cyan sits near 0.11).
--
-- The original values are kept in public.collections_color_backup (not exposed
-- through the API) so any conversion can be reviewed or undone by hand.

-- Largest chroma inside sRGB at lightness l and hue h (degrees). Mirrors
-- legacyMaxChroma() in src/utils/palette.ts: same matrices, tolerance and steps.
create function pg_temp.max_chroma(l double precision, h double precision) returns double precision
language plpgsql immutable as $$
declare
  lo double precision := 0;
  hi double precision := 0.5;
  mid double precision;
  a double precision; b double precision;
  l_ double precision; m_ double precision; s_ double precision;
  r double precision; g double precision; bl double precision;
begin
  if l <= 0 or l >= 1 then
    return 0;
  end if;
  for i in 1..30 loop
    mid := (lo + hi) / 2;
    a := mid * cos(radians(h));
    b := mid * sin(radians(h));
    l_ := power(l + 0.3963377774 * a + 0.2158037573 * b, 3);
    m_ := power(l - 0.1055613458 * a - 0.0638541728 * b, 3);
    s_ := power(l - 0.0894841775 * a - 1.291485548 * b, 3);
    r := 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
    g := -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
    bl := -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
    if r between -0.0001 and 1.0001 and g between -0.0001 and 1.0001 and bl between -0.0001 and 1.0001 then
      lo := mid;
    else
      hi := mid;
    end if;
  end loop;
  return lo;
end;
$$;

create function pg_temp.color_to_spec(value text) returns jsonb
language plpgsql immutable as $$
declare
  m text[];
  compact text;
  hex text;
  r double precision; g double precision; b double precision;
  l double precision; mm double precision; s double precision;
  lab_a double precision; lab_b double precision;
  lightness double precision; chroma double precision; hue double precision;
  max_c double precision; share double precision;
begin
  if value is null then
    return null;
  end if;

  begin
    compact := lower(regexp_replace(value, '\s', '', 'g'));
    m := regexp_match(value, '^\s*oklch\(\s*([0-9]*\.?[0-9]+)(%?)\s+([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)(?:deg)?\s*(?:/[^)]*)?\)\s*$', 'i');
    if m is not null then
      lightness := m[1]::double precision / (case when m[2] = '%' then 100 else 1 end);
      chroma := m[3]::double precision;
      hue := m[4]::double precision;
    else
      if compact ~ '^#([0-9a-f]{3}|[0-9a-f]{6})$' then
        hex := compact;
        if length(hex) = 4 then
          hex := '#' || repeat(substr(hex, 2, 1), 2) || repeat(substr(hex, 3, 1), 2) || repeat(substr(hex, 4, 1), 2);
        end if;
        r := ('x' || substr(hex, 2, 2))::bit(8)::int;
        g := ('x' || substr(hex, 4, 2))::bit(8)::int;
        b := ('x' || substr(hex, 6, 2))::bit(8)::int;
      else
        m := regexp_match(value, '^\s*rgba?\(\s*([0-9]{1,3})\s*[, ]\s*([0-9]{1,3})\s*[, ]\s*([0-9]{1,3})\s*(?:[,/]\s*[0-9.]+%?\s*)?\)\s*$', 'i');
        if m is null then
          return null;
        end if;
        r := least(m[1]::int, 255);
        g := least(m[2]::int, 255);
        b := least(m[3]::int, 255);
      end if;
      -- sRGB → linear → OKLab → chroma/hue (same constants as the TS mirror).
      r := r / 255.0; g := g / 255.0; b := b / 255.0;
      r := case when r <= 0.04045 then r / 12.92 else power((r + 0.055) / 1.055, 2.4) end;
      g := case when g <= 0.04045 then g / 12.92 else power((g + 0.055) / 1.055, 2.4) end;
      b := case when b <= 0.04045 then b / 12.92 else power((b + 0.055) / 1.055, 2.4) end;
      l := cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
      mm := cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
      s := cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
      lightness := 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s;
      lab_a := 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s;
      lab_b := 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
      chroma := sqrt(lab_a * lab_a + lab_b * lab_b);
      hue := atan2d(lab_b, lab_a);
    end if;

    -- Same rules as chromaToSpec(): <0.04 neutral, then relative chroma.
    if chroma < 0.04 then
      return '{"neutral": true}'::jsonb;
    end if;
    max_c := pg_temp.max_chroma(lightness, hue);
    share := case when max_c > 0 then chroma / max_c else 1 end;
    -- Normalize to [0, 360) before rounding, and round as numeric (half up, like
    -- Math.round); double precision would round half to even.
    hue := mod(mod(round(mod((hue + 360)::numeric, 360)), 360) + 360, 360);
    return jsonb_build_object(
      'hue', hue::int,
      'intensity', case when share >= 0.72 then 'intensa' when share >= 0.45 then 'media' else 'suave' end
    );
  exception when others then
    -- Malformed numbers (e.g. "1.2.3") must not abort the deploy.
    return null;
  end;
end;
$$;

-- A value that is already a spec is kept; anything else is not.
create function pg_temp.is_spec(value jsonb) returns boolean
language sql immutable as $$
  select case
    when value is null or jsonb_typeof(value) <> 'object' then false
    when value ? 'neutral' then value = '{"neutral": true}'::jsonb
    else jsonb_typeof(value -> 'hue') = 'number'
      and (value ->> 'hue')::numeric between 0 and 359
      and value ->> 'intensity' in ('suave', 'media', 'intensa')
  end;
$$;

-- Backup of the original values, before anything changes.
create table public.collections_color_backup (
  collection_id bigint primary key,
  main_color text,
  track_colors jsonb,
  backed_up_at timestamptz not null default now()
);
alter table public.collections_color_backup enable row level security;
revoke all on public.collections_color_backup from anon, authenticated;

insert into public.collections_color_backup (collection_id, main_color, track_colors)
select id, main_color, track_colors from public.collections;

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
      update public.collections set hue = 314, intensity = 'media' where id = rec.id;
    else
      update public.collections
        set hue = (spec ->> 'hue')::smallint, intensity = spec ->> 'intensity'
        where id = rec.id;
    end if;
  end loop;
end;
$$;

-- Track colors: every string value becomes a spec; unparseable strings and any
-- other value that isn't a spec turn neutral.
do $$
declare
  rec record;
  item record;
  converted jsonb;
  spec jsonb;
begin
  for rec in
    select id, track_colors from public.collections
    where track_colors is not null and track_colors <> '{}'::jsonb
  loop
    converted := '{}'::jsonb;
    if jsonb_typeof(rec.track_colors) = 'object' then
      for item in select key, value from jsonb_each(rec.track_colors) loop
        if jsonb_typeof(item.value) = 'string' then
          spec := pg_temp.color_to_spec(item.value #>> '{}');
        elsif pg_temp.is_spec(item.value) then
          spec := item.value;
        else
          spec := null;
        end if;
        if spec is null then
          raise notice 'collection %: track color % = % not usable, using neutral', rec.id, item.key, item.value;
          spec := '{"neutral": true}'::jsonb;
        end if;
        converted := converted || jsonb_build_object(item.key, spec);
      end loop;
    else
      raise notice 'collection %: track_colors % is not an object, emptied', rec.id, rec.track_colors;
    end if;
    update public.collections set track_colors = converted where id = rec.id;
  end loop;
end;
$$;

update public.collections set track_colors = '{}'::jsonb where track_colors is null;

alter table public.collections
  alter column hue set not null,
  alter column intensity set not null,
  alter column intensity set default 'media',
  add constraint collections_hue_range check (hue between 0 and 359),
  add constraint collections_intensity_values check (intensity in ('suave', 'media', 'intensa')),
  drop column main_color;
