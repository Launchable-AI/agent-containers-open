import { useState, useEffect } from 'react';
import { X, FolderOpen, Loader2 } from 'lucide-react';
import { useConfig, useUpdateConfig } from '../hooks/useContainers';

interface SettingsModalProps {
  onClose: () => void;
}

const COMMON_PATHS = [
  '~/.ssh',
  '~/keys',
  '~/.config/acm/keys',
  '/tmp/ssh-keys',
];

// Check if File System Access API is available
const supportsDirectoryPicker = 'showDirectoryPicker' in window;

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { data: config, isLoading } = useConfig();
  const updateMutation = useUpdateConfig();

  const [sshKeysPath, setSshKeysPath] = useState('~/.ssh');
  const [customPath, setCustomPath] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [dataDirectory, setDataDirectory] = useState('');

  useEffect(() => {
    if (config) {
      const path = config.sshKeysDisplayPath;
      if (COMMON_PATHS.includes(path)) {
        setSshKeysPath(path);
        setUseCustom(false);
      } else {
        setCustomPath(path);
        setUseCustom(true);
      }
      setDataDirectory(config.dataDirectory || '');
    }
  }, [config]);

  const handlePickDirectory = async () => {
    try {
      // @ts-expect-error - showDirectoryPicker is not in all TS libs
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'home',
      });
      // Get the full path - this requires user permission
      // For security, browsers only give us the directory name, not the full path
      // We'll need to ask the user to confirm/edit the path
      const name = dirHandle.name;

      // Try to construct a reasonable path
      // The browser doesn't give us the absolute path for security reasons
      // So we'll set it as a starting point the user can edit
      const guessedPath = name.startsWith('.') ? `~/${name}` : `~/${name}`;
      setCustomPath(guessedPath);
      setUseCustom(true);
    } catch (err) {
      // User cancelled or error
      console.log('Directory picker cancelled or failed:', err);
    }
  };

  const handleSave = async () => {
    const pathToSave = useCustom ? customPath : sshKeysPath;
    await updateMutation.mutateAsync({
      sshKeysDisplayPath: pathToSave,
      dataDirectory: dataDirectory || undefined,
    });
    onClose();
  };

  const currentPath = useCustom ? customPath : sshKeysPath;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-white p-8 dark:bg-gray-800">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FolderOpen className="inline h-4 w-4 mr-1" />
              SSH Keys Display Path
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              This path will be shown in the SSH connect command. Set it to where you'll copy/download your SSH keys.
            </p>

            {/* Preset paths */}
            <div className="space-y-2 mb-3">
              {COMMON_PATHS.map((path) => (
                <label
                  key={path}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="sshPath"
                    checked={!useCustom && sshKeysPath === path}
                    onChange={() => {
                      setUseCustom(false);
                      setSshKeysPath(path);
                    }}
                    className="text-blue-600"
                  />
                  <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                    {path}
                  </code>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sshPath"
                  checked={useCustom}
                  onChange={() => setUseCustom(true)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Custom path
                </span>
              </label>
            </div>

            {/* Custom path input */}
            {useCustom && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="/path/to/ssh/keys"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  autoFocus
                />
                {supportsDirectoryPicker && (
                  <button
                    type="button"
                    onClick={handlePickDirectory}
                    className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    title="Browse for directory"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Browse
                  </button>
                )}
              </div>
            )}
            {useCustom && !supportsDirectoryPicker && (
              <p className="mt-1 text-xs text-gray-500">
                Tip: Use Chrome or Edge for directory picker support
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-md bg-gray-50 dark:bg-gray-900 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              SSH command preview:
            </p>
            <code className="text-xs text-gray-800 dark:text-gray-200 font-mono">
              ssh -i {currentPath}/container-name.pem -p 2222 root@localhost
            </code>
          </div>

          {/* Data Directory */}
          <div className="pt-4 border-t dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FolderOpen className="inline h-4 w-4 mr-1" />
              Data Directory
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Where volumes, SSH keys, and dockerfiles are stored. Volumes will be stored in subdirectories here for easy host access.
            </p>
            <input
              type="text"
              value={dataDirectory}
              onChange={(e) => setDataDirectory(e.target.value)}
              placeholder="Leave empty for default (project/data)"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white font-mono"
            />
            {dataDirectory && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Volumes path: {dataDirectory}/volumes/
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || (useCustom && !customPath)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
