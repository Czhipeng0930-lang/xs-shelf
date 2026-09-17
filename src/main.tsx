import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import * as engine from './game/engine';
import * as grid from './game/grid';
import * as share from './game/share';
import { useStore } from './game/store';
import './style.css';

if (import.meta.env.DEV) {
  // 开发调试：控制台可直接操作 store / 引擎
  Object.assign(window, { __store: useStore, __engine: engine, __grid: grid, __share: share });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
