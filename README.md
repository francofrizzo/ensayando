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

- Node.js 20 or higher
- npm or yarn

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

### Type Checking and Linting

```sh
npm run type-check
npm run lint
```

## Technologies Used

- **Vue 3** with Composition API and TypeScript
- **Vite** as bundler and development server
- **Tailwind CSS** + **DaisyUI** for the interface
- **Supabase** for authentication and storage
- **WaveSurfer** for audio visualization and control
- **Pinia** for state management
- **Vue Router** for navigation

## IDE Setup

We recommend using [Cursor](https://cursor.sh/) with the [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) extension for the best TypeScript support in `.vue` files. The extension provides comprehensive Vue 3 and TypeScript integration.

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
