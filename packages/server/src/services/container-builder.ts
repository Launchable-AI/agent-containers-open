import { execSync } from 'child_process';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dockerService from './docker.js';
import { findAvailableSshPort } from '../utils/port.js';
import type { CreateContainerRequest, ContainerInfo } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const SSH_KEYS_DIR = join(PROJECT_ROOT, 'data', 'ssh-keys');
const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates');

export interface ContainerBuildResult {
  container: ContainerInfo;
  privateKeyPath: string;
}

export async function buildAndCreateContainer(request: CreateContainerRequest): Promise<ContainerBuildResult> {
  const { name, image, dockerfile, volumes, ports, env } = request;

  // Generate SSH keypair using ssh-keygen (creates the private key file directly)
  const { publicKey } = await generateSshKeyPair(name);
  const privateKeyPath = join(SSH_KEYS_DIR, `${name}.pem`);

  // Determine which image to use
  let imageName: string;

  if (dockerfile) {
    // Build custom image with SSH support
    imageName = `acm-${name}:latest`;
    const dockerfileWithSsh = injectSshIntoDockerfile(dockerfile, publicKey);
    await dockerService.buildImage(dockerfileWithSsh, imageName);
  } else if (image) {
    // Build base image with SSH
    imageName = `acm-${name}:latest`;
    const baseDockerfile = await createSshDockerfile(image, publicKey);
    await dockerService.buildImage(baseDockerfile, imageName);
  } else {
    throw new Error('Either image or dockerfile must be provided');
  }

  // Find available SSH port
  const sshPort = await findAvailableSshPort();

  // Create container
  const container = await dockerService.createContainer({
    name,
    image: imageName,
    sshPort,
    volumes,
    ports,
    env,
  });

  // Start container
  await container.start();

  // Get container info
  const containerInfo = await dockerService.getContainer(container.id);
  if (!containerInfo) {
    throw new Error('Failed to get container info after creation');
  }

  return {
    container: containerInfo,
    privateKeyPath,
  };
}

export async function getPrivateKeyPath(containerName: string): Promise<string> {
  return join(SSH_KEYS_DIR, `${containerName}.pem`);
}

export async function getPrivateKey(containerName: string): Promise<string> {
  const keyPath = await getPrivateKeyPath(containerName);
  return readFile(keyPath, 'utf-8');
}

export async function cleanupContainerKeys(containerName: string): Promise<void> {
  const keyPath = join(SSH_KEYS_DIR, `${containerName}.pem`);
  try {
    await rm(keyPath);
  } catch {
    // Ignore if file doesn't exist
  }
}

async function generateSshKeyPair(name: string): Promise<{ publicKey: string; privateKey: string }> {
  await mkdir(SSH_KEYS_DIR, { recursive: true });

  const privateKeyPath = join(SSH_KEYS_DIR, `${name}.pem`);
  const publicKeyPath = join(SSH_KEYS_DIR, `${name}.pem.pub`);

  // Remove existing keys if present
  try { await rm(privateKeyPath); } catch { /* ignore */ }
  try { await rm(publicKeyPath); } catch { /* ignore */ }

  // Generate key pair using ssh-keygen
  execSync(`ssh-keygen -t rsa -b 4096 -f "${privateKeyPath}" -N "" -C "agent-container-${name}"`, {
    stdio: 'pipe',
  });

  // Read the generated keys
  const privateKey = await readFile(privateKeyPath, 'utf-8');
  const publicKey = await readFile(publicKeyPath, 'utf-8');

  // Clean up the .pub file (we only need the content)
  await rm(publicKeyPath);

  return { publicKey: publicKey.trim(), privateKey };
}

async function createSshDockerfile(baseImage: string, publicKey: string): Promise<string> {
  return `FROM ${baseImage}

RUN apt-get update && apt-get install -y \\
    openssh-server \\
    sudo \\
    curl \\
    git \\
    vim \\
    && rm -rf /var/lib/apt/lists/* \\
    && mkdir -p /var/run/sshd /root/.ssh \\
    && chmod 700 /root/.ssh \\
    && sed -i 's/#PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config \\
    && sed -i 's/#PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config

RUN echo '${publicKey}' > /root/.ssh/authorized_keys \\
    && chmod 600 /root/.ssh/authorized_keys

EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]
`;
}

function injectSshIntoDockerfile(dockerfile: string, publicKey: string): string {
  // Check if dockerfile already has SSH setup
  if (dockerfile.includes('openssh-server')) {
    // Just add the authorized_keys
    return dockerfile + `
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh
RUN echo '${publicKey}' > /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys
`;
  }

  // Add full SSH setup
  const sshSetup = `
RUN apt-get update && apt-get install -y openssh-server \\
    && mkdir -p /var/run/sshd /root/.ssh \\
    && chmod 700 /root/.ssh \\
    && sed -i 's/#PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config \\
    && sed -i 's/#PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config \\
    && rm -rf /var/lib/apt/lists/*

RUN echo '${publicKey}' > /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys

EXPOSE 22
`;

  // Replace CMD with sshd
  let modifiedDockerfile = dockerfile;

  // Remove existing CMD or ENTRYPOINT
  modifiedDockerfile = modifiedDockerfile.replace(/^(CMD|ENTRYPOINT).*$/gm, '');

  return modifiedDockerfile + sshSetup + '\nCMD ["/usr/sbin/sshd", "-D"]\n';
}
