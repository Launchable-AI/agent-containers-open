import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { readdir, readFile, writeFile, unlink, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SaveDockerfileSchema } from '../types/index.js';
import * as dockerService from '../services/docker.js';
import { getPublicKey } from '../services/container-builder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const DOCKERFILES_DIR = join(PROJECT_ROOT, 'data', 'dockerfiles');
const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates');

const dockerfiles = new Hono();

// Ensure dockerfiles directory exists and has default template
async function ensureDir() {
  await mkdir(DOCKERFILES_DIR, { recursive: true });

  // Copy default template if no dockerfiles exist
  const files = await readdir(DOCKERFILES_DIR).catch(() => []);
  const hasDockerfiles = files.some((f) => f.endsWith('.dockerfile'));

  if (!hasDockerfiles) {
    const defaultSrc = join(TEMPLATES_DIR, 'default.dockerfile');
    const defaultDst = join(DOCKERFILES_DIR, 'default.dockerfile');
    if (existsSync(defaultSrc)) {
      await copyFile(defaultSrc, defaultDst);
    }
  }
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

// Build image from Dockerfile (with streaming logs)
dockerfiles.post('/:name/build', async (c) => {
  const name = c.req.param('name');
  const filePath = join(DOCKERFILES_DIR, `${name}.dockerfile`);

  try {
    const content = await readFile(filePath, 'utf-8');
    const tag = `acm-${name}:latest`;

    // Inject SSH public key (replaces {{PUBLIC_KEY}} placeholder)
    const publicKey = await getPublicKey();
    const dockerfileWithKey = content.replace(/\{\{PUBLIC_KEY\}\}/g, publicKey);

    // Set up SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: string, data: string) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          await dockerService.buildImageWithLogs(dockerfileWithKey, tag, (log) => {
            sendEvent('log', log);
          });
          sendEvent('done', tag);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Build failed';
          sendEvent('error', message);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export default dockerfiles;
