import React, { useCallback, useEffect, useRef, useState } from 'react';
import QuickSettingsPanel from '../../QuickSettingsPanel';
import { useTasksSettings } from '../../../contexts/TasksSettingsContext';
import { useTranslation } from 'react-i18next';
import ChatMessagesPane from './subcomponents/ChatMessagesPane';
import ChatComposer from './subcomponents/ChatComposer';
import type { ChatInterfaceProps } from '../types/types';
import { api } from '../../../utils/api';
import { copyTextToClipboard } from '../../../utils/clipboard';
import { useChatProviderState } from '../hooks/useChatProviderState';
import { useChatSessionState } from '../hooks/useChatSessionState';
import { useChatRealtimeHandlers } from '../hooks/useChatRealtimeHandlers';
import { useChatComposerState } from '../hooks/useChatComposerState';
import type { Provider } from '../types/types';

type PendingViewSession = {
  sessionId: string | null;
  startedAt: number;
};

function isLaunchableSessionId(sessionId: string | null | undefined): sessionId is string {
  return Boolean(sessionId && !sessionId.startsWith('new-session-'));
}

function ChatInterface({
  selectedProject,
  selectedSession,
  ws,
  sendMessage,
  latestMessage,
  onFileOpen,
  onInputFocusChange,
  onSessionActive,
  onSessionInactive,
  onSessionProcessing,
  onSessionNotProcessing,
  processingSessions,
  onReplaceTemporarySession,
  onNavigateToSession,
  onShowSettings,
  autoExpandTools,
  showRawParameters,
  showThinking,
  showInjectedContext,
  autoScrollToBottom,
  sendByCtrlEnter,
  externalMessageUpdate,
  onShowAllTasks,
}: ChatInterfaceProps) {
  const { tasksEnabled, isTaskMasterInstalled } = useTasksSettings();
  const { t } = useTranslation('chat');

  const streamBufferRef = useRef('');
  const streamTimerRef = useRef<number | null>(null);
  const pendingViewSessionRef = useRef<PendingViewSession | null>(null);
  const launchCommandRequestRef = useRef(0);
  const copiedResetTimerRef = useRef<number | null>(null);

  const [launchCommand, setLaunchCommand] = useState('');
  const [isLaunchCommandLoading, setIsLaunchCommandLoading] = useState(false);
  const [isLaunchCommandCopied, setIsLaunchCommandCopied] = useState(false);

  const resetStreamingState = useCallback(() => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    streamBufferRef.current = '';
  }, []);

  const {
    provider,
    setProvider,
    cursorModel,
    setCursorModel,
    claudeModel,
    setClaudeModel,
    codexModel,
    setCodexModel,
    codexModelOptions,
    codexReasoningEffort,
    setCodexReasoningEffort,
    modelReasoningControlsEnabled,
    setModelReasoningControlsEnabled,
    geminiModel,
    setGeminiModel,
    permissionMode,
    pendingPermissionRequests,
    setPendingPermissionRequests,
    cyclePermissionMode,
  } = useChatProviderState({
    selectedSession,
  });

  const {
    chatMessages,
    setChatMessages,
    isLoading,
    setIsLoading,
    currentSessionId,
    setCurrentSessionId,
    sessionMessages,
    setSessionMessages,
    isLoadingSessionMessages,
    isLoadingMoreMessages,
    hasMoreMessages,
    totalMessages,
    isSystemSessionChange,
    setIsSystemSessionChange,
    canAbortSession,
    setCanAbortSession,
    isUserScrolledUp,
    setIsUserScrolledUp,
    tokenBudget,
    setTokenBudget,
    visibleMessageCount,
    visibleMessages,
    loadEarlierMessages,
    loadAllMessages,
    allMessagesLoaded,
    isLoadingAllMessages,
    loadAllJustFinished,
    showLoadAllOverlay,
    claudeStatus,
    setClaudeStatus,
    createDiff,
    scrollContainerRef,
    scrollToBottom,
    scrollToBottomAndReset,
    handleScroll,
  } = useChatSessionState({
    selectedProject,
    selectedSession,
    ws,
    sendMessage,
    autoScrollToBottom,
    externalMessageUpdate,
    processingSessions,
    resetStreamingState,
    pendingViewSessionRef,
  });

  const {
    input,
    setInput,
    textareaRef,
    inputHighlightRef,
    isTextareaExpanded,
    thinkingMode,
    setThinkingMode,
    slashCommandsCount,
    filteredCommands,
    frequentCommands,
    commandQuery,
    showCommandMenu,
    selectedCommandIndex,
    resetCommandMenuState,
    handleCommandSelect,
    handleToggleCommandMenu,
    showFileDropdown,
    filteredFiles,
    selectedFileIndex,
    renderInputWithMentions,
    selectFile,
    attachedImages,
    setAttachedImages,
    uploadingImages,
    imageErrors,
    getRootProps,
    getInputProps,
    isDragActive,
    openImagePicker,
    handleSubmit,
    handleInputChange,
    handleKeyDown,
    handlePaste,
    handleTextareaClick,
    handleTextareaInput,
    syncInputOverlayScroll,
    handleClearInput,
    handleAbortSession,
    handleTranscript,
    handlePermissionDecision,
    handleGrantToolPermission,
    handleInputFocusChange,
    isInputFocused,
  } = useChatComposerState({
    selectedProject,
    selectedSession,
    currentSessionId,
    provider,
    permissionMode,
    cyclePermissionMode,
    cursorModel,
    claudeModel,
    codexModel,
    codexReasoningEffort,
    modelReasoningControlsEnabled,
    geminiModel,
    isLoading,
    canAbortSession,
    tokenBudget,
    sendMessage,
    sendByCtrlEnter,
    onSessionActive,
    onSessionProcessing,
    onInputFocusChange,
    onFileOpen,
    onShowSettings,
    pendingViewSessionRef,
    scrollToBottom,
    setChatMessages,
    setSessionMessages,
    setIsLoading,
    setCanAbortSession,
    setClaudeStatus,
    setIsUserScrolledUp,
    setPendingPermissionRequests,
  });

  useChatRealtimeHandlers({
    latestMessage,
    provider,
    selectedProject,
    selectedSession,
    currentSessionId,
    setCurrentSessionId,
    setChatMessages,
    setIsLoading,
    setCanAbortSession,
    setClaudeStatus,
    setTokenBudget,
    setIsSystemSessionChange,
    setPendingPermissionRequests,
    pendingViewSessionRef,
    streamBufferRef,
    streamTimerRef,
    onSessionInactive,
    onSessionProcessing,
    onSessionNotProcessing,
    onReplaceTemporarySession,
    onNavigateToSession,
  });

  const getModelForProvider = useCallback(() => {
    if (provider === 'claude') {
      return claudeModel;
    }
    if (provider === 'codex') {
      return codexModel;
    }
    if (provider === 'gemini') {
      return geminiModel;
    }
    return cursorModel;
  }, [provider, claudeModel, codexModel, geminiModel, cursorModel]);

  const refreshLaunchCommand = useCallback(async () => {
    const projectName = selectedProject?.name;
    if (!projectName) {
      setLaunchCommand('');
      setIsLaunchCommandLoading(false);
      return;
    }

    const requestId = launchCommandRequestRef.current + 1;
    launchCommandRequestRef.current = requestId;
    setIsLaunchCommandLoading(true);

    const payload: Record<string, unknown> = {
      provider,
    };

    const shouldReuseRuntimeSessionId =
      Boolean(selectedSession?.id) || chatMessages.length > 0 || isLoading;
    const resolvedSessionId = isLaunchableSessionId(selectedSession?.id)
      ? selectedSession.id
      : shouldReuseRuntimeSessionId && isLaunchableSessionId(currentSessionId)
        ? currentSessionId
        : null;

    if (resolvedSessionId) {
      payload.sessionId = resolvedSessionId;
    }

    if (modelReasoningControlsEnabled) {
      const model = getModelForProvider();
      if (model) {
        payload.model = model;
      }

      if (provider === 'codex' && codexReasoningEffort?.trim()) {
        payload.reasoningEffort = codexReasoningEffort.trim();
      }
    }

    if (provider === 'codex') {
      const extraArgs = (localStorage.getItem('shell-codex-extra-args') || '').trim();
      if (extraArgs) {
        payload.extraArgs = extraArgs;
      }
    }

    try {
      const response = await api.getCliLaunchCommand(projectName, payload);
      const data = await response.json().catch(() => null);

      if (launchCommandRequestRef.current !== requestId) {
        return;
      }

      if (!response.ok || !data?.success || typeof data.command !== 'string') {
        setLaunchCommand('');
        return;
      }

      setLaunchCommand(data.command);
    } catch (error) {
      if (launchCommandRequestRef.current !== requestId) {
        return;
      }
      console.error('[ChatInterface] Failed to load CLI launch command:', error);
      setLaunchCommand('');
    } finally {
      if (launchCommandRequestRef.current === requestId) {
        setIsLaunchCommandLoading(false);
      }
    }
  }, [
    selectedProject?.name,
    provider,
    selectedSession?.id,
    currentSessionId,
    chatMessages.length,
    isLoading,
    modelReasoningControlsEnabled,
    codexReasoningEffort,
    getModelForProvider,
  ]);

  const handleCopyLaunchCommand = useCallback(async () => {
    if (!launchCommand || isLaunchCommandLoading) {
      return;
    }

    const copied = await copyTextToClipboard(launchCommand);
    if (!copied) {
      return;
    }

    setIsLaunchCommandCopied(true);
    if (copiedResetTimerRef.current) {
      window.clearTimeout(copiedResetTimerRef.current);
    }
    copiedResetTimerRef.current = window.setTimeout(() => {
      setIsLaunchCommandCopied(false);
      copiedResetTimerRef.current = null;
    }, 1800);
  }, [isLaunchCommandLoading, launchCommand]);

  useEffect(() => {
    refreshLaunchCommand();
  }, [refreshLaunchCommand]);

  useEffect(() => {
    setIsLaunchCommandCopied(false);
  }, [launchCommand]);

  useEffect(() => {
    if (!isLoading || !canAbortSession) {
      return;
    }

    const handleGlobalEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      handleAbortSession();
    };

    document.addEventListener('keydown', handleGlobalEscape, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleGlobalEscape, { capture: true });
    };
  }, [canAbortSession, handleAbortSession, isLoading]);

  useEffect(() => {
    return () => {
      resetStreamingState();
      if (copiedResetTimerRef.current) {
        clearTimeout(copiedResetTimerRef.current);
      }
    };
  }, [resetStreamingState]);

  if (!selectedProject) {
    const selectedProviderLabel =
      provider === 'cursor'
        ? t('messageTypes.cursor')
        : provider === 'codex'
          ? t('messageTypes.codex')
          : provider === 'gemini'
            ? t('messageTypes.gemini')
            : t('messageTypes.claude');

    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">
            {t('projectSelection.startChatWithProvider', {
              provider: selectedProviderLabel,
              defaultValue: 'Select a project to start chatting with {{provider}}',
            })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        <ChatMessagesPane
          scrollContainerRef={scrollContainerRef}
          onWheel={handleScroll}
          onTouchMove={handleScroll}
          isLoadingSessionMessages={isLoadingSessionMessages}
          chatMessages={chatMessages}
          selectedSession={selectedSession}
          currentSessionId={currentSessionId}
          provider={provider}
          setProvider={(nextProvider) => setProvider(nextProvider as Provider)}
          textareaRef={textareaRef}
          claudeModel={claudeModel}
          setClaudeModel={setClaudeModel}
          cursorModel={cursorModel}
          setCursorModel={setCursorModel}
          codexModel={codexModel}
          setCodexModel={setCodexModel}
          codexModelOptions={codexModelOptions}
          codexReasoningEffort={codexReasoningEffort}
          setCodexReasoningEffort={setCodexReasoningEffort}
          modelReasoningControlsEnabled={modelReasoningControlsEnabled}
          setModelReasoningControlsEnabled={setModelReasoningControlsEnabled}
          geminiModel={geminiModel}
          setGeminiModel={setGeminiModel}
          tasksEnabled={tasksEnabled}
          isTaskMasterInstalled={isTaskMasterInstalled}
          onShowAllTasks={onShowAllTasks}
          setInput={setInput}
          isLoadingMoreMessages={isLoadingMoreMessages}
          hasMoreMessages={hasMoreMessages}
          totalMessages={totalMessages}
          sessionMessagesCount={sessionMessages.length}
          visibleMessageCount={visibleMessageCount}
          visibleMessages={visibleMessages}
          loadEarlierMessages={loadEarlierMessages}
          loadAllMessages={loadAllMessages}
          allMessagesLoaded={allMessagesLoaded}
          isLoadingAllMessages={isLoadingAllMessages}
          loadAllJustFinished={loadAllJustFinished}
          showLoadAllOverlay={showLoadAllOverlay}
          createDiff={createDiff}
          onFileOpen={onFileOpen}
          onShowSettings={onShowSettings}
          onGrantToolPermission={handleGrantToolPermission}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
          showThinking={showThinking}
          showInjectedContext={showInjectedContext}
          selectedProject={selectedProject}
          isLoading={isLoading}
        />

        <ChatComposer
          pendingPermissionRequests={pendingPermissionRequests}
          handlePermissionDecision={handlePermissionDecision}
          handleGrantToolPermission={handleGrantToolPermission}
          claudeStatus={claudeStatus}
          isLoading={isLoading}
          onAbortSession={handleAbortSession}
          provider={provider}
          claudeModel={claudeModel}
          setClaudeModel={setClaudeModel}
          cursorModel={cursorModel}
          setCursorModel={setCursorModel}
          codexModel={codexModel}
          setCodexModel={setCodexModel}
          codexReasoningEffort={codexReasoningEffort}
          setCodexReasoningEffort={setCodexReasoningEffort}
          modelReasoningControlsEnabled={modelReasoningControlsEnabled}
          setModelReasoningControlsEnabled={setModelReasoningControlsEnabled}
          geminiModel={geminiModel}
          setGeminiModel={setGeminiModel}
          permissionMode={permissionMode}
          onModeSwitch={cyclePermissionMode}
          thinkingMode={thinkingMode}
          setThinkingMode={setThinkingMode}
          tokenBudget={tokenBudget}
          slashCommandsCount={slashCommandsCount}
          onToggleCommandMenu={handleToggleCommandMenu}
          hasInput={Boolean(input.trim())}
          onClearInput={handleClearInput}
          isUserScrolledUp={isUserScrolledUp}
          hasMessages={chatMessages.length > 0}
          onScrollToBottom={scrollToBottomAndReset}
          launchCommand={launchCommand}
          isLaunchCommandLoading={isLaunchCommandLoading}
          isLaunchCommandCopied={isLaunchCommandCopied}
          onRefreshLaunchCommand={refreshLaunchCommand}
          onCopyLaunchCommand={handleCopyLaunchCommand}
          onSubmit={handleSubmit}
          isDragActive={isDragActive}
          attachedImages={attachedImages}
          onRemoveImage={(index) =>
            setAttachedImages((previous) =>
              previous.filter((_, currentIndex) => currentIndex !== index),
            )
          }
          uploadingImages={uploadingImages}
          imageErrors={imageErrors}
          showFileDropdown={showFileDropdown}
          filteredFiles={filteredFiles}
          selectedFileIndex={selectedFileIndex}
          onSelectFile={selectFile}
          filteredCommands={filteredCommands}
          selectedCommandIndex={selectedCommandIndex}
          onCommandSelect={handleCommandSelect}
          onCloseCommandMenu={resetCommandMenuState}
          isCommandMenuOpen={showCommandMenu}
          frequentCommands={commandQuery ? [] : frequentCommands}
          getRootProps={getRootProps as (...args: unknown[]) => Record<string, unknown>}
          getInputProps={getInputProps as (...args: unknown[]) => Record<string, unknown>}
          openImagePicker={openImagePicker}
          inputHighlightRef={inputHighlightRef}
          renderInputWithMentions={renderInputWithMentions}
          textareaRef={textareaRef}
          input={input}
          onInputChange={handleInputChange}
          onTextareaClick={handleTextareaClick}
          onTextareaKeyDown={handleKeyDown}
          onTextareaPaste={handlePaste}
          onTextareaScrollSync={syncInputOverlayScroll}
          onTextareaInput={handleTextareaInput}
          onInputFocusChange={handleInputFocusChange}
          isInputFocused={isInputFocused}
          placeholder={t('input.placeholder', {
            provider:
              provider === 'cursor'
                ? t('messageTypes.cursor')
                : provider === 'codex'
                  ? t('messageTypes.codex')
                  : provider === 'gemini'
                    ? t('messageTypes.gemini')
                    : t('messageTypes.claude'),
          })}
          isTextareaExpanded={isTextareaExpanded}
          sendByCtrlEnter={sendByCtrlEnter}
          onTranscript={handleTranscript}
        />
      </div>

      <QuickSettingsPanel />
    </>
  );
}

export default React.memo(ChatInterface);
