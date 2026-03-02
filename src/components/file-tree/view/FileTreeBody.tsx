import type { ReactNode } from 'react';
import { Folder, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '../../ui/scroll-area';
import type { FileTreeNode, FileTreeViewMode } from '../types/types';
import FileTreeEmptyState from './FileTreeEmptyState';
import FileTreeList from './FileTreeList';

type FileTreeBodyProps = {
  files: FileTreeNode[];
  searchResults: FileTreeNode[];
  searching: boolean;
  searchTruncated: boolean;
  hasSearchQuery: boolean;
  viewMode: FileTreeViewMode;
  expandedDirs: Set<string>;
  loadedDirs: Set<string>;
  loadingDirs: Set<string>;
  onItemClick: (item: FileTreeNode) => void;
  renderItemActions: (item: FileTreeNode) => ReactNode;
  renderFileIcon: (filename: string) => ReactNode;
  formatFileSize: (bytes?: number) => string;
  formatRelativeTime: (date?: string) => string;
};

export default function FileTreeBody({
  files,
  searchResults,
  searching,
  searchTruncated,
  hasSearchQuery,
  viewMode,
  expandedDirs,
  loadedDirs,
  loadingDirs,
  onItemClick,
  renderItemActions,
  renderFileIcon,
  formatFileSize,
  formatRelativeTime,
}: FileTreeBodyProps) {
  const { t } = useTranslation();

  return (
    <ScrollArea className="flex-1 px-2 py-1">
      {files.length === 0 && !hasSearchQuery ? (
        <FileTreeEmptyState
          icon={Folder}
          title={t('fileTree.noFilesFound')}
          description={t('fileTree.checkProjectPath')}
        />
      ) : hasSearchQuery && searching ? (
        <div className="text-center py-8">
          <div className="text-sm text-muted-foreground">{t('fileTree.loading')}</div>
        </div>
      ) : hasSearchQuery && searchResults.length === 0 ? (
        <FileTreeEmptyState
          icon={Search}
          title={t('fileTree.noMatchesFound')}
          description={t('fileTree.tryDifferentSearch')}
        />
      ) : hasSearchQuery ? (
        <div className="space-y-0.5">
          {searchResults.map((item) => (
            <div
              key={item.path}
              className="group flex items-start justify-between gap-2 px-2 py-1.5 rounded-sm hover:bg-accent/60 cursor-pointer"
              onClick={() => onItemClick(item)}
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="mt-0.5 flex-shrink-0 ml-[18px]">{renderFileIcon(item.name)}</span>
                <div className="min-w-0">
                  <div className="text-[13px] leading-tight truncate text-foreground/90">{item.name}</div>
                  <div className="text-[11px] leading-tight text-muted-foreground font-mono truncate">
                    {item.relativePath || item.path}
                  </div>
                </div>
              </div>
              {renderItemActions(item)}
            </div>
          ))}
          {searchTruncated && (
            <div className="px-2 pt-2 text-xs text-muted-foreground">
              {t('fileTree.searchResultsTruncated', {
                defaultValue: 'Search results are truncated. Refine your query for more precise matches.',
              })}
            </div>
          )}
        </div>
      ) : (
        <FileTreeList
          items={files}
          viewMode={viewMode}
          expandedDirs={expandedDirs}
          loadedDirs={loadedDirs}
          loadingDirs={loadingDirs}
          onItemClick={onItemClick}
          renderItemActions={renderItemActions}
          renderFileIcon={renderFileIcon}
          formatFileSize={formatFileSize}
          formatRelativeTime={formatRelativeTime}
        />
      )}
    </ScrollArea>
  );
}
