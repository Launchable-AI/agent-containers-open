import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Save, Trash2, Plus, FileCode, Loader2, Hammer } from 'lucide-react';
import { useDockerfiles, useBuildDockerfile } from '../hooks/useContainers';
import * as api from '../api/client';

const DEFAULT_DOCKERFILE = `FROM ubuntu:24.04

# Install common development tools
RUN apt-get update && apt-get install -y \\
    curl \\
    wget \\
    git \\
    vim \\
    build-essential \\
    python3 \\
    python3-pip \\
    python3-venv \\
    nodejs \\
    npm \\
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# SSH will be injected automatically
`;

export function DockerfileEditor() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState(DEFAULT_DOCKERFILE);
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [buildMessage, setBuildMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: files, refetch } = useDockerfiles();
  const buildMutation = useBuildDockerfile();

  useEffect(() => {
    if (selectedFile) {
      api.getDockerfile(selectedFile).then((result) => {
        setContent(result.content);
      });
    }
  }, [selectedFile]);

  const handleSave = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await api.saveDockerfile(selectedFile, content);
      refetch();
    } catch (error) {
      console.error('Failed to save:', error);
    }
    setIsSaving(false);
  };

  const handleCreate = async () => {
    if (!newFileName) return;
    setIsSaving(true);
    try {
      await api.saveDockerfile(newFileName, DEFAULT_DOCKERFILE);
      setSelectedFile(newFileName);
      setContent(DEFAULT_DOCKERFILE);
      setNewFileName('');
      setIsCreating(false);
      refetch();
    } catch (error) {
      console.error('Failed to create:', error);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    if (!confirm(`Delete "${selectedFile}"?`)) return;

    setIsDeleting(true);
    try {
      await api.deleteDockerfile(selectedFile);
      setSelectedFile(null);
      setContent(DEFAULT_DOCKERFILE);
      refetch();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
    setIsDeleting(false);
  };

  const handleBuild = async () => {
    if (!selectedFile) return;
    setBuildMessage(null);

    try {
      const result = await buildMutation.mutateAsync(selectedFile);
      setBuildMessage({ type: 'success', text: `Image built: ${result.tag}` });
      setTimeout(() => setBuildMessage(null), 5000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Build failed';
      setBuildMessage({ type: 'error', text: message });
    }
  };

  return (
    <div className="rounded-lg border bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-700">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <FileCode className="h-5 w-5" />
          Dockerfiles
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={selectedFile || ''}
            onChange={(e) => setSelectedFile(e.target.value || null)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">New (unsaved)</option>
            {files?.map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>

          {isCreating ? (
            <div className="flex gap-1">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="filename"
                className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={!newFileName || isSaving}
                className="rounded-md bg-green-600 px-2 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New
              </button>
              {selectedFile && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={handleBuild}
                    disabled={buildMutation.isPending}
                    className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                    title="Build image from this Dockerfile"
                  >
                    {buildMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Hammer className="h-4 w-4" />
                    )}
                    Build
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {buildMessage && (
        <div
          className={`px-4 py-2 text-sm ${
            buildMessage.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {buildMessage.text}
        </div>
      )}

      <div className="h-[calc(100vh-400px)] min-h-[400px]">
        <Editor
          height="100%"
          defaultLanguage="dockerfile"
          value={content}
          onChange={(value) => setContent(value || '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}
