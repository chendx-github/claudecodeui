import { useEffect, useState } from 'react';
import { api } from '../../../utils/api';
import type { Project } from '../../../types/app';
import type { FileTreeNode } from '../types/types';

type UseFileTreeSearchArgs = {
  selectedProject: Project | null;
  includeIgnored?: boolean;
};

type UseFileTreeSearchResult = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  hasSearchQuery: boolean;
  searchResults: FileTreeNode[];
  searching: boolean;
  searchTruncated: boolean;
};

export function useFileTreeSearch({
  selectedProject,
  includeIgnored = false,
}: UseFileTreeSearchArgs): UseFileTreeSearchResult {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileTreeNode[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const hasSearchQuery = searchQuery.trim().length > 0;

  useEffect(() => {
    const projectName = selectedProject?.name;
    const query = searchQuery.trim();

    if (!projectName || !query) {
      setSearching(false);
      setSearchResults([]);
      setSearchTruncated(false);
      return;
    }

    let isActive = true;
    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      try {
        setSearching(true);
        const response = await api.searchFiles(projectName, query, {
          limit: 120,
          type: 'file',
          includeIgnored,
          signal: controller.signal,
        });

        if (!response.ok) {
          if (isActive) {
            setSearchResults([]);
            setSearchTruncated(false);
          }
          return;
        }

        const data = (await response.json()) as { results?: FileTreeNode[]; truncated?: boolean };
        if (!isActive) {
          return;
        }

        setSearchResults(Array.isArray(data.results) ? data.results : []);
        setSearchTruncated(Boolean(data.truncated));
      } catch (error) {
        if ((error as { name?: string }).name !== 'AbortError' && isActive) {
          console.error('Error searching files:', error);
          setSearchResults([]);
          setSearchTruncated(false);
        }
      } finally {
        if (isActive) {
          setSearching(false);
        }
      }
    }, 180);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [includeIgnored, searchQuery, selectedProject?.name]);

  return {
    searchQuery,
    setSearchQuery,
    hasSearchQuery,
    searchResults,
    searching,
    searchTruncated,
  };
}
