// Plain text ↔ lyrics, for "Pegar letra desde texto" and "Copiar letra como texto".
//
// Text format: stanzas separated by blank lines, one verse per line. A line in
// square brackets ("[Coro]") is the comment of the verse below it. Verses sung
// side by side (columns) are written on one line separated by " / ".

import type { LyricStanza, LyricVerse } from "@/data/types";

const COMMENT = /^\[(.+)\]$/;
const COLUMN_SEPARATOR = " / ";

/** Parses pasted text into stanzas without colors, tracks or times. */
export const textToLyrics = (text: string): LyricStanza[] =>
  text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => {
      const stanza: LyricStanza = [];
      let comment: string | undefined;
      for (const raw of block.split("\n")) {
        const line = raw.trim();
        if (!line) continue;
        const match = COMMENT.exec(line);
        if (match) {
          comment = match[1]!.trim();
          continue;
        }
        const parts = line.split(COLUMN_SEPARATOR).map((part) => part.trim()).filter(Boolean);
        if (parts.length > 1) {
          const columns: LyricVerse[][] = parts.map((part) => [{ text: part }]);
          if (comment) columns[0]![0]!.comment = comment;
          stanza.push(columns);
        } else {
          const verse: LyricVerse = { text: line };
          if (comment) verse.comment = comment;
          stanza.push(verse);
        }
        comment = undefined;
      }
      return stanza;
    })
    .filter((stanza) => stanza.length > 0);

const verseLines = (verse: LyricVerse): string[] =>
  verse.comment ? [`[${verse.comment}]`, verse.text] : [verse.text];

/** Writes lyrics as plain text; columns become one line per row, joined with " / ". */
export const lyricsToText = (lyrics: LyricStanza[]): string =>
  lyrics
    .map((stanza) =>
      stanza
        .flatMap((item) => {
          if (!Array.isArray(item)) return verseLines(item);
          const rows = Math.max(0, ...item.map((column) => column.length));
          const lines: string[] = [];
          for (let row = 0; row < rows; row++) {
            const verses = item.map((column) => column[row]).filter((v): v is LyricVerse => !!v);
            const comment = verses.find((verse) => verse.comment)?.comment;
            if (comment) lines.push(`[${comment}]`);
            lines.push(verses.map((verse) => verse.text).join(COLUMN_SEPARATOR));
          }
          return lines;
        })
        .join("\n")
    )
    .join("\n\n");
