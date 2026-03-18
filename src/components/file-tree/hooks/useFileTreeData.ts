import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../utils/api';
import type { Project } from '../../../types/app';
import type { FileTreeNode } from '../types/types';

type UseFileTreeDataOptions = {
  includeIgnored?: boolean;
};

type UseFileTreeDataResult = {
  files: FileTreeNode[];
  loading: boolean;
  loadedDirs: Set<string>;
  loadingDirs: Set<string>;
  refreshRoot: () => Promise<void>;
  refreshFiles: () => void;
  loadDirectoryChildren: (directoryPath: string) => Promise<void>;
};

function normalizeFileTreeItems(payload: unknown): FileTreeNode[] {
  return Array.isArray(payload) ? (payload as FileTreeNode[]) : [];
}

function updateDirectoryChildren(
  items: FileTreeNode[],
  targetPath: string,
  children: FileTreeNode[],
): FileTreeNode[] {
  return items.map((item) => {
    if (item.path === targetPath && item.type === 'directory') {
      return { ...item, children };
    }

    if (item.type === 'directory' && Array.isArray(item.children) && item.children.length > 0) {
      return {
        ...item,
        children: updateDirectoryChildren(item.children, targetPath, children),
      };
    }

    return item;
  });
}

export function useFileTreeData(
  selectedProject: Project | null,
  options: UseFileTreeDataOptions = {},
): UseFileTreeDataResult {
  const includeIgnored = Boolean(options.includeIgnored);
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedDirs, setLoadedDirs] = useState<Set<string>>(() => new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(() => new Set());
  const rootAbortControllerRef = useRef<AbortController | null>(null);
  const loadedDirsRef = useRef(loadedDirs);
  const loadingDirsRef = useRef(loadingDirs);

  useEffect(() => {
    loadedDirsRef.current = loadedDirs;
  }, [loadedDirs]);

  useEffect(() => {
    loadingDirsRef.current = loadingDirs;
  }, [loadingDirs]);

  const resetTreeState = useCallback(() => {
    setFiles([]);
    setLoadedDirs(new Set());
    setLoadingDirs(new Set());
  }, []);

  const refreshRoot = useCallback(async () => {
    const projectName = selectedProject?.name;

    if (!projectName) {
      rootAbortControllerRef.current?.abort();
      setLoading(false);
      resetTreeState();
      return;
    }

    rootAbortControllerRef.current?.abort();
    const controller = new AbortController();
    rootAbortControllerRef.current = controller;

    setLoading(true);
    try {
      const response = await api.listFiles(projectName, null, {
        includeIgnored,
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Root file fetch failed:', response.status, errorText);
        resetTreeState();
        return;
      }

      const data = await response.json();
      const rootItems = normalizeFileTreeItems((data as { items?: unknown }).items);
      setFiles(rootItems);
      setLoadedDirs(new Set());
      setLoadingDirs(new Set());
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        return;
      }
      console.error('Error fetching root files:', error);
      resetTreeState();
    } finally {
      if (rootAbortControllerRef.current === controller) {
        rootAbortControllerRef.current = null;
      }
      setLoading(false);
    }
  }, [includeIgnored, resetTreeState, selectedProject?.name]);

  const refreshFiles = useCallback(() => {
    void refreshRoot();
  }, [refreshRoot]);

  const loadDirectoryChildren = useCallback(
    async (directoryPath: string) => {
      const projectName = selectedProject?.name;
      if (!projectName || !directoryPath) {
        return;
      }

      if (loadedDirsRef.current.has(directoryPath) || loadingDirsRef.current.has(directoryPath)) {
        return;
      }

      setLoadingDirs((previous) => {
        const next = new Set(previous);
        next.add(directoryPath);
        return next;
      });

      try {
        const response = await api.listFiles(projectName, directoryPath, {
          includeIgnored,
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Directory fetch failed:', response.status, errorText);
          return;
        }

        const data = await response.json();
        const directoryItems = normalizeFileTreeItems((data as { items?: unknown }).items);
        setFiles((previous) => updateDirectoryChildren(previous, directoryPath, directoryItems));
        setLoadedDirs((previous) => {
          const next = new Set(previous);
          next.add(directoryPath);
          return next;
        });
      } catch (error) {
        console.error('Error fetching child directory:', error);
      } finally {
        setLoadingDirs((previous) => {
          const next = new Set(previous);
          next.delete(directoryPath);
          return next;
        });
      }
    },
    [includeIgnored, selectedProject?.name],
  );

  useEffect(() => {
    void refreshRoot();
    return () => {
      rootAbortControllerRef.current?.abort();
    };
  }, [refreshRoot]);

  return {
    files,
    loading,
    loadedDirs,
    loadingDirs,
    refreshRoot,
    refreshFiles,
    loadDirectoryChildren,
  };
}
