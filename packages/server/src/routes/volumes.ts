import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import * as dockerService from '../services/docker.js';
import { CreateVolumeSchema } from '../types/index.js';

const volumes = new Hono();

// List all volumes
volumes.get('/', async (c) => {
  const list = await dockerService.listVolumes();
  return c.json(list);
});

// Create volume
volumes.post('/', zValidator('json', CreateVolumeSchema), async (c) => {
  const { name } = c.req.valid('json');

  try {
    await dockerService.createVolume(name);
    return c.json({ success: true, name }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// Delete volume
volumes.delete('/:name', async (c) => {
  const name = c.req.param('name');

  try {
    await dockerService.removeVolume(name);
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// List files in volume
volumes.get('/:name/files', async (c) => {
  const name = c.req.param('name');

  try {
    const files = await dockerService.getVolumeFiles(name);
    return c.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export default volumes;
