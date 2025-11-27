import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import * as dockerService from '../services/docker.js';
import { PullImageSchema, BuildImageSchema } from '../types/index.js';

const images = new Hono();

// List all images
images.get('/', async (c) => {
  const list = await dockerService.listImages();
  return c.json(list);
});

// Pull image from registry
images.post('/pull', zValidator('json', PullImageSchema), async (c) => {
  const { image } = c.req.valid('json');

  try {
    await dockerService.pullImage(image);
    return c.json({ success: true, image });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// Build image from Dockerfile
images.post('/build', zValidator('json', BuildImageSchema), async (c) => {
  const { dockerfile, tag } = c.req.valid('json');

  try {
    await dockerService.buildImage(dockerfile, tag);
    return c.json({ success: true, tag });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export default images;
