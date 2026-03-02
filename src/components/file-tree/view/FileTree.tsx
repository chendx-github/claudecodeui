import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, Upload } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ImageViewer from './ImageViewer';
import { Button } from '../../ui/button';
import { ICON_SIZE_CLASS, getFileIconData } from '../constants/fileIcons';
import { useExpandedDirectories } from '../hooks/useExpandedDirectories';
import { useFileTreeData } from '../hooks/useFileTreeData';
import { useFileTreeSearch } from '../hooks/useFileTreeSearch';
import { useFileTreeViewMode } from '../hooks/useFileTreeViewMode';
import type { FileTreeImageSelection, FileTreeNode } from '../types/types';
import { formatFileSize, formatRelativeTime, isImageFile } from '../utils/fileTreeUtils';
import FileTreeBody from './FileTreeBody';
import FileTreeDetailedColumns from './FileTreeDetailedColumns';
import FileTreeHeader from './FileTreeHeader';
import FileTreeLoadingState from './FileTreeLoadingState';
import { Project } from '../../../types/app';
import { api } from '../../../utils/api';
import { useUiPreferences } from '../../../hooks/useUiPreferences';

type FileTreeProps =  {
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
  const [uploadingTargetPath, setUploadingTargetPath] = useState<string | null>(null);
  const [downloadingTargetPath, setDownloadingTargetPath] = useState<string | null>(null);
  const [pendingUploadTarget, setPendingUploadTarget] = useState<FileTreeNode | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

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
  const { expandedDirs, toggleDirectory, resetExpandedDirectories } = useExpandedDirectories();
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

  useEffect(() => {
    resetExpandedDirectories();
  }, [includeIgnoredDirectories, resetExpandedDirectories, selectedProject?.name]);

  const renderFileIcon = useCallback((filename: string) => {
    const { icon: Icon, color } = getFileIconData(filename);
    return <Icon className={cn(ICON_SIZE_CLASS, color)} />;
  }, []);

  // Centralized click behavior keeps file actions identical across all presentation modes.
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
          projectPath: selectedProject.path,
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
          console.error('Download failed:', response.status, errorText);
          return;
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
          const fallbackDownloadUrl = api.getFileContentUrl(selectedProject.name, item.path, {
            download: true,
            includeAuthToken: true,
            filename: item.name,
          });
          triggerDirectBrowserDownload(fallbackDownloadUrl);
        }
      } finally {
        setDownloadingTargetPath((previous) => (previous === item.path ? null : previous));
      }
    },
    [selectedProject?.name],
  );

  const triggerUploadForItem = useCallback((item: FileTreeNode, event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    setPendingUploadTarget(item);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
      uploadInputRef.current.click();
    }
  }, []);

  const handleUploadInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !pendingUploadTarget || !selectedProject?.name) {
        return;
      }

      setUploadingTargetPath(pendingUploadTarget.path);
      try {
        const response = await api.uploadFile(selectedProject.name, pendingUploadTarget.path, file, {
          overwrite: true,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Upload failed:', response.status, errorText);
          return;
        }

        await refreshRoot();
        resetExpandedDirectories();
      } catch (error) {
        console.error('Upload error:', error);
      } finally {
        setUploadingTargetPath(null);
        setPendingUploadTarget(null);
        if (uploadInputRef.current) {
          uploadInputRef.current.value = '';
        }
      }
    },
    [pendingUploadTarget, refreshRoot, resetExpandedDirectories, selectedProject?.name],
  );

  const renderItemActions = useCallback(
    (item: FileTreeNode) => {
      const isUploading = uploadingTargetPath === item.path;
      const isDownloading = downloadingTargetPath === item.path;

      return (
        <span
          className="flex items-center gap-0.5 ml-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
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
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(event) => triggerUploadForItem(item, event)}
            title={item.type === 'file' ? t('fileTree.uploadReplace') : t('fileTree.uploadToDirectory')}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          </Button>
        </span>
      );
    },
    [downloadingTargetPath, handleDownloadFile, t, triggerUploadForItem, uploadingTargetPath],
  );

  const formatRelativeTimeLabel = useCallback(
    (date?: string) => formatRelativeTime(date, t),
    [t],
  );

  if (loading) {
    return <FileTreeLoadingState />;
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          void handleUploadInputChange(event);
        }}
      />

      <FileTreeHeader
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        extraActions={(
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(event) => triggerUploadForItem({
              name: selectedProject?.name || 'project',
              path: selectedProject?.fullPath || selectedProject?.path || '',
              type: 'directory',
            }, event)}
            title={t('fileTree.uploadToProjectRoot')}
            disabled={uploadingTargetPath === (selectedProject?.fullPath || selectedProject?.path || '')}
          >
            {uploadingTargetPath === (selectedProject?.fullPath || selectedProject?.path || '') ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
          </Button>
        )}
      />

      {!hasSearchQuery && viewMode === 'detailed' && files.length > 0 && <FileTreeDetailedColumns />}

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
        onItemClick={handleItemClick}
        renderItemActions={renderItemActions}
        renderFileIcon={renderFileIcon}
        formatFileSize={formatFileSize}
        formatRelativeTime={formatRelativeTimeLabel}
      />

      {selectedImage && (
        <ImageViewer
          file={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}
