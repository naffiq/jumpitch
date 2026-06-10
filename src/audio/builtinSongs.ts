import type { Song } from '../types';
import { createBuiltinSong } from './builtinSong';
import { createCallResponseSong } from './callResponseSong';

export interface BuiltinEntry {
  id: string;
  title: string;
  meta: string;
  create: () => Song;
}

export const BUILTIN_SONGS: BuiltinEntry[] = [
  {
    id: 'neon-tide',
    title: 'Neon Tide',
    meta: 'free play · A minor · 100bpm',
    create: createBuiltinSong,
  },
  {
    id: 'echo-school',
    title: 'Echo School',
    meta: 'call & response · C major · 90bpm',
    create: createCallResponseSong,
  },
];

export function getBuiltinSong(id: string): Song {
  const entry = BUILTIN_SONGS.find((s) => s.id === id) ?? BUILTIN_SONGS[0];
  return entry.create();
}
