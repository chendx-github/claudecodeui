import { useCallback, useState } from 'react';

type UseExpandedDirectoriesResult = {
  expandedDirs: Set<string>;
  toggleDirectory: (path: string) => void;
  resetExpandedDirectories: () => void;
  expandDirectories: (paths: string[]) => void;
  collapseAll: () => void;
};

export function useExpandedDirectories(): UseExpandedDirectoriesResult {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set());

  const toggleDirectory = useCallback((path: string) => {
    setExpandedDirs((previous) => {
      const next = new Set(previous);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  }, []);

  const expandDirectories = useCallback((paths: string[]) => {
    setExpandedDirs((previous) => {
      const next = new Set(previous);
      paths.forEach((path) => {
        if (path) {
          next.add(path);
        }
      });
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedDirs(new Set());
  }, []);

  return {
    expandedDirs,
    toggleDirectory,
    resetExpandedDirectories: collapseAll,
    expandDirectories,
    collapseAll,
  };
}
