# Vidbase

> 🤖 **AI-Generated Project:** This application was developed *entirely* by Artificial Intelligence. The only human interaction involved was writing the prompts to guide the development process.

A modern, fast, and lightweight native video player built with [Tauri](https://v2.tauri.app/), [React](https://reactjs.org/), and [TypeScript](https://www.typescriptlang.org/). 

## Features

- **Media Playback**: Robust support for popular video formats including `MKV`, `TS`, `AVI`, `MP4`, and more, with audio track selection and subtitles (embedded or sidecar `.srt`/`.ass`/`.vtt` files).
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

   The first run downloads static `ffmpeg`/`ffprobe` builds into `src-tauri/binaries/` (see `scripts/fetch-ffmpeg.ts`); they are bundled with the app as Tauri sidecars, so end users don't need ffmpeg installed.

### How playback works

Files the webview can decode (e.g. H.264 MP4) play natively. Everything else is served by a local server (`src-tauri/src/streamer.rs`) as an on-demand HLS playlist played with hls.js:

- Segments are cut on video keyframes (read from the MKV `Cues` index, or an `ffprobe` scan cached on disk for other containers) and stream-copied, so seeking is instant and video quality is untouched.
- Audio is copied when it's already AAC, otherwise converted to AAC.
- Video codecs the webview can't decode (e.g. HEVC on Windows, 10-bit H.264, VP9/MPEG-4 in AVI) are transcoded to H.264 per segment.
- Text subtitles are converted to WebVTT; image-based ones (PGS/VobSub) are not supported yet.

### Building for Production

To compile the application into a standalone executable:
```bash
npm run tauri:build
```


