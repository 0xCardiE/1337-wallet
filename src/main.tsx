import { Buffer } from 'buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import { App } from './App';
import { bootstrapLiFi } from './lib/lifiBootstrap';
import './index.css';

const globalScope = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!globalScope.Buffer) globalScope.Buffer = Buffer;

bootstrapLiFi();

/** Side panel (and other wide hosts): center content and allow more horizontal space. */
const WIDE_SURFACE_MIN_INNER_WIDTH = 440;
function sync1337SurfaceLayoutClass(): void {
  const wide = window.innerWidth >= WIDE_SURFACE_MIN_INNER_WIDTH;
  document.documentElement.classList.toggle('w1337-wide-surface', wide);
}
sync1337SurfaceLayoutClass();
window.addEventListener('resize', sync1337SurfaceLayoutClass);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
