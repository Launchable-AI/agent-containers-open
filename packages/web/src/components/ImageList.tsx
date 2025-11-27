import { useState } from 'react';
import { Trash2, Box, Loader2, HardDrive } from 'lucide-react';
import { useImages } from '../hooks/useContainers';
import * as api from '../api/client';

export function ImageList() {
  const { data: images, isLoading, refetch } = useImages();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, tag: string) => {
    if (!confirm(`Delete image "${tag}"?`)) return;

    setDeletingId(id);
    try {
      await api.removeImage(id);
      refetch();
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
    setDeletingId(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-8 dark:bg-gray-800">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading images...
        </div>
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 dark:bg-gray-800">
        <div className="text-center">
          <Box className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 font-medium text-gray-900 dark:text-white">No images</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Build a Dockerfile to create an image, or create a container to auto-generate one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white dark:bg-gray-800">
      <div className="border-b px-4 py-3 dark:border-gray-700">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <Box className="h-5 w-5" />
          Built Images
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            {images.length}
          </span>
        </h3>
      </div>

      <div className="divide-y dark:divide-gray-700">
        {images.map((image) => {
          const tag = image.repoTags[0] || 'untagged';
          const isDeleting = deletingId === image.id;

          return (
            <div
              key={image.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {tag}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {formatSize(image.size)}
                  </span>
                  <span>Created: {formatDate(image.created)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 font-mono truncate">
                  {image.id.replace('sha256:', '').substring(0, 12)}
                </div>
              </div>

              <button
                onClick={() => handleDelete(image.id, tag)}
                disabled={isDeleting}
                className="ml-4 rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-gray-600"
                title="Delete image"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
