import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages 子路径部署：必须与仓库名一致（当前 xs-shelf）
export default defineConfig({
  base: '/xs-shelf/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 长线经营用例要跑十几天的模拟
    testTimeout: 30000,
  },
});
