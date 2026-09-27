// Build step 3: render every sitemap route to static HTML so crawlers and first
// paint get full content (services, prices, canonical, JSON-LD) without JS.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const projectRoot = process.cwd();
const distributionDirectory = path.join(projectRoot, 'dist');

async function readRoutes() {
  const sitemap = await fs.readFile(path.join(projectRoot, 'public', 'sitemap.xml'), 'utf8');
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname || '/');
}

async function readManifest() {
  const candidates = [
    path.join(distributionDirectory, '.vite', 'manifest.json'),
    path.join(distributionDirectory, 'manifest.json'),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(await fs.readFile(candidate, 'utf8'));
    } catch {
      // Vite has used both locations across supported versions.
    }
  }

  return {};
}

function replaceBuiltAssetUrls(markup, manifest) {
  let result = markup;

  for (const [manifestKey, entry] of Object.entries(manifest)) {
    if (!entry || typeof entry !== 'object' || !entry.file) continue;
    const sourceName = path.posix.basename(manifestKey.replaceAll('\\', '/'));
    const builtUrl = `/${entry.file}`;
    result = result.replaceAll(`/src/assets/${sourceName}`, builtUrl);
  }

  return result;
}

function removeTemplateSeoTags(template) {
  return template
    .replace(/\s*<title>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<meta name="description"[^>]*>/i, '')
    .replace(/\s*<meta name="author"[^>]*>/i, '');
}

async function main() {
  const routes = await readRoutes();
  const manifest = await readManifest();
  const builtTemplate = await fs.readFile(path.join(distributionDirectory, 'index.html'), 'utf8');
  const template = removeTemplateSeoTags(builtTemplate);
  const vite = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  const { render } = await vite.ssrLoadModule('/src/entry-server.tsx');

  const renderDocument = (route) => {
    const { html, helmet } = render(route);
    const helmetHead = [helmet?.title, helmet?.meta, helmet?.link, helmet?.script]
      .filter(Boolean)
      .map((item) => item.toString())
      .join('\n');
    return replaceBuiltAssetUrls(
      template
        .replace('</head>', `${helmetHead}\n</head>`)
        .replace('<div id="root"></div>', `<div id="root">${html}</div>`),
      manifest,
    );
  };

  // The unrendered SPA shell. The server sends it for a service that was added in
  // WubSync after this build, so it works (client-rendered) before the next deploy.
  await fs.writeFile(path.join(distributionDirectory, 'app-shell.html'), builtTemplate);

  for (const route of routes) {
    const outputDirectory = route === '/' ? distributionDirectory : path.join(distributionDirectory, route.slice(1));
    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.writeFile(path.join(outputDirectory, 'index.html'), renderDocument(route));
  }

  // Any other path gets the NotFound page with a real 404 status (server/index.js).
  await fs.writeFile(path.join(distributionDirectory, '404.html'), renderDocument('/404'));

  console.log(`Prerendered ${routes.length} routes`);
  // One-shot build helper: exit so Vite's middleware watcher cannot keep it alive.
  process.exit(0);
}

main().catch((error) => {
  console.error('SEO prerender failed:', error);
  process.exit(1);
});
