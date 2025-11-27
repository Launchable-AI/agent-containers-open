import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useCreateContainer, useVolumes, useImages } from '../hooks/useContainers';

interface CreateContainerFormProps {
  onClose: () => void;
}

export function CreateContainerForm({ onClose }: CreateContainerFormProps) {
  const [name, setName] = useState('');
  const [image, setImage] = useState('ubuntu:24.04');
  const [selectedVolumes, setSelectedVolumes] = useState<
    Array<{ name: string; mountPath: string }>
  >([]);

  const createMutation = useCreateContainer();
  const { data: volumes } = useVolumes();
  const { data: images } = useImages();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createMutation.mutateAsync({
        name,
        image,
        volumes: selectedVolumes.length > 0 ? selectedVolumes : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create container:', error);
    }
  };

  // Common base images
  const commonImages = [
    'ubuntu:24.04',
    'ubuntu:22.04',
    'debian:bookworm',
    'debian:bullseye',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold dark:text-white">
            Create Container
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Container Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-agent-env"
              required
              pattern="^[a-zA-Z0-9][a-zA-Z0-9_.-]*$"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Base Image
            </label>
            <select
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {commonImages.map((img) => (
                <option key={img} value={img}>
                  {img}
                </option>
              ))}
              {images
                ?.flatMap((i) => i.repoTags)
                .filter((tag) => tag && !commonImages.includes(tag))
                .map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
            </select>
          </div>

          {/* Volumes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attach Volumes (mounted to /workspace)
            </label>

            {volumes && volumes.length > 0 ? (
              <div className="space-y-2 rounded-md border border-gray-300 dark:border-gray-600 p-3">
                {volumes.map((vol) => {
                  const isSelected = selectedVolumes.some((v) => v.name === vol.name);
                  return (
                    <label
                      key={vol.name}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVolumes([
                              ...selectedVolumes,
                              { name: vol.name, mountPath: '/workspace' },
                            ]);
                          } else {
                            setSelectedVolumes(
                              selectedVolumes.filter((v) => v.name !== vol.name)
                            );
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {vol.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No volumes available. Create one first.
              </p>
            )}
          </div>

          {/* Error message */}
          {createMutation.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {createMutation.error.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create Container
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
