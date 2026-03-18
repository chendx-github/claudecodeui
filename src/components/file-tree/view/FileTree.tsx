import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Download, Folder, Loader2, Upload, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button, Input, ScrollArea } from '../../../shared/view/ui';
import type { Project } from '../../../types/app';
import { api } from '../../../utils/api';
import { useUiPreferences } from '../../../hooks/useUiPreferences';
import { ICON_SIZE_CLASS, getFileIconData } from '../constants/fileIcons';
import { useExpandedDirectories } from '../hooks/useExpandedDirectories';
import { useFileTreeData } from '../hooks/useFileTreeData';
import { useFileTreeOperations } from '../hooks/useFileTreeOperations';
import { useFileTreeSearch } from '../hooks/useFileTreeSearch';
import { useFileTreeUpload } from '../hooks/useFileTreeUpload';
import { useFileTreeViewMode } from '../hooks/useFileTreeViewMode';
import type { FileTreeImageSelection, FileTreeNode } from '../types/types';
import { formatFileSize, formatRelativeTime, isImageFile } from '../utils/fileTreeUtils';
import FileTreeBody from './FileTreeBody';
import FileTreeDetailedColumns from './FileTreeDetailedColumns';
import FileTreeHeader from './FileTreeHeader';
import FileTreeLoadingState from './FileTreeLoadingState';
import ImageViewer from './ImageViewer';

type FileTreeProps = {
  selectedProject: Project | null;
  onFileOpen?: (filePath: string) => void;
};

const MOBILE_DOWNLOAD_USER_AGENT_REGEX = /android|iphone|ipad|ipod|mobile|harmonyos|silk/i;

function shouldUseNativeDownloadFlow() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || '';
  const isMobileUserAgent = MOBILE_DOWNLOAD_USER_AGENT_REGEX.test(userAgent);
  const isCoarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

  return isMobileUserAgent || isCoarsePointer;
}

function triggerDirectBrowserDownload(url: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function FileTree({ selectedProject, onFileOpen }: FileTreeProps) {
  const { t } = useTranslation();
  const { preferences } = useUiPreferences();
  const { includeIgnoredDirectories } = preferences;
  const [selectedImage, setSelectedImage] = useState<FileTreeImageSelection | null>(null);
  const [pendingUploadTarget, setPendingUploadTarget] = useState<FileTreeNode | null>(null);
  const [uploadingTargetPath, setUploadingTargetPath] = useState<string | null>(null);
  const [downloadingTargetPath, setDownloadingTargetPath] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    loading,
    loadedDirs,
    loadingDirs,
    refreshRoot,
    loadDirectoryChildren,
  } = useFileTreeData(selectedProject, {
    includeIgnored: includeIgnoredDirectories,
  });
  const { viewMode, changeViewMode } = useFileTreeViewMode();
  const { expandedDirs, toggleDirectory, resetExpandedDirectories, collapseAll } = useExpandedDirectories();
  const {
    searchQuery,
    setSearchQuery,
    hasSearchQuery,
    searchResults,
    searching,
    searchTruncated,
  } = useFileTreeSearch({
    selectedProject,
    includeIgnored: includeIgnoredDirectories,
  });

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    resetExpandedDirectories();
  }, [includeIgnoredDirectories, resetExpandedDirectories, selectedProject?.name]);

  const refreshTree = useCallback(() => {
    resetExpandedDirectories();
    void refreshRoot();
  }, [refreshRoot, resetExpandedDirectories]);

  const operations = useFileTreeOperations({
    selectedProject,
    onRefresh: refreshTree,
    showToast,
  });

  const upload = useFileTreeUpload({
    selectedProject,
    onRefresh: refreshTree,
    showToast,
  });

  useEffect(() => {
    if (operations.isCreating && newItemInputRef.current) {
      newItemInputRef.current.focus();
      newItemInputRef.current.select();
    }
  }, [operations.isCreating]);

  useEffect(() => {
    if (operations.renamingItem && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [operations.renamingItem]);

  const renderFileIcon = useCallback((filename: string) => {
    const { icon: Icon, color } = getFileIconData(filename);
    return <Icon className={cn(ICON_SIZE_CLASS, color)} />;
  }, []);

  const formatRelativeTimeLabel = useCallback(
    (date?: string) => formatRelativeTime(date, t),
    [t],
  );

  const handleItemClick = useCallback(
    async (item: FileTreeNode) => {
      if (item.type === 'directory') {
        const isExpanded = expandedDirs.has(item.path);
        toggleDirectory(item.path);
        if (!isExpanded) {
          await loadDirectoryChildren(item.path);
        }
        return;
      }

      if (isImageFile(item.name) && selectedProject) {
        setSelectedImage({
          name: item.name,
          path: item.path,
          projectPath: selectedProject.fullPath || selectedProject.path,
          projectName: selectedProject.name,
        });
        return;
      }

      onFileOpen?.(item.path);
    },
    [expandedDirs, loadDirectoryChildren, onFileOpen, selectedProject, toggleDirectory],
  );

  const handleDownloadFile = useCallback(
    async (item: FileTreeNode, event?: MouseEvent<HTMLElement>) => {
      event?.stopPropagation();
      if (!selectedProject?.name || item.type !== 'file') {
        return;
      }

      setDownloadingTargetPath(item.path);
      try {
        if (shouldUseNativeDownloadFlow()) {
          const downloadUrl = api.getFileContentUrl(selectedProject.name, item.path, {
            download: true,
            includeAuthToken: true,
            filename: item.name,
          });
          triggerDirectBrowserDownload(downloadUrl);
          return;
        }

        const response = await api.downloadFile(selectedProject.name, item.path, {
          download: true,
          filename: item.name,
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Download failed with status ${response.status}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = item.name || 'download';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        console.error('Download error:', error);
        if (shouldUseNativeDownloadFlow()) {
          const fallbackUrl = api.getFileContentUrl(selectedProject.name, item.path, {
            download: true,
            includeAuthToken: true,
            filename: item.name,
          });
          triggerDirectBrowserDownload(fallbackUrl);
        } else {
          showToast(
            error instanceof Error ? error.message : t('fileTree.downloadFailed', 'Download failed'),
            'error',
          );
        }
      } finally {
        setDownloadingTargetPath((previous) => (previous === item.path ? null : previous));
      }
    },
    [selectedProject?.name, showToast, t],
  );

  const triggerUploadForTarget = useCallback((target: FileTreeNode, event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    setPendingUploadTarget(target);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
      uploadInputRef.current.click();
    }
  }, []);

  const triggerRootUpload = useCallback(() => {
    if (!selectedProject) {
      return;
    }

    triggerUploadForTarget(
      {
        name: selectedProject.name,
        path: '',
        type: 'directory',
      },
    );
  }, [selectedProject, triggerUploadForTarget]);

  const handleUploadInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !pendingUploadTarget || !selectedProject?.name) {
        return;
      }

      setUploadingTargetPath(pendingUploadTarget.path || '__root__');
      try {
        const response = await api.uploadFile(selectedProject.name, pendingUploadTarget.path, file, {
          overwrite: true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Upload failed with status ${response.status}`);
        }

        showToast(t('fileTree.uploadSuccess', { defaultValue: 'Upload completed' }), 'success');
        refreshTree();
      } catch (error) {
        console.error('Upload error:', error);
        showToast(
          error instanceof Error ? error.message : t('fileTree.uploadFailed', 'Upload failed'),
          'error',
        );
      } finally {
        setUploadingTargetPath(null);
        setPendingUploadTarget(null);
        if (uploadInputRef.current) {
          uploadInputRef.current.value = '';
        }
      }
    },
    [pendingUploadTarget, refreshTree, selectedProject?.name, showToast, t],
  );

  const renderItemActions = useCallback(
    (item: FileTreeNode) => {
      const uploadKey = item.path || '__root__';
      const isUploading = uploadingTargetPath === uploadKey;
      const isDownloading = downloadingTargetPath === item.path;

      return (
        <span
          className="ml-2 flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          {item.type === 'file' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(event) => void handleDownloadFile(item, event)}
              title={t('fileTree.downloadFile')}
              disabled={isDownloading || isUploading}
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(event) => triggerUploadForTarget(item, event)}
            title={item.type === 'file' ? t('fileTree.uploadReplace') : t('fileTree.uploadToDirectory')}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          </Button>
        </span>
      );
    },
    [downloadingTargetPath, handleDownloadFile, t, triggerUploadForTarget, uploadingTargetPath],
  );

  if (loading && files.length === 0) {
    return <FileTreeLoadingState />;
  }

  return (
    <div
      ref={upload.treeRef}
      className="relative flex h-full flex-col bg-background"
      onDragEnter={upload.handleDragEnter}
      onDragOver={upload.handleDragOver}
      onDragLeave={upload.handleDragLeave}
      onDrop={upload.handleDrop}
    >
      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        onChange={(event) => void handleUploadInputChange(event)}
      />

      {upload.isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-blue-500 bg-blue-500/10">
          <div className="flex items-center gap-3 rounded-lg bg-background/95 px-6 py-4 shadow-lg">
            <Upload className="h-6 w-6 text-blue-500" />
            <span className="text-sm font-medium">{t('fileTree.dropToUpload', 'Drop files to upload')}</span>
          </div>
        </div>
      )}

      <FileTreeHeader
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onNewFile={() => operations.handleStartCreate('', 'file')}
        onNewFolder={() => operations.handleStartCreate('', 'directory')}
        onRefresh={refreshTree}
        onCollapseAll={collapseAll}
        loading={loading}
        operationLoading={operations.operationLoading || upload.operationLoading}
        extraActions={
          selectedProject ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={triggerRootUpload}
              title={t('fileTree.uploadToDirectory')}
              aria-label={t('fileTree.uploadToDirectory')}
              disabled={Boolean(uploadingTargetPath)}
            >
              {uploadingTargetPath === '__root__' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null
        }
      />

      {viewMode === 'detailed' && !hasSearchQuery && files.length > 0 && <FileTreeDetailedColumns />}

      <ScrollArea className="flex-1 px-2 py-1">
        {operations.isCreating && (
          <div
            className="mb-1 flex items-center gap-1.5 py-[3px] pr-2"
            style={{ paddingLeft: `${Math.max(0, operations.newItemParent.split('/').filter(Boolean).length * 16 + 4)}px` }}
          >
            {operations.newItemType === 'directory' ? (
              <Folder className={cn(ICON_SIZE_CLASS, 'text-blue-500')} />
            ) : (
              <span className="ml-[18px]">{renderFileIcon(operations.newItemName)}</span>
            )}
            <Input
              ref={newItemInputRef}
              type="text"
              value={operations.newItemName}
              onChange={(event) => operations.setNewItemName(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') void operations.handleConfirmCreate();
                if (event.key === 'Escape') operations.handleCancelCreate();
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  if (operations.isCreating) {
                    void operations.handleConfirmCreate();
                  }
                }, 100);
              }}
              className="h-6 flex-1 text-sm"
              disabled={operations.operationLoading}
            />
          </div>
        )}

        <FileTreeBody
          files={files}
          searchResults={searchResults}
          searching={searching}
          searchTruncated={searchTruncated}
          hasSearchQuery={hasSearchQuery}
          viewMode={viewMode}
          expandedDirs={expandedDirs}
          loadedDirs={loadedDirs}
          loadingDirs={loadingDirs}
          onItemClick={(item) => void handleItemClick(item)}
          renderItemActions={renderItemActions}
          renderFileIcon={renderFileIcon}
          formatFileSize={formatFileSize}
          formatRelativeTime={formatRelativeTimeLabel}
          onRename={operations.handleStartRename}
          onDelete={operations.handleStartDelete}
          onNewFile={(path) => operations.handleStartCreate(path, 'file')}
          onNewFolder={(path) => operations.handleStartCreate(path, 'directory')}
          onCopyPath={operations.handleCopyPath}
          onDownload={operations.handleDownload}
          onRefresh={refreshTree}
          renamingItem={operations.renamingItem}
          renameValue={operations.renameValue}
          setRenameValue={operations.setRenameValue}
          handleConfirmRename={operations.handleConfirmRename}
          handleCancelRename={operations.handleCancelRename}
          renameInputRef={renameInputRef}
          operationLoading={operations.operationLoading}
        />
      </ScrollArea>

      {selectedImage && (
        <ImageViewer
          file={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {operations.deleteConfirmation.isOpen && operations.deleteConfirmation.item && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-sm rounded-lg border border-border bg-background p-4 shadow-lg">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">
                  {t('fileTree.delete.title', 'Delete {{type}}', {
                    type: operations.deleteConfirmation.item.type === 'directory' ? 'Folder' : 'File',
                  })}
                </h3>
                <p className="text-sm text-muted-foreground">{operations.deleteConfirmation.item.name}</p>
              </div>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              {operations.deleteConfirmation.item.type === 'directory'
                ? t('fileTree.delete.folderWarning', 'This folder and all its contents will be permanently deleted.')
                : t('fileTree.delete.fileWarning', 'This file will be permanently deleted.')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={operations.handleCancelDelete}
                disabled={operations.operationLoading}
                className="rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => void operations.handleConfirmDelete()}
                disabled={operations.operationLoading}
                className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {operations.operationLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('fileTree.delete.confirm', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-lg px-4 py-2 shadow-lg animate-in slide-in-from-bottom-2',
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
          )}
        >
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          <span className="text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
