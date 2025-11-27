import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getConfig, setConfig } from '../services/config.js';

const configRoutes = new Hono();

const UpdateConfigSchema = z.object({
  sshKeysDisplayPath: z.string().min(1).optional(),
});

// Get current config
configRoutes.get('/', async (c) => {
  const config = await getConfig();
  return c.json(config);
});

// Update config
configRoutes.patch('/', zValidator('json', UpdateConfigSchema), async (c) => {
  const updates = c.req.valid('json');
  const newConfig = await setConfig(updates);
  return c.json(newConfig);
});

export default configRoutes;
