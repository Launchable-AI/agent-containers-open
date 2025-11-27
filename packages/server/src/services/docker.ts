import Docker from 'dockerode';
import type { ContainerInfo, VolumeInfo, ImageInfo } from '../types/index.js';

const docker = new Docker();

const CONTAINER_LABEL = 'agent-container-management';

export async function listContainers(): Promise<ContainerInfo[]> {
  const containers = await docker.listContainers({
    all: true,
    filters: { label: [CONTAINER_LABEL] },
  });

  return containers.map((container) => {
    const sshPort = extractSshPort(container.Ports);
    return {
      id: container.Id,
      name: container.Names[0]?.replace(/^\//, '') || '',
      image: container.Image,
      status: container.Status,
      state: mapState(container.State),
      sshPort,
      sshCommand: sshPort ? `ssh -p ${sshPort} root@localhost` : null,
      volumes: extractVolumes(container.Mounts),
      createdAt: new Date(container.Created * 1000).toISOString(),
    };
  });
}

export async function getContainer(id: string): Promise<ContainerInfo | null> {
  try {
    const container = docker.getContainer(id);
    const info = await container.inspect();

    const sshPort = extractSshPortFromInspect(info.NetworkSettings.Ports);
    return {
      id: info.Id,
      name: info.Name.replace(/^\//, ''),
      image: info.Config.Image,
      status: info.State.Status,
      state: mapState(info.State.Status),
      sshPort,
      sshCommand: sshPort ? `ssh -p ${sshPort} root@localhost` : null,
      volumes: extractVolumesFromInspect(info.Mounts),
      createdAt: info.Created,
    };
  } catch {
    return null;
  }
}

export async function createContainer(options: {
  name: string;
  image: string;
  sshPort: number;
  volumes?: Array<{ name: string; mountPath: string }>;
  env?: Record<string, string>;
}): Promise<Docker.Container> {
  const { name, image, sshPort, volumes = [], env = {} } = options;

  const binds = volumes.map((v) => `${v.name}:${v.mountPath}`);
  const envArray = Object.entries(env).map(([k, v]) => `${k}=${v}`);

  const container = await docker.createContainer({
    name,
    Hostname: name,
    Image: image,
    Labels: { [CONTAINER_LABEL]: 'true' },
    Env: envArray,
    ExposedPorts: { '22/tcp': {} },
    HostConfig: {
      PortBindings: {
        '22/tcp': [{ HostPort: sshPort.toString() }],
      },
      Binds: binds.length > 0 ? binds : undefined,
      RestartPolicy: { Name: 'unless-stopped' },
    },
  });

  return container;
}

export async function startContainer(id: string): Promise<void> {
  const container = docker.getContainer(id);
  await container.start();
}

export async function stopContainer(id: string): Promise<void> {
  const container = docker.getContainer(id);
  await container.stop();
}

export async function removeContainer(id: string): Promise<void> {
  const container = docker.getContainer(id);
  await container.remove({ force: true });
}

export async function listImages(): Promise<ImageInfo[]> {
  const images = await docker.listImages();
  return images.map((img) => ({
    id: img.Id,
    repoTags: img.RepoTags || [],
    size: img.Size,
    created: new Date(img.Created * 1000).toISOString(),
  }));
}

export async function pullImage(imageName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) {
        reject(err);
        return;
      }
      docker.modem.followProgress(stream, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

export async function buildImage(dockerfile: string, tag: string): Promise<void> {
  const { Readable } = await import('stream');
  const tar = await createTarFromDockerfile(dockerfile);

  return new Promise((resolve, reject) => {
    docker.buildImage(tar, { t: tag }, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      if (!stream) {
        reject(new Error('No stream returned from buildImage'));
        return;
      }
      docker.modem.followProgress(stream, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

async function createTarFromDockerfile(dockerfile: string): Promise<NodeJS.ReadableStream> {
  const { pack } = await import('tar-stream');
  const { PassThrough } = await import('stream');

  const tarStream = pack();
  tarStream.entry({ name: 'Dockerfile' }, dockerfile);
  tarStream.finalize();

  return tarStream;
}

export async function listVolumes(): Promise<VolumeInfo[]> {
  const result = await docker.listVolumes({
    filters: { label: [CONTAINER_LABEL] },
  });

  return (result.Volumes || []).map((vol) => ({
    name: vol.Name,
    driver: vol.Driver,
    mountpoint: vol.Mountpoint,
    createdAt: (vol as { CreatedAt?: string }).CreatedAt || '',
  }));
}

export async function createVolume(name: string): Promise<void> {
  await docker.createVolume({
    Name: name,
    Labels: { [CONTAINER_LABEL]: 'true' },
  });
}

export async function removeVolume(name: string): Promise<void> {
  const volume = docker.getVolume(name);
  await volume.remove();
}

export async function getVolumeFiles(volumeName: string): Promise<string[]> {
  // Create a temporary container to list volume contents
  const container = await docker.createContainer({
    Image: 'alpine:latest',
    Cmd: ['find', '/data', '-type', 'f'],
    HostConfig: {
      Binds: [`${volumeName}:/data`],
      AutoRemove: true,
    },
  });

  await container.start();
  const result = await container.wait();
  const logs = await container.logs({ stdout: true, stderr: false });

  // Parse output, removing /data prefix
  const output = logs.toString().replace(/[\x00-\x1F]/g, '');
  return output.split('\n').filter(Boolean).map((f) => f.replace(/^\/data\/?/, ''));
}

export async function testConnection(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

function extractSshPort(ports: Docker.Port[]): number | null {
  const sshPort = ports.find((p) => p.PrivatePort === 22);
  return sshPort?.PublicPort || null;
}

function extractSshPortFromInspect(ports: Record<string, Array<{ HostPort: string }> | null>): number | null {
  const sshPorts = ports['22/tcp'];
  if (sshPorts && sshPorts.length > 0) {
    return parseInt(sshPorts[0].HostPort, 10);
  }
  return null;
}

function extractVolumes(mounts: Docker.ContainerInfo['Mounts']): Array<{ name: string; mountPath: string }> {
  return mounts
    .filter((m) => m.Type === 'volume')
    .map((m) => ({
      name: m.Name || '',
      mountPath: m.Destination,
    }));
}

function extractVolumesFromInspect(mounts: Array<{ Type: string; Name?: string; Destination: string }>): Array<{ name: string; mountPath: string }> {
  return mounts
    .filter((m) => m.Type === 'volume')
    .map((m) => ({
      name: m.Name || '',
      mountPath: m.Destination,
    }));
}

function mapState(state: string): ContainerInfo['state'] {
  const stateMap: Record<string, ContainerInfo['state']> = {
    running: 'running',
    exited: 'exited',
    created: 'created',
    paused: 'paused',
  };
  return stateMap[state.toLowerCase()] || 'stopped';
}

export { docker };
