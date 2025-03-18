#!/usr/bin/env python3
import json
import sys
import pyperclip
import re


def format_lyrics(lyrics_text):
    # Split the lyrics by newlines
    lines = lyrics_text.strip().split('\n')

    # Filter out empty lines
    lines = [line.strip() for line in lines if line.strip()]

    # Normalize capitalization (first letter capital, rest lowercase)
    normalized_lines = []
    for line in lines:
        if line:
            # Convert to lowercase first
            line_lower = line.lower()

            # Find the first letter (after any opening punctuation)
            # This regex includes more accented characters for comprehensive coverage
            match = re.search(
                r'[a-záéíóúüñàèìòùâêîôûäëïöüÿç]', line_lower, re.IGNORECASE)
            if match:
                # Get the index of the first letter
                first_letter_index = match.start()
                # Capitalize the first letter
                line_lower = line_lower[:first_letter_index] + \
                    line_lower[first_letter_index].upper(
                ) + line_lower[first_letter_index+1:]

            normalized_lines.append(line_lower)

    # Create JSON structure
    json_lines = [{"text": line} for line in normalized_lines]

    # Convert to pretty JSON
    return json.dumps(json_lines, indent=2, ensure_ascii=False)


def main():
    print("Paste your lyrics below (press Ctrl+D when finished on Unix/Linux/Mac or Ctrl+Z followed by Enter on Windows):")

    # Read all input until EOF
    lyrics = ""
    try:
        lyrics = sys.stdin.read().strip()
    except KeyboardInterrupt:
        print("\nOperation cancelled.")
        sys.exit(1)

    if not lyrics:
        print("No lyrics provided.")
        sys.exit(1)

    # Format the lyrics
    json_output = format_lyrics(lyrics)

    # Print the result
    print("\nFormatted lyrics (JSON):")
    print(json_output)

    # Copy to clipboard
    pyperclip.copy(json_output)
    print("\nJSON copied to clipboard!")


if __name__ == "__main__":
    main()
