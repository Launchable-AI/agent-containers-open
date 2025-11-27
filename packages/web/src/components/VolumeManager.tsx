import { useState, useMemo } from 'react';
import { Plus, Trash2, Loader2, HardDrive, Box } from 'lucide-react';
import { useVolumes, useCreateVolume, useRemoveVolume, useContainers } from '../hooks/useContainers';

export function VolumeManager() {
  const [newVolumeName, setNewVolumeName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: volumes, isLoading } = useVolumes();
  const { data: containers } = useContainers();
  const createMutation = useCreateVolume();
  const removeMutation = useRemoveVolume();

  // Build a map of volume name -> containers using it
  const volumeUsage = useMemo(() => {
    const usage = new Map<string, Array<{ name: string; state: string }>>();

    if (containers) {
      for (const container of containers) {
        for (const vol of container.volumes) {
          const existing = usage.get(vol.name) || [];
          existing.push({ name: container.name, state: container.state });
          usage.set(vol.name, existing);
        }
      }
    }

    return usage;
  }, [containers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVolumeName) return;

    try {
      await createMutation.mutateAsync(newVolumeName);
      setNewVolumeName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create volume:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <HardDrive className="h-5 w-5" />
          Volumes
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Volume
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="mb-4 flex gap-2">
          <input
            type="text"
            value={newVolumeName}
            onChange={(e) => setNewVolumeName(e.target.value)}
            placeholder="volume-name"
            pattern="^[a-zA-Z0-9][a-zA-Z0-9_.-]*$"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            autoFocus
          />
          <button
            type="submit"
            disabled={createMutation.isPending || !newVolumeName}
            className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Create'
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </form>
      )}

      {volumes && volumes.length > 0 ? (
        <ul className="space-y-2">
          {volumes.map((volume) => {
            const usedBy = volumeUsage.get(volume.name) || [];
            const isInUse = usedBy.length > 0;

            return (
              <li
                key={volume.name}
                className="rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {volume.name}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {volume.driver}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const msg = isInUse
                        ? `Volume "${volume.name}" is in use by ${usedBy.length} container(s). Delete anyway?`
                        : `Delete volume "${volume.name}"?`;
                      if (confirm(msg)) {
                        removeMutation.mutate(volume.name);
                      }
                    }}
                    disabled={removeMutation.isPending}
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600 dark:hover:bg-gray-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {isInUse && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {usedBy.map((container) => (
                      <span
                        key={container.name}
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                          container.state === 'running'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <Box className="h-3 w-3" />
                        {container.name}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No volumes yet. Create one to persist data across containers.
        </p>
      )}
    </div>
  );
}
