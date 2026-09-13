import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const blog = resolve(root, '.deploy/lulu_blog');
await readFile(resolve(blog, 'index.html'));
const runtime = ['index.html', 'favicon.svg', 'src/app.js', 'src/onboarding.js', 'src/engine.js', 'src/ai.js', 'src/data.js', 'src/preview.js', 'src/icons.js', 'src/style.css', 'assets/congress-hall.png'];
const source = ['.gitignore', 'AGENTS.md', 'README.md', 'ROADMAP.md', 'DECISION_LOG.md', 'CHANGELOG.md', 'package.json', 'start.cmd',
  'tests/engine.test.js', 'tests/onboarding.test.js', 'tests/cards-v2.test.js',
  'scripts/serve.mjs', 'scripts/simulate.mjs', 'scripts/audit-cards.mjs', 'scripts/audit-favor.mjs', 'scripts/stage-blog.mjs', 'scripts/preview-blog.mjs',
  'docs/RULES.md', 'docs/VERIFICATION.md', 'docs/DEPLOYMENT.md', 'docs/ART.md', 'docs/CARD_REVIEW.md', 'docs/FAVOR_BALANCE.md'];
const files = [...runtime, ...source];
const manifest = [];
for (const path of files) {
  const destination = resolve(blog, 'games/second-chair', path);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await copyFile(resolve(root, path), destination);
  const content = await readFile(destination);
  manifest.push({ path: `games/second-chair/${path}`, kind: runtime.includes(path) ? 'runtime' : 'source', bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
}
await writeFile(resolve(root, '.deploy/release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Staged ${runtime.length} runtime and ${source.length} source/test/documentation files (${manifest.reduce((sum, file) => sum + file.bytes, 0)} bytes) in ${blog}`);
