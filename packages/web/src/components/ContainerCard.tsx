import { useState } from 'react';
import {
  Play,
  Square,
  Trash2,
  Terminal,
  Copy,
  Check,
  Download,
  HardDrive,
  Globe,
  Settings,
} from 'lucide-react';
import type { ContainerInfo } from '../api/client';
import { downloadSshKey } from '../api/client';
import {
  useStartContainer,
  useStopContainer,
  useRemoveContainer,
  useConfig,
} from '../hooks/useContainers';
import { ReconfigureModal } from './ReconfigureModal';

interface ContainerCardProps {
  container: ContainerInfo;
}

export function ContainerCard({ container }: ContainerCardProps) {
  const [copied, setCopied] = useState(false);
  const [showReconfigure, setShowReconfigure] = useState(false);
  const startMutation = useStartContainer();
  const stopMutation = useStopContainer();
  const removeMutation = useRemoveContainer();
  const { data: config } = useConfig();

  const sshKeysPath = config?.sshKeysDisplayPath || '~/.ssh';
  const isRunning = container.state === 'running';
  const isBuilding = container.state === 'building';
  const isFailed = container.state === 'failed';
  const isPending =
    startMutation.isPending || stopMutation.isPending || removeMutation.isPending;

  const sshCommand = container.sshPort
    ? `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o IdentitiesOnly=yes -i ${sshKeysPath}/acm.pem -p ${container.sshPort} dev@localhost`
    : null;

  const handleCopyCommand = async () => {
    if (sshCommand) {
      await navigator.clipboard.writeText(sshCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadKey = async () => {
    try {
      const blob = await downloadSshKey(container.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'acm.pem';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download SSH key:', error);
    }
  };

  const stateColors: Record<string, string> = {
    running: 'bg-green-500',
    exited: 'bg-red-500',
    created: 'bg-yellow-500',
    paused: 'bg-orange-500',
    stopped: 'bg-gray-500',
    building: 'bg-blue-500 animate-pulse',
    failed: 'bg-red-600',
  };

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${stateColors[container.state] || 'bg-gray-500'}`}
            title={container.state}
          />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {container.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {container.image}
            </p>
          </div>
        </div>

        {!isBuilding && (
          <div className="flex gap-1">
            {isRunning ? (
              <button
                onClick={() => stopMutation.mutate(container.id)}
                disabled={isPending}
                className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-orange-600 disabled:opacity-50 dark:hover:bg-gray-700"
                title="Stop"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : !isFailed && (
              <button
                onClick={() => startMutation.mutate(container.id)}
                disabled={isPending}
                className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-green-600 disabled:opacity-50 dark:hover:bg-gray-700"
                title="Start"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            {!isFailed && (
              <button
                onClick={() => setShowReconfigure(true)}
                disabled={isPending}
                className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50 dark:hover:bg-gray-700"
                title="Reconfigure ports/volumes"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
            {!isFailed && (
              <button
                onClick={() => {
                  if (confirm(`Delete container "${container.name}"?`)) {
                    removeMutation.mutate(container.id);
                  }
                }}
                disabled={isPending}
                className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-gray-700"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* SSH Connection */}
      {container.sshPort && sshCommand && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Terminal className="h-4 w-4 shrink-0" />
            <span>SSH Port: {container.sshPort}</span>
          </div>
          <div className="mt-2 rounded bg-gray-100 dark:bg-gray-900 p-2">
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs text-gray-800 dark:text-gray-200 font-mono whitespace-nowrap overflow-x-auto scrollbar-thin">
                {sshCommand}
              </code>
              <div className="flex shrink-0">
                <button
                  onClick={handleCopyCommand}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="Copy command"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleDownloadKey}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="Download SSH key"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Volumes */}
      {container.volumes.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <HardDrive className="h-4 w-4" />
            <span>Volumes:</span>
          </div>
          <ul className="mt-1 space-y-1">
            {container.volumes.map((vol) => (
              <li
                key={vol.name}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                {vol.name} → {vol.mountPath}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ports */}
      {container.ports && container.ports.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Globe className="h-4 w-4" />
            <span>Ports:</span>
          </div>
          <ul className="mt-1 space-y-1">
            {container.ports.map((port) => (
              <li
                key={`${port.host}-${port.container}`}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                <a
                  href={`http://localhost:${port.host}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 hover:underline"
                >
                  localhost:{port.host}
                </a>
                {' → '}container:{port.container}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400">
        {container.status}
      </div>

      {/* Reconfigure Modal */}
      {showReconfigure && (
        <ReconfigureModal
          container={container}
          onClose={() => setShowReconfigure(false)}
        />
      )}
    </div>
  );
}
