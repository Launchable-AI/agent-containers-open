import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SaveDockerfileSchema } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const DOCKERFILES_DIR = join(PROJECT_ROOT, 'data', 'dockerfiles');

const dockerfiles = new Hono();

// Ensure dockerfiles directory exists
async function ensureDir() {
  await mkdir(DOCKERFILES_DIR, { recursive: true });
}

// List all saved Dockerfiles
dockerfiles.get('/', async (c) => {
  await ensureDir();

  try {
    const files = await readdir(DOCKERFILES_DIR);
    const dockerfileList = files
      .filter((f) => f.endsWith('.dockerfile'))
      .map((f) => f.replace('.dockerfile', ''));

    return c.json(dockerfileList);
  } catch {
    return c.json([]);
  }
});

// Get specific Dockerfile
dockerfiles.get('/:name', async (c) => {
  const name = c.req.param('name');
  const filePath = join(DOCKERFILES_DIR, `${name}.dockerfile`);

  try {
    const content = await readFile(filePath, 'utf-8');
    return c.json({ name, content });
  } catch {
    return c.json({ error: 'Dockerfile not found' }, 404);
  }
});

// Save Dockerfile
dockerfiles.post('/:name', zValidator('json', SaveDockerfileSchema), async (c) => {
  await ensureDir();

  const name = c.req.param('name');
  const { content } = c.req.valid('json');
  const filePath = join(DOCKERFILES_DIR, `${name}.dockerfile`);

  try {
    await writeFile(filePath, content, 'utf-8');
    return c.json({ success: true, name });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// Delete Dockerfile
dockerfiles.delete('/:name', async (c) => {
  const name = c.req.param('name');
  const filePath = join(DOCKERFILES_DIR, `${name}.dockerfile`);

  try {
    await unlink(filePath);
    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Dockerfile not found' }, 404);
  }
});

export default dockerfiles;
