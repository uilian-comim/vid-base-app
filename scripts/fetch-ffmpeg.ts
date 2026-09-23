/**
 * Downloads static ffmpeg/ffprobe builds into src-tauri/binaries so Tauri can bundle them
 * as sidecars (see `bundle.externalBin` in tauri.conf.json).
 *
 * Usage: bun scripts/fetch-ffmpeg.ts [target-triple] [--force]
 *
 * The target defaults to TAURI_ENV_TARGET_TRIPLE (set by the Tauri CLI for
 * beforeDev/beforeBuild commands) and then to the host triple reported by rustc.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, chmodSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

type Source = { url: string; bins: ('ffmpeg' | 'ffprobe')[] };

// macOS builds track the latest ffmpeg release; BtbN's (GitHub-hosted, fast in CI) are
// pinned to a release branch. Bump FFMPEG_BRANCH to move Windows/Linux to a newer major.
const FFMPEG_BRANCH = '9.0';
const MARTIN_RIEDL = 'https://ffmpeg.martin-riedl.de/redirect/latest/macos';
const BTBN = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest';
const btbn = (platform: string, ext: string) =>
  `${BTBN}/ffmpeg-n${FFMPEG_BRANCH}-latest-${platform}-gpl-${FFMPEG_BRANCH}.${ext}`;

const SOURCES: Record<string, Source[]> = {
  'aarch64-apple-darwin': [
    { url: `${MARTIN_RIEDL}/arm64/release/ffmpeg.zip`, bins: ['ffmpeg'] },
    { url: `${MARTIN_RIEDL}/arm64/release/ffprobe.zip`, bins: ['ffprobe'] },
  ],
  'x86_64-apple-darwin': [
    { url: `${MARTIN_RIEDL}/amd64/release/ffmpeg.zip`, bins: ['ffmpeg'] },
    { url: `${MARTIN_RIEDL}/amd64/release/ffprobe.zip`, bins: ['ffprobe'] },
  ],
  'x86_64-pc-windows-msvc': [
    { url: btbn('win64', 'zip'), bins: ['ffmpeg', 'ffprobe'] },
  ],
  'aarch64-pc-windows-msvc': [
    { url: btbn('winarm64', 'zip'), bins: ['ffmpeg', 'ffprobe'] },
  ],
  'x86_64-unknown-linux-gnu': [
    { url: btbn('linux64', 'tar.xz'), bins: ['ffmpeg', 'ffprobe'] },
  ],
  'aarch64-unknown-linux-gnu': [
    { url: btbn('linuxarm64', 'tar.xz'), bins: ['ffmpeg', 'ffprobe'] },
  ],
};

// Sidecars are prefixed so the Linux .deb doesn't collide with the distro's /usr/bin/ffmpeg.
const SIDECAR_PREFIX = 'vidbase-';

const root = join(import.meta.dir, '..');
const outDir = join(root, 'src-tauri', 'binaries');

function hostTriple(): string {
  const out = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.startsWith('host:'));
  if (!line) throw new Error('Could not determine host target triple from `rustc -vV`');
  return line.slice('host:'.length).trim();
}

function findFile(dir: string, name: string): string | null {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      const found = findFile(p, name);
      if (found) return found;
    } else if (entry === name) {
      return p;
    }
  }
  return null;
}

/** bsdtar (macOS, and Windows' bundled tar.exe) reads zip archives; GNU tar on Linux doesn't. */
function extract(archive: string, dest: string) {
  if (archive.endsWith('.zip') && process.platform === 'linux') {
    execFileSync('unzip', ['-q', archive, '-d', dest], { stdio: 'inherit' });
    return;
  }
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  execFileSync(tar, ['-xf', archive, '-C', dest], { stdio: 'inherit' });
}

async function download(url: string, dest: string) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  writeFileSync(dest, new Uint8Array(await res.arrayBuffer()));
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const target = args.find((a) => !a.startsWith('--')) ?? process.env.TAURI_ENV_TARGET_TRIPLE ?? hostTriple();

  const sources = SOURCES[target];
  if (!sources) {
    throw new Error(`No ffmpeg source configured for target "${target}". Add one to scripts/fetch-ffmpeg.ts.`);
  }

  const exe = target.includes('windows') ? '.exe' : '';
  const destFor = (bin: string) => join(outDir, `${SIDECAR_PREFIX}${bin}-${target}${exe}`);

  const pending = sources.filter((s) => force || s.bins.some((b) => !existsSync(destFor(b))));
  if (pending.length === 0) {
    console.log(`[ffmpeg] sidecars for ${target} already present`);
    return;
  }

  mkdirSync(outDir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'vidbase-ffmpeg-'));
  try {
    for (const source of pending) {
      const archive = join(work, basename(new URL(source.url).pathname));
      console.log(`[ffmpeg] downloading ${source.url}`);
      await download(source.url, archive);

      const extractDir = join(work, `x-${basename(archive)}`);
      mkdirSync(extractDir);
      extract(archive, extractDir);

      for (const bin of source.bins) {
        const found = findFile(extractDir, `${bin}${exe}`);
        if (!found) throw new Error(`${bin}${exe} not found inside ${source.url}`);
        copyFileSync(found, destFor(bin));
        chmodSync(destFor(bin), 0o755);
        console.log(`[ffmpeg] installed ${destFor(bin)}`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`[ffmpeg] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
