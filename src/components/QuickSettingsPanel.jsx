import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Eye,
  Settings2,
  Moon,
  Sun,
  ArrowDown,
  Mic,
  Brain,
  Sparkles,
  FileText,
  Languages,
  GripVertical,
  Folder,
  Terminal
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DarkModeToggle from './DarkModeToggle';
import { CODEX_MODELS, CODEX_REASONING_LEVELS } from '../../shared/modelConstants';

import { useUiPreferences } from '../hooks/useUiPreferences';
import { useTheme } from '../contexts/ThemeContext';
import LanguageSelector from './LanguageSelector';
import { authenticatedFetch } from '../utils/api';

import { useDeviceSettings } from '../hooks/useDeviceSettings';


const QuickSettingsPanel = () => {
  const { t } = useTranslation('settings');
  const [isOpen, setIsOpen] = useState(false);
  const [shellCodexModel, setShellCodexModel] = useState(() => {
    return localStorage.getItem('shell-codex-model') || localStorage.getItem('codex-model') || '';
  });
  const [shellCodexReasoning, setShellCodexReasoning] = useState(() => {
    return (
      localStorage.getItem('shell-codex-reasoning') ||
      localStorage.getItem('codex-reasoning-effort') ||
      CODEX_REASONING_LEVELS.DEFAULT
    );
  });
  const [shellCodexExtraArgs, setShellCodexExtraArgs] = useState(() => {
    return localStorage.getItem('shell-codex-extra-args') || '';
  });
  const [whisperMode, setWhisperMode] = useState(() => {
    return localStorage.getItem('whisperMode') || 'default';
  });
  const [codexAutoDiscoverProjects, setCodexAutoDiscoverProjects] = useState(true);
  const [isCodexPreferenceLoading, setIsCodexPreferenceLoading] = useState(true);
  const [isCodexPreferenceSaving, setIsCodexPreferenceSaving] = useState(false);
  const { isDarkMode } = useTheme();

  const { isMobile } = useDeviceSettings({ trackPWA: false });

  const { preferences, setPreference } = useUiPreferences();
  const {
    autoExpandTools,
    showRawParameters,
    showThinking,
    showInjectedContext,
    autoScrollToBottom,
    sendByCtrlEnter,
    includeIgnoredDirectories,
  } = preferences;

  // Draggable handle state
  const [handlePosition, setHandlePosition] = useState(() => {
    const saved = localStorage.getItem('quickSettingsHandlePosition');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.y ?? 50;
      } catch {
        // Remove corrupted data
        localStorage.removeItem('quickSettingsHandlePosition');
        return 50;
      }
    }
    return 50; // Default to 50% (middle of screen)
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartPosition, setDragStartPosition] = useState(0);
  const [hasMoved, setHasMoved] = useState(false); // Track if user has moved during drag
  const handleRef = useRef(null);
  const constraintsRef = useRef({ min: 10, max: 90 }); // Percentage constraints
  const dragThreshold = 5; // Pixels to move before it's considered a drag

  // Save handle position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('quickSettingsHandlePosition', JSON.stringify({ y: handlePosition }));
  }, [handlePosition]);

  useEffect(() => {
    const trimmedModel = shellCodexModel.trim();
    if (trimmedModel) {
      localStorage.setItem('shell-codex-model', trimmedModel);
    } else {
      localStorage.removeItem('shell-codex-model');
    }
  }, [shellCodexModel]);

  useEffect(() => {
    const normalizedReasoning = shellCodexReasoning.trim();
    if (normalizedReasoning) {
      localStorage.setItem('shell-codex-reasoning', normalizedReasoning);
    } else {
      localStorage.removeItem('shell-codex-reasoning');
    }
  }, [shellCodexReasoning]);

  useEffect(() => {
    const normalizedArgs = shellCodexExtraArgs.trim();
    if (normalizedArgs) {
      localStorage.setItem('shell-codex-extra-args', normalizedArgs);
    } else {
      localStorage.removeItem('shell-codex-extra-args');
    }
  }, [shellCodexExtraArgs]);

  useEffect(() => {
    let cancelled = false;

    const loadUiSettings = async () => {
      setIsCodexPreferenceLoading(true);
      try {
        const response = await authenticatedFetch('/api/settings/ui-preferences');
        if (!response.ok) {
          throw new Error(`Failed to fetch UI preferences: ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        if (typeof data?.preferences?.codexAutoDiscoverProjects === 'boolean') {
          setCodexAutoDiscoverProjects(data.preferences.codexAutoDiscoverProjects);
        }
      } catch (error) {
        console.error('Error loading UI preferences:', error);
      } finally {
        if (!cancelled) {
          setIsCodexPreferenceLoading(false);
        }
      }
    };

    void loadUiSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCodexAutoDiscoverToggle = useCallback(
    async (nextValue) => {
      const previousValue = codexAutoDiscoverProjects;
      setCodexAutoDiscoverProjects(nextValue);
      setIsCodexPreferenceSaving(true);

      try {
        const response = await authenticatedFetch('/api/settings/ui-preferences', {
          method: 'PATCH',
          body: JSON.stringify({ codexAutoDiscoverProjects: nextValue }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update UI preferences: ${response.status}`);
        }

        const data = await response.json();
        if (typeof data?.preferences?.codexAutoDiscoverProjects === 'boolean') {
          setCodexAutoDiscoverProjects(data.preferences.codexAutoDiscoverProjects);
        }

        window.dispatchEvent(new CustomEvent('projects:refresh-request'));
      } catch (error) {
        console.error('Error updating UI preferences:', error);
        setCodexAutoDiscoverProjects(previousValue);
      } finally {
        setIsCodexPreferenceSaving(false);
      }
    },
    [codexAutoDiscoverProjects],
  );

  // Calculate position from percentage
  const getPositionStyle = useCallback(() => {
    if (isMobile) {
      // On mobile, convert percentage to pixels from bottom
      const bottomPixels = (window.innerHeight * handlePosition) / 100;
      return { bottom: `${bottomPixels}px` };
    } else {
      // On desktop, use top with percentage
      return { top: `${handlePosition}%`, transform: 'translateY(-50%)' };
    }
  }, [handlePosition, isMobile]);

  // Handle mouse/touch start
  const handleDragStart = useCallback((e) => {
    // Don't prevent default yet - we want to allow click if no drag happens
    e.stopPropagation();

    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    setDragStartY(clientY);
    setDragStartPosition(handlePosition);
    setHasMoved(false);
    setIsDragging(false); // Don't set dragging until threshold is passed
  }, [handlePosition]);

  // Handle mouse/touch move
  const handleDragMove = useCallback((e) => {
    if (dragStartY === 0) return; // Not in a potential drag

    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const deltaY = Math.abs(clientY - dragStartY);

    // Check if we've moved past threshold
    if (!isDragging && deltaY > dragThreshold) {
      setIsDragging(true);
      setHasMoved(true);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      // Prevent body scroll on mobile during drag
      if (e.type.includes('touch')) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
      }
    }

    if (!isDragging) return;

    // Prevent scrolling on touch move
    if (e.type.includes('touch')) {
      e.preventDefault();
    }

    const actualDeltaY = clientY - dragStartY;

    // For top-based positioning (desktop), moving down increases top percentage
    // For bottom-based positioning (mobile), we need to invert
    let percentageDelta;
    if (isMobile) {
      // On mobile, moving down should decrease bottom position (increase percentage from top)
      percentageDelta = -(actualDeltaY / window.innerHeight) * 100;
    } else {
      // On desktop, moving down should increase top position
      percentageDelta = (actualDeltaY / window.innerHeight) * 100;
    }

    let newPosition = dragStartPosition + percentageDelta;

    // Apply constraints
    newPosition = Math.max(constraintsRef.current.min, Math.min(constraintsRef.current.max, newPosition));

    setHandlePosition(newPosition);
  }, [isDragging, dragStartY, dragStartPosition, isMobile, dragThreshold]);

  // Handle mouse/touch end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragStartY(0);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Restore body scroll on mobile
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }, []);

  // Cleanup body styles on unmount in case component unmounts while dragging
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  // Set up global event listeners for drag
  useEffect(() => {
    if (dragStartY !== 0) {
      // Mouse events
      const handleMouseMove = (e) => handleDragMove(e);
      const handleMouseUp = () => handleDragEnd();

      // Touch events
      const handleTouchMove = (e) => handleDragMove(e);
      const handleTouchEnd = () => handleDragEnd();

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [dragStartY, handleDragMove, handleDragEnd]);

  const handleToggle = (e) => {
    // Don't toggle if user was dragging
    if (hasMoved) {
      e.preventDefault();
      setHasMoved(false);
      return;
    }

    setIsOpen((previous) => !previous);
  };

  const shellModelOptions =
    shellCodexModel && !CODEX_MODELS.OPTIONS.some(({ value }) => value === shellCodexModel)
      ? [{ value: shellCodexModel, label: shellCodexModel }, ...CODEX_MODELS.OPTIONS]
      : CODEX_MODELS.OPTIONS;
  const shellReasoningOptions =
    shellCodexReasoning &&
    !CODEX_REASONING_LEVELS.OPTIONS.some(({ value }) => value === shellCodexReasoning)
      ? [{ value: shellCodexReasoning, label: shellCodexReasoning }, ...CODEX_REASONING_LEVELS.OPTIONS]
      : CODEX_REASONING_LEVELS.OPTIONS;

  return (
    <>
      {/* Pull Tab - Combined drag handle and toggle button */}
      <button
        ref={handleRef}
        onClick={handleToggle}
        onMouseDown={(e) => {
          // Start drag on mousedown
          handleDragStart(e);
        }}
        onTouchStart={(e) => {
          // Start drag on touchstart
          handleDragStart(e);
        }}
        className={`fixed ${
          isOpen ? 'right-64' : 'right-0'
        } z-50 ${isDragging ? '' : 'transition-all duration-150 ease-out'} bg-white dark:bg-gray-800 border ${
          isDragging ? 'border-blue-500 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700'
        } rounded-l-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-lg ${
          isDragging ? 'cursor-grabbing' : 'cursor-pointer'
        } touch-none`}
        style={{ ...getPositionStyle(), touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        aria-label={isDragging ? t('quickSettings.dragHandle.dragging') : isOpen ? t('quickSettings.dragHandle.closePanel') : t('quickSettings.dragHandle.openPanel')}
        title={isDragging ? t('quickSettings.dragHandle.draggingStatus') : t('quickSettings.dragHandle.toggleAndMove')}
      >
        {isDragging ? (
          <GripVertical className="h-5 w-5 text-blue-500 dark:text-blue-400" />
        ) : isOpen ? (
          <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        )}
      </button>

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-background border-l border-border shadow-xl transform transition-transform duration-150 ease-out z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${isMobile ? 'h-screen' : ''}`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              {t('quickSettings.title')}
            </h3>
          </div>

          {/* Settings Content */}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 bg-background ${isMobile ? 'pb-mobile-nav' : ''}`}>
            {/* Appearance Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{t('quickSettings.sections.appearance')}</h4>

              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  {isDarkMode ? <Moon className="h-4 w-4 text-gray-600 dark:text-gray-400" /> : <Sun className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
                  {t('quickSettings.darkMode')}
                </span>
                <DarkModeToggle />
              </div>

              {/* Language Selector */}
              <div>
                <LanguageSelector compact={true} />
              </div>
            </div>

            {/* Tool Display Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{t('quickSettings.sections.toolDisplay')}</h4>

              <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Maximize2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.autoExpandTools')}
                </span>
                <input
                  type="checkbox"
                  checked={autoExpandTools}
                  onChange={(e) => setPreference('autoExpandTools', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 focus:ring-2 dark:focus:ring-blue-400 bg-gray-100 dark:bg-gray-800 checked:bg-blue-600 dark:checked:bg-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Eye className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.showRawParameters')}
                </span>
                <input
                  type="checkbox"
                  checked={showRawParameters}
                  onChange={(e) => setPreference('showRawParameters', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 focus:ring-2 dark:focus:ring-blue-400 bg-gray-100 dark:bg-gray-800 checked:bg-blue-600 dark:checked:bg-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Brain className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.showThinking')}
                </span>
                <input
                  type="checkbox"
                  checked={showThinking}
                  onChange={(e) => setPreference('showThinking', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 focus:ring-2 dark:focus:ring-blue-400 bg-gray-100 dark:bg-gray-800 checked:bg-blue-600 dark:checked:bg-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.showInjectedContext')}
                </span>
                <input
                  type="checkbox"
                  checked={showInjectedContext}
                  onChange={(e) => setPreference('showInjectedContext', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 focus:ring-2 dark:focus:ring-blue-400 bg-gray-100 dark:bg-gray-800 checked:bg-blue-600 dark:checked:bg-blue-600"
                />
              </label>
            </div>
            {/* View Options */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{t('quickSettings.sections.viewOptions')}</h4>

              <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <ArrowDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.autoScrollToBottom')}
                </span>
                <input
                  type="checkbox"
                  checked={autoScrollToBottom}
                  onChange={(e) => setPreference('autoScrollToBottom', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 focus:ring-2 dark:focus:ring-blue-400 bg-gray-100 dark:bg-gray-800 checked:bg-blue-600 dark:checked:bg-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Folder className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.showIgnoredDirectories')}
                </span>
                <input
                  type="checkbox"
                  checked={includeIgnoredDirectories}
                  onChange={(e) => setPreference('includeIgnoredDirectories', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 focus:ring-2 dark:focus:ring-blue-400 bg-gray-100 dark:bg-gray-800 checked:bg-blue-600 dark:checked:bg-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Folder className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.autoDiscoverCodexProjects')}
                </span>
                <input
                  type="checkbox"
                  checked={codexAutoDiscoverProjects}
                  disabled={isCodexPreferenceLoading || isCodexPreferenceSaving}
                  onChange={(e) => {
                    void handleCodexAutoDiscoverToggle(e.target.checked);
                  }}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 focus:ring-2 dark:focus:ring-blue-400 bg-gray-100 dark:bg-gray-800 checked:bg-blue-600 dark:checked:bg-blue-600 disabled:opacity-60"
                />
              </label>
            </div>

            {/* Shell Launch Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                {t('quickSettings.sections.shellLaunch')}
              </h4>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-white mb-2">
                  <Terminal className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.shell.codexModel')}
                </label>
                <select
                  value={shellCodexModel}
                  onChange={(event) => setShellCodexModel(event.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('quickSettings.shell.useSessionDefault')}</option>
                  {shellModelOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-white mb-2">
                  <Brain className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.shell.reasoningLevel')}
                </label>
                <select
                  value={shellCodexReasoning}
                  onChange={(event) => setShellCodexReasoning(event.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {shellReasoningOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-white mb-2">
                  <Settings2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.shell.extraArgs')}
                </label>
                <input
                  type="text"
                  value={shellCodexExtraArgs}
                  onChange={(event) => setShellCodexExtraArgs(event.target.value)}
                  placeholder={t('quickSettings.shell.extraArgsPlaceholder')}
                  className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t('quickSettings.shell.appliesOnReconnect')}
                </p>
              </div>
            </div>

            {/* Input Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{t('quickSettings.sections.inputSettings')}</h4>

              <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                  <Languages className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  {t('quickSettings.sendByCtrlEnter')}
                </span>
                <input
                  type="checkbox"
                  checked={sendByCtrlEnter}
                  onChange={(e) => setPreference('sendByCtrlEnter', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 focus:ring-2 dark:focus:ring-blue-400 bg-gray-100 dark:bg-gray-800 checked:bg-blue-600 dark:checked:bg-blue-600"
                />
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-3">
                {t('quickSettings.sendByCtrlEnterDescription')}
              </p>
            </div>

            {/* Whisper Dictation Settings - HIDDEN */}
            <div className="space-y-2" style={{ display: 'none' }}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{t('quickSettings.sections.whisperDictation')}</h4>
              
              <div className="space-y-2">
                <label className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                  <input
                    type="radio"
                    name="whisperMode"
                    value="default"
                    checked={whisperMode === 'default'}
                    onChange={() => {
                      setWhisperMode('default');
                      localStorage.setItem('whisperMode', 'default');
                      window.dispatchEvent(new Event('whisperModeChanged'));
                    }}
                    className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                  />
                  <div className="ml-3 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Mic className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      {t('quickSettings.whisper.modes.default')}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('quickSettings.whisper.modes.defaultDescription')}
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                  <input
                    type="radio"
                    name="whisperMode"
                    value="prompt"
                    checked={whisperMode === 'prompt'}
                    onChange={() => {
                      setWhisperMode('prompt');
                      localStorage.setItem('whisperMode', 'prompt');
                      window.dispatchEvent(new Event('whisperModeChanged'));
                    }}
                    className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                  />
                  <div className="ml-3 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <Sparkles className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      {t('quickSettings.whisper.modes.prompt')}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('quickSettings.whisper.modes.promptDescription')}
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                  <input
                    type="radio"
                    name="whisperMode"
                    value="vibe"
                    checked={whisperMode === 'vibe' || whisperMode === 'instructions' || whisperMode === 'architect'}
                    onChange={() => {
                      setWhisperMode('vibe');
                      localStorage.setItem('whisperMode', 'vibe');
                      window.dispatchEvent(new Event('whisperModeChanged'));
                    }}
                    className="mt-0.5 h-4 w-4 border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:checked:bg-blue-600"
                  />
                  <div className="ml-3 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                      <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      {t('quickSettings.whisper.modes.vibe')}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('quickSettings.whisper.modes.vibeDescription')}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 transition-opacity duration-150 ease-out"
          onClick={handleToggle}
        />
      )}
    </>
  );
};

export default QuickSettingsPanel;
