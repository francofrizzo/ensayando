type PrefetchedSong = {
  songId: number;
  controller: AbortController;
  files: Map<string, Promise<Blob | null>>;
};

let nextSong: PrefetchedSong | null = null;

export function cancelAudioPrefetch() {
  nextSong?.controller.abort();
  nextSong = null;
}

export function prefetchSongAudio(songId: number, urls: string[]) {
  if (nextSong?.songId === songId) return;
  cancelAudioPrefetch();
  const controller = new AbortController();
  const files = new Map<string, Promise<Blob | null>>();
  nextSong = { songId, controller, files };
  for (const url of new Set(urls.filter(Boolean))) {
    files.set(
      url,
      fetch(url, { signal: controller.signal })
        .then((response) => (response.ok ? response.blob() : null))
        .catch(() => null)
    );
  }
}

// Transfer ownership, including in-flight downloads, to the destination player.
export function takePrefetchedAudio(songId: number): PrefetchedSong | null {
  if (nextSong?.songId !== songId) {
    cancelAudioPrefetch();
    return null;
  }
  const result = nextSong;
  nextSong = null;
  return result;
}
