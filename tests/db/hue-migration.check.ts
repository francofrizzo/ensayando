// Checks that the SQL color conversion in the hue migration agrees with
// parseLegacyColor() on the shared fixtures. Runs against LOCAL Supabase only.
//
//   npx supabase db reset --version 20260928023000   # schema before the hue migration
//   pnpm exec tsx tests/db/hue-migration.check.ts
//   npx supabase db reset                             # back to the full schema
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import fixtures from "../../src/__fixtures__/legacy-colors.json";

const CONTAINER = "supabase_db_ensayando";
const MIGRATION = join(
  import.meta.dirname,
  "../../supabase/migrations/20260929010000_collection_colors_by_hue.sql"
);

type Spec = { hue: number; intensity: string } | { neutral: true };

const psql = (sql: string) =>
  execFileSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], {
    input: sql,
    encoding: "utf8"
  });

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

// One collection per fixture (main_color), plus one holding every fixture as a track color.
const trackColors = Object.fromEntries(fixtures.map((f, i) => [`t${i}`, f.input]));
psql(`
  delete from public.collections where slug like 'hue-check-%';
  ${fixtures
    .map(
      (f, i) =>
        `insert into public.collections (slug, title, main_color) values ('hue-check-${i}', 'check', ${quote(f.input)});`
    )
    .join("\n")}
  insert into public.collections (slug, title, main_color, track_colors)
    values ('hue-check-tracks', 'check', null, ${quote(JSON.stringify(trackColors))}::jsonb);
`);

psql(readFileSync(MIGRATION, "utf8"));

const rows = psql(
  `select slug, hue, intensity, track_colors from public.collections where slug like 'hue-check-%' order by slug;`
)
  .trim()
  .split("\n")
  .map((line) => line.split("|"));

const failures: string[] = [];
const bySlug = new Map(rows.map(([slug, hue, intensity, tracks]) => [slug, { hue, intensity, tracks }]));

fixtures.forEach((fixture, i) => {
  const expected = fixture.expected as Spec | null;
  const row = bySlug.get(`hue-check-${i}`)!;
  // A collection needs a hue: grey or unparseable main colors fall back to the brand.
  const main = !expected || "neutral" in expected ? { hue: 314, intensity: "normal" } : expected;
  const got = { hue: Number(row.hue), intensity: row.intensity };
  if (JSON.stringify(got) !== JSON.stringify(main)) {
    failures.push(`main ${fixture.input}: expected ${JSON.stringify(main)}, got ${JSON.stringify(got)}`);
  }
});

const tracks = JSON.parse(bySlug.get("hue-check-tracks")!.tracks) as Record<string, Spec>;
fixtures.forEach((fixture, i) => {
  const expected = (fixture.expected as Spec | null) ?? { neutral: true };
  const got = tracks[`t${i}`];
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    failures.push(`track ${fixture.input}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  }
});

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`SQL conversion matches parseLegacyColor for ${fixtures.length} fixtures.`);
