import { createServer } from 'net';
import Docker from 'dockerode';

const docker = new Docker();

export async function findAvailablePort(startPort: number, maxAttempts = 100): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`No available port found between ${startPort} and ${startPort + maxAttempts}`);
}

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

export async function findAvailableSshPort(): Promise<number> {
  // Get ports already used by Docker containers
  const usedPorts = await getUsedContainerPorts();

  for (let port = 2222; port < 2222 + 100; port++) {
    // Skip ports already mapped to containers
    if (usedPorts.has(port)) {
      continue;
    }
    // Also check if host is using the port
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error('No available SSH port found');
}

async function getUsedContainerPorts(): Promise<Set<number>> {
  const usedPorts = new Set<number>();

  try {
    const containers = await docker.listContainers({ all: true });

    for (const container of containers) {
      for (const portInfo of container.Ports || []) {
        if (portInfo.PublicPort) {
          usedPorts.add(portInfo.PublicPort);
        }
      }
    }
  } catch {
    // If we can't list containers, return empty set
  }

  return usedPorts;
}
