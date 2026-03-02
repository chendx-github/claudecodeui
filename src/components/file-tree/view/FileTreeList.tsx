import type { ReactNode } from 'react';
import type { FileTreeNode as FileTreeNodeType, FileTreeViewMode } from '../types/types';
import FileTreeNode from './FileTreeNode';

type FileTreeListProps = {
  items: FileTreeNodeType[];
  viewMode: FileTreeViewMode;
  expandedDirs: Set<string>;
  loadedDirs: Set<string>;
  loadingDirs: Set<string>;
  onItemClick: (item: FileTreeNodeType) => void;
  renderItemActions: (item: FileTreeNodeType) => ReactNode;
  renderFileIcon: (filename: string) => ReactNode;
  formatFileSize: (bytes?: number) => string;
  formatRelativeTime: (date?: string) => string;
};

export default function FileTreeList({
  items,
  viewMode,
  expandedDirs,
  loadedDirs,
  loadingDirs,
  onItemClick,
  renderItemActions,
  renderFileIcon,
  formatFileSize,
  formatRelativeTime,
}: FileTreeListProps) {
  return (
    <div>
      {items.map((item) => (
        <FileTreeNode
          key={item.path}
          item={item}
          level={0}
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
      ))}
    </div>
  );
}
