// Bundles the site into one self-contained dist/index.html.
// Usage: npm install && npm run build
// (In a sandbox without npm access: ESBUILD=<path>/esbuild/lib/main.js NODE_PATH=<node_modules> node build.mjs)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { build } = await import(process.env.ESBUILD || 'esbuild');
const outDir = resolve(here, process.env.OUT_DIR || 'dist');
mkdirSync(outDir, { recursive: true });

const result = await build({
    entryPoints: [resolve(here, 'entry.tsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    outdir: outDir,
    write: false,
    nodePaths: process.env.NODE_PATH ? process.env.NODE_PATH.split(':') : [],
    alias: { '@instinct/files': resolve(here, 'shim.tsx') },
    loader: { '.jpg': 'dataurl' },
    define: {
        'process.env.NODE_ENV': '"production"',
        __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    jsx: 'transform',
    legalComments: 'none',
    logLevel: 'warning',
});

let js = '', css = '';
for (const f of result.outputFiles) {
    if (f.path.endsWith('.js')) js = f.text;
    else if (f.path.endsWith('.css')) css = f.text;
}
js = js.replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cricket - Beyond the Scoreboard</title>
<meta name="description" content="India Test cricket explorer: player matchups, country matchups, player analysis and ground analysis.">
<meta name="robots" content="noindex, nofollow">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;
writeFileSync(resolve(outDir, 'index.html'), html);
console.log('built', resolve(outDir, 'index.html'), (html.length / 1024).toFixed(0) + ' KB');
