// Karaoke song catalog, auto-discovered at build time. To add a song, drop a
// folder under src/songs/ containing an UltraStar .txt and (optionally) a cover
// image — no code change needed:
//
//   src/songs/<slug>/<anything>.txt    (UltraStar, required)
//   src/songs/<slug>/cover.{png,jpg,jpeg,webp,svg}   (optional)
//
// If there's no local cover but the file has a #VIDEO (YouTube) link, the song's
// YouTube thumbnail is used. Vite's import.meta.glob inlines the lyrics as raw
// strings and resolves cover URLs (respecting the `base` from vite.config.ts).

import type { Song } from '../types';
import { parseUltraStar, parseVideo } from './ultrastar';

const rawFiles = import.meta.glob('../songs/*/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const coverFiles = import.meta.glob('../songs/*/cover.{png,jpg,jpeg,webp,svg}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const midiFiles = import.meta.glob('../songs/*/*.{mid,midi}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface CatalogSong {
  id: string; // folder slug
  title: string;
  meta: string; // card subtitle
  cover?: string; // resolved image URL
  parse: () => Song;
}

function slugOf(path: string): string {
  return path.replace(/.*\/songs\/([^/]+)\/.*/, '$1');
}

function header(text: string, key: string): string | null {
  const m = new RegExp(`^#${key}:(.*)$`, 'im').exec(text);
  return m ? m[1].trim() : null;
}

function coverFor(id: string, text: string): string | undefined {
  const local = Object.entries(coverFiles).find(([cp]) => slugOf(cp) === id)?.[1];
  if (local) return local;
  const video = parseVideo(header(text, 'VIDEO'), NaN);
  return video ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : undefined;
}

/** Resolved .mid URL for a song that declares #MIDI (first .mid in its folder). */
function midiFor(id: string, text: string): string | undefined {
  if (!header(text, 'MIDI')) return undefined;
  return Object.entries(midiFiles).find(([mp]) => slugOf(mp) === id)?.[1];
}

// First .txt per folder (slug) wins.
const bySlug = new Map<string, string>();
for (const [path, text] of Object.entries(rawFiles)) {
  const id = slugOf(path);
  if (!bySlug.has(id)) bySlug.set(id, text);
}

export const CATALOG: CatalogSong[] = Array.from(bySlug, ([id, text]) => {
  const cover = coverFor(id, text);
  const midiUrl = midiFor(id, text);
  const title = header(text, 'TITLE') ?? id;
  const artist = header(text, 'ARTIST');
  const source = midiUrl ? 'midi' : parseVideo(header(text, 'VIDEO'), NaN) ? 'video' : 'karaoke';
  return {
    id,
    title,
    meta: artist ? `${artist} · ${source}` : source,
    cover,
    parse: () => parseUltraStar(text, { cover, midiUrl }),
  };
}).sort((a, b) => a.title.localeCompare(b.title));

export function getCatalogSong(id: string): Song {
  const entry = CATALOG.find((s) => s.id === id) ?? CATALOG[0];
  return entry.parse();
}
