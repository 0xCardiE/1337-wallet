import { defineConfig, build as viteBuild, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Content + inpage run as Chrome content scripts (no ES module loader).
 * Bundle each as a self-contained IIFE after the main extension build.
 */
function buildContentScripts(): Plugin {
  let nested = false;
  return {
    name: 'build-content-scripts',
    apply: 'build',
    async closeBundle() {
      if (nested) return;
      nested = true;
      try {
        for (const [name, entry] of [
          ['content', 'src/content/inject.ts'],
          ['inpage', 'src/inpage/provider.ts'],
        ] as const) {
          await viteBuild({
            configFile: false,
            root,
            publicDir: false,
            logLevel: 'warn',
            build: {
              outDir: join(root, 'dist'),
              emptyOutDir: false,
              sourcemap: false,
              target: 'es2020',
              rollupOptions: {
                input: join(root, entry),
                output: {
                  format: 'iife',
                  entryFileNames: `${name}.js`,
                  inlineDynamicImports: true,
                  name: `Wallet1337_${name}`,
                },
              },
            },
          });
        }

        const trezorContentSrc = join(
          root,
          'node_modules/@trezor/connect-webextension/build/content-script.js',
        );
        if (existsSync(trezorContentSrc)) {
          const vendorDir = join(root, 'dist/vendor');
          mkdirSync(vendorDir, { recursive: true });
          copyFileSync(trezorContentSrc, join(vendorDir, 'trezor-content-script.js'));
        }
      } finally {
        nested = false;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), buildContentScripts()],
  root,
  publicDir: 'public',
  base: './',
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      input: {
        index: join(root, 'index.html'),
        background: join(root, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
