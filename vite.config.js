import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Preview hostnames change whenever the sandbox is recreated, so they are passed
// per process (comma separated) rather than committed to this file.
const previewHosts = (process.env.PREVIEW_ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: ['localhost', ...previewHosts],
  },
});
