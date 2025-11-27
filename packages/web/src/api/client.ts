// Dynamic server discovery
let cachedServerUrl: string | null = null;
const SERVER_PORTS_TO_TRY = [4001, 4002, 4003, 4004, 4005, 3001, 3002, 3003];

async function discoverServer(): Promise<string> {
  // Try cached URL first
  if (cachedServerUrl) {
    try {
      const response = await fetch(`${cachedServerUrl}/api/health`, { method: 'GET' });
      if (response.ok) {
        return cachedServerUrl;
      }
    } catch {
      // Server moved, re-discover
      cachedServerUrl = null;
    }
  }

  // Try each port
  for (const port of SERVER_PORTS_TO_TRY) {
    try {
      const url = `http://localhost:${port}`;
      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(500), // 500ms timeout per port
      });
      if (response.ok) {
        console.log(`🔗 Connected to API server on port ${port}`);
        cachedServerUrl = url;
        return url;
      }
    } catch {
      // Try next port
    }
  }

  throw new Error('Could not find API server. Is it running?');
}

async function getApiBase(): Promise<string> {
  const serverUrl = await discoverServer();
  return `${serverUrl}/api`;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: 'running' | 'stopped' | 'created' | 'exited' | 'paused';
  sshPort: number | null;
  sshCommand: string | null;
  volumes: Array<{ name: string; mountPath: string }>;
  createdAt: string;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt: string;
}

export interface ImageInfo {
  id: string;
  repoTags: string[];
  size: number;
  created: string;
}

export interface CreateContainerRequest {
  name: string;
  image?: string;
  dockerfile?: string;
  volumes?: Array<{ name: string; mountPath: string }>;
  env?: Record<string, string>;
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const apiBase = await getApiBase();

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Containers
export async function listContainers(): Promise<ContainerInfo[]> {
  return fetchAPI('/containers');
}

export async function getContainer(id: string): Promise<ContainerInfo> {
  return fetchAPI(`/containers/${id}`);
}

export async function createContainer(request: CreateContainerRequest): Promise<{
  container: ContainerInfo;
  sshKeyPath: string;
  sshCommand: string;
}> {
  return fetchAPI('/containers', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function startContainer(id: string): Promise<void> {
  await fetchAPI(`/containers/${id}/start`, { method: 'POST' });
}

export async function stopContainer(id: string): Promise<void> {
  await fetchAPI(`/containers/${id}/stop`, { method: 'POST' });
}

export async function removeContainer(id: string): Promise<void> {
  await fetchAPI(`/containers/${id}`, { method: 'DELETE' });
}

export async function downloadSshKey(id: string): Promise<Blob> {
  const apiBase = await getApiBase();
  const response = await fetch(`${apiBase}/containers/${id}/ssh-key`);
  if (!response.ok) {
    throw new Error('Failed to download SSH key');
  }
  return response.blob();
}

// Images
export async function listImages(): Promise<ImageInfo[]> {
  return fetchAPI('/images');
}

export async function pullImage(image: string): Promise<void> {
  await fetchAPI('/images/pull', {
    method: 'POST',
    body: JSON.stringify({ image }),
  });
}

// Volumes
export async function listVolumes(): Promise<VolumeInfo[]> {
  return fetchAPI('/volumes');
}

export async function createVolume(name: string): Promise<void> {
  await fetchAPI('/volumes', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function removeVolume(name: string): Promise<void> {
  await fetchAPI(`/volumes/${name}`, { method: 'DELETE' });
}

export async function getVolumeFiles(name: string): Promise<string[]> {
  const result = await fetchAPI<{ files: string[] }>(`/volumes/${name}/files`);
  return result.files;
}

// Dockerfiles
export async function listDockerfiles(): Promise<string[]> {
  return fetchAPI('/dockerfiles');
}

export async function getDockerfile(name: string): Promise<{ name: string; content: string }> {
  return fetchAPI(`/dockerfiles/${name}`);
}

export async function saveDockerfile(name: string, content: string): Promise<void> {
  await fetchAPI(`/dockerfiles/${name}`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function deleteDockerfile(name: string): Promise<void> {
  await fetchAPI(`/dockerfiles/${name}`, { method: 'DELETE' });
}

// Health
export async function checkHealth(): Promise<{ status: string; docker: string }> {
  return fetchAPI('/health');
}

// Config
export interface AppConfig {
  sshKeysDisplayPath: string;
}

export async function getConfig(): Promise<AppConfig> {
  return fetchAPI('/config');
}

export async function updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
  return fetchAPI('/config', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}
