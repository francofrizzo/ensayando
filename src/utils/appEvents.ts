// Window events that connect the global overlays (library, ⌘K) with the player,
// without either importing the other.
//
// "ens:command"  — overlays → player. detail: { id: PlayerCommandId }
//   "download-mix"  descargar la mezcla con los volúmenes actuales
//   "new-song"      abrir el editor en modo "nueva canción"
//   "edit-song"     abrir el editor de la canción actual
//
// "ens:playback" — player → overlays. detail: { playing: boolean }
//   Dispatched whenever playback starts or stops, so the library can animate
//   the "now playing" bars.

export const COMMAND_EVENT = "ens:command";
export const PLAYBACK_EVENT = "ens:playback";

export type PlayerCommandId = "download-mix" | "new-song" | "edit-song";

export type CommandEventDetail = { id: PlayerCommandId };
export type PlaybackEventDetail = { playing: boolean };

export const dispatchPlayerCommand = (id: PlayerCommandId) =>
  window.dispatchEvent(new CustomEvent<CommandEventDetail>(COMMAND_EVENT, { detail: { id } }));

export const dispatchPlayback = (playing: boolean) =>
  window.dispatchEvent(
    new CustomEvent<PlaybackEventDetail>(PLAYBACK_EVENT, { detail: { playing } })
  );

/** Subscribes to playback changes; returns the unsubscribe function. */
export const onPlayback = (listener: (playing: boolean) => void) => {
  const handler = (event: Event) =>
    listener((event as CustomEvent<PlaybackEventDetail>).detail.playing);
  window.addEventListener(PLAYBACK_EVENT, handler);
  return () => window.removeEventListener(PLAYBACK_EVENT, handler);
};
