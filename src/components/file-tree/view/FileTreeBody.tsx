import type { ReactNode, RefObject } from 'react';
import { Folder, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  onRename?: (item: FileTreeNode) => void;
  onDelete?: (item: FileTreeNode) => void;
  onNewFile?: (path: string) => void;
  onNewFolder?: (path: string) => void;
  onCopyPath?: (item: FileTreeNode) => void;
  onDownload?: (item: FileTreeNode) => void;
  onRefresh?: () => void;
  renamingItem?: FileTreeNode | null;
  renameValue?: string;
  setRenameValue?: (value: string) => void;
  handleConfirmRename?: () => void;
  handleCancelRename?: () => void;
  renameInputRef?: RefObject<HTMLInputElement>;
  operationLoading?: boolean;
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
  onRename,
  onDelete,
  onNewFile,
  onNewFolder,
  onCopyPath,
  onDownload,
  onRefresh,
  renamingItem,
  renameValue,
  setRenameValue,
  handleConfirmRename,
  handleCancelRename,
  renameInputRef,
  operationLoading,
}: FileTreeBodyProps) {
  const { t } = useTranslation();

  if (files.length === 0 && !hasSearchQuery) {
    return (
      <FileTreeEmptyState
        icon={Folder}
        title={t('fileTree.noFilesFound')}
        description={t('fileTree.checkProjectPath')}
      />
    );
  }

  if (hasSearchQuery && searching) {
    return (
      <div className="py-8 text-center">
        <div className="text-sm text-muted-foreground">{t('fileTree.loading')}</div>
      </div>
    );
  }

  if (hasSearchQuery && searchResults.length === 0) {
    return (
      <FileTreeEmptyState
        icon={Search}
        title={t('fileTree.noMatchesFound')}
        description={t('fileTree.tryDifferentSearch')}
      />
    );
  }

  if (hasSearchQuery) {
    return (
      <div className="space-y-0.5">
        {searchResults.map((item) => (
          <div
            key={item.path}
            className="group flex items-start justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-accent/60 cursor-pointer"
            onClick={() => onItemClick(item)}
          >
            <div className="flex min-w-0 items-start gap-2">
              <span className="mt-0.5 ml-[18px] flex-shrink-0">{renderFileIcon(item.name)}</span>
              <div className="min-w-0">
                <div className="truncate text-[13px] leading-tight text-foreground/90">{item.name}</div>
                <div className="truncate font-mono text-[11px] leading-tight text-muted-foreground">
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
    );
  }

  return (
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
      onRename={onRename}
      onDelete={onDelete}
      onNewFile={onNewFile}
      onNewFolder={onNewFolder}
      onCopyPath={onCopyPath}
      onDownload={onDownload}
      onRefresh={onRefresh}
      renamingItem={renamingItem}
      renameValue={renameValue}
      setRenameValue={setRenameValue}
      handleConfirmRename={handleConfirmRename}
      handleCancelRename={handleCancelRename}
      renameInputRef={renameInputRef}
      operationLoading={operationLoading}
    />
  );
}
