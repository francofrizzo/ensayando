# 🎤 Ensayando

A web application for playing and editing multitrack songs with synchronized lyrics, designed especially for musical rehearsals and group practice.

## Features

- **Multitrack audio playback**: Listen to each instrument or voice separately with individual volume controls
- **Synchronized lyrics**: Follow song lyrics with precise timing associated with each audio track
- **Integrated editor**: Edit songs, add new audio tracks, and adjust lyrics directly in the application
- **Collection organization**: Group your songs into themed collections with custom colors
- **Advanced controls**: Mute, solo, and adjust volume for each track independently

## Development Environment Setup

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- npm

### Installation

```sh
npm install
```

### Local Development

```sh
npm run dev
```

### Production Build

```sh
npm run build
```

### Type Checking, Linting, and Tests

```sh
npm run type-check
npm run lint
npm test
```

## Technologies Used

- **Vue 3** with Composition API and TypeScript
- **Vite** as bundler and development server
- **Tailwind CSS** + **DaisyUI** for the interface
- **Supabase** for authentication and storage
- **WaveSurfer** for audio visualization and control
- **Pinia** for state management
- **Vue Router** for navigation
- **PWA** via vite-plugin-pwa

## Admin tasks

Some operations aren't exposed in the app UI — managing users (create, delete, reset password), assigning collection roles, and collection/song CRUD. These are handled via SQL against the linked Supabase project. If you're working with Claude Code, the `.claude/skills/admin/` skill covers the common workflows; otherwise the `SKILL.md` file there doubles as a quick reference for the SQL snippets.

## Deployment

Vercel SPA with catch-all rewrite. See `vercel.json`.

## Project Structure

```
src/
├── components/           # Reusable components
│   ├── auth/            # Authentication
│   ├── editor/          # Song and lyrics editor
│   ├── lyrics/          # Lyrics display
│   ├── navigation/      # Navigation and menus
│   ├── player/          # Multitrack player
│   └── ui/              # UI components
├── composables/         # Reusable Vue logic
├── data/               # Data types and schemas
├── stores/             # Global state with Pinia
├── utils/              # Utilities and helpers
└── views/              # Main pages
```

## License

This project is for private use.
