import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import * as dockerService from '../services/docker.js';
import * as containerBuilder from '../services/container-builder.js';
import { CreateContainerSchema } from '../types/index.js';

const containers = new Hono();

// List all containers
containers.get('/', async (c) => {
  const list = await dockerService.listContainers();
  return c.json(list);
});

// Get single container
containers.get('/:id', async (c) => {
  const id = c.req.param('id');
  const container = await dockerService.getContainer(id);

  if (!container) {
    return c.json({ error: 'Container not found' }, 404);
  }

  return c.json(container);
});

// Create container
containers.post('/', zValidator('json', CreateContainerSchema), async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await containerBuilder.buildAndCreateContainer(body);

    return c.json({
      container: result.container,
      sshKeyPath: result.privateKeyPath,
      sshCommand: result.container.sshCommand,
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// Start container
containers.post('/:id/start', async (c) => {
  const id = c.req.param('id');

  try {
    await dockerService.startContainer(id);
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// Stop container
containers.post('/:id/stop', async (c) => {
  const id = c.req.param('id');

  try {
    await dockerService.stopContainer(id);
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// Remove container
containers.delete('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    // Get container info to find the name for key cleanup
    const container = await dockerService.getContainer(id);
    if (container) {
      await containerBuilder.cleanupContainerKeys(container.name);
    }

    await dockerService.removeContainer(id);
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

// Get SSH private key
containers.get('/:id/ssh-key', async (c) => {
  const id = c.req.param('id');

  try {
    const container = await dockerService.getContainer(id);
    if (!container) {
      return c.json({ error: 'Container not found' }, 404);
    }

    const privateKey = await containerBuilder.getPrivateKey(container.name);

    c.header('Content-Type', 'application/x-pem-file');
    c.header('Content-Disposition', `attachment; filename="${container.name}.pem"`);

    return c.body(privateKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export default containers;
