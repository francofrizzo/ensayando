-- Publish the editor without this field before applying this migration.
ALTER TABLE public.audio_tracks DROP COLUMN parts_reviewed;
