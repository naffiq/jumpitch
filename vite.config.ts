import { defineConfig } from 'vite';

// Served from https://naffiq.github.io/neopitch/ on GitHub Pages, so asset
// URLs must be prefixed with the repo name. Locally `vite dev` ignores this.
export default defineConfig({
  base: '/neopitch/',
});
