import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// On GitHub Pages the app is served from /<repo>/, so set the base path there.
// Locally and elsewhere it stays at root.
const base = process.env.GITHUB_PAGES ? '/chessboard-link/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5180 },
});
