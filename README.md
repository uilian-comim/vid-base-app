# Vidbase

A modern, fast, and lightweight native video player built with [Tauri](https://v2.tauri.app/), [React](https://reactjs.org/), and [TypeScript](https://www.typescriptlang.org/). 

## Features

- **Media Playback**: Robust support for popular video formats including `MKV`, `TS`, `MP4`, and more.
- **Continue Watching**: Automatically remembers your playback position so you can pick up exactly where you left off.
- **Library Management**: Browse directories, view detailed file cards, and access non-video files seamlessly.
- **Customization & Themes**: Beautiful UI with dark mode support and smooth animations using Framer Motion.
- **Internationalization**: Full multi-language support with intuitive translations.
- **Native Experience**: Deep integration with the OS, including a custom Windows Volume Mixer name.

## Tech Stack

- **Frontend**: React 19, Tailwind CSS v4, Framer Motion, Lucide React, i18next
- **Desktop Engine**: Tauri v2, Rust
- **Build Tool**: Vite, TypeScript

## Getting Started

### Prerequisites

Make sure you have the following installed to build and run the project:
- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Installation

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run tauri:dev
   ```

### Building for Production

To compile the application into a standalone executable:
```bash
npm run tauri:build
```


