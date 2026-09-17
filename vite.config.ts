import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages 子路径部署：仓库名若不是 sm-github，请同步修改 base
export default defineConfig({
  base: '/sm-github/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
