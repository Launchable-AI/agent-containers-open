import { z } from 'zod';

export const CreateContainerSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    'Container name must start with alphanumeric and contain only alphanumeric, underscore, period, or hyphen'),
  image: z.string().optional(),
  dockerfile: z.string().optional(),
  volumes: z.array(z.object({
    name: z.string(),
    mountPath: z.string(),
  })).optional(),
  env: z.record(z.string()).optional(),
});

export type CreateContainerRequest = z.infer<typeof CreateContainerSchema>;

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

export const CreateVolumeSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    'Volume name must start with alphanumeric and contain only alphanumeric, underscore, period, or hyphen'),
});

export type CreateVolumeRequest = z.infer<typeof CreateVolumeSchema>;

export const SaveDockerfileSchema = z.object({
  content: z.string().min(1),
});

export type SaveDockerfileRequest = z.infer<typeof SaveDockerfileSchema>;

export const PullImageSchema = z.object({
  image: z.string().min(1),
});

export type PullImageRequest = z.infer<typeof PullImageSchema>;

export const BuildImageSchema = z.object({
  dockerfile: z.string().min(1),
  tag: z.string().min(1),
});

export type BuildImageRequest = z.infer<typeof BuildImageSchema>;
