import React from 'react';
import { useTranslation } from 'react-i18next';
import ThinkingModeSelector from './ThinkingModeSelector';
import TokenUsagePie from './TokenUsagePie';
import type { PermissionMode, Provider, TokenBudget } from '../../types/types';

interface ChatInputControlsProps {
  permissionMode: PermissionMode | string;
  onModeSwitch: () => void;
  provider: Provider | string;
  modelReasoningControlsEnabled: boolean;
  onModelReasoningControlsEnabledChange: (enabled: boolean) => void;
  currentModel: string;
  modelOptions: Array<{ value: string; label: string }>;
  onModelChange: (model: string) => void;
  currentReasoningEffort?: string;
  reasoningOptions?: Array<{ value: string; label: string }>;
  onReasoningChange?: (effort: string) => void;
  thinkingMode: string;
  setThinkingMode: React.Dispatch<React.SetStateAction<string>>;
  tokenBudget: TokenBudget | null;
  slashCommandsCount: number;
  onToggleCommandMenu: () => void;
  hasInput: boolean;
  onClearInput: () => void;
  isUserScrolledUp: boolean;
  hasMessages: boolean;
  onScrollToBottom: () => void;
  launchCommand: string;
  isLaunchCommandLoading: boolean;
  isLaunchCommandCopied: boolean;
  onRefreshLaunchCommand: () => void;
  onCopyLaunchCommand: () => void;
}

export default function ChatInputControls({
  permissionMode,
  onModeSwitch,
  provider,
  modelReasoningControlsEnabled,
  onModelReasoningControlsEnabledChange,
  currentModel,
  modelOptions,
  onModelChange,
  currentReasoningEffort,
  reasoningOptions = [],
  onReasoningChange,
  thinkingMode,
  setThinkingMode,
  tokenBudget,
  slashCommandsCount,
  onToggleCommandMenu,
  hasInput,
  onClearInput,
  isUserScrolledUp,
  hasMessages,
  onScrollToBottom,
  launchCommand,
  isLaunchCommandLoading,
  isLaunchCommandCopied,
  onRefreshLaunchCommand,
  onCopyLaunchCommand,
}: ChatInputControlsProps) {
  const { t } = useTranslation('chat');

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={onModeSwitch}
        className={`rounded-lg border px-2.5 py-1 text-sm font-medium transition-all duration-200 sm:px-3 sm:py-1.5 ${
          permissionMode === 'default'
            ? 'border-border/60 bg-muted/50 text-muted-foreground hover:bg-muted'
            : permissionMode === 'acceptEdits'
              ? 'border-green-300/60 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-600/40 dark:bg-green-900/15 dark:text-green-300 dark:hover:bg-green-900/25'
              : permissionMode === 'bypassPermissions'
                ? 'border-orange-300/60 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-600/40 dark:bg-orange-900/15 dark:text-orange-300 dark:hover:bg-orange-900/25'
                : 'border-primary/20 bg-primary/5 text-primary hover:bg-primary/10'
        }`}
        title={t('input.clickToChangeMode')}
      >
        <div className="flex items-center gap-1.5">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              permissionMode === 'default'
                ? 'bg-muted-foreground'
                : permissionMode === 'acceptEdits'
                  ? 'bg-green-500'
                  : permissionMode === 'bypassPermissions'
                    ? 'bg-orange-500'
                    : 'bg-primary'
            }`}
          />
          <span>
            {permissionMode === 'default' && t('codex.modes.default')}
            {permissionMode === 'acceptEdits' && t('codex.modes.acceptEdits')}
            {permissionMode === 'bypassPermissions' && t('codex.modes.bypassPermissions')}
            {permissionMode === 'plan' && t('codex.modes.plan')}
          </span>
        </div>
      </button>

      <label className="flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-border/60 bg-muted/40 cursor-pointer">
        <input
          type="checkbox"
          checked={modelReasoningControlsEnabled}
          onChange={(event) => onModelReasoningControlsEnabledChange(event.target.checked)}
          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/30"
        />
        <span className="text-xs font-medium text-muted-foreground">
          {t('input.enableModelReasoningControls', { defaultValue: 'Enable model/reasoning controls' })}
        </span>
      </label>

      {modelReasoningControlsEnabled && (
        <div className="flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-border/60 bg-muted/40">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('input.model', { defaultValue: 'Model' })}
          </span>
          <select
            value={currentModel}
            onChange={(event) => onModelChange(event.target.value)}
            className="bg-transparent text-sm font-medium text-foreground focus:outline-none min-w-[7rem]"
            title={t('input.changeModel', { defaultValue: 'Change model for next turn' })}
          >
            {modelOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {modelReasoningControlsEnabled && provider === 'codex' && currentReasoningEffort && onReasoningChange && reasoningOptions.length > 0 && (
        <div className="flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-border/60 bg-muted/40">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('providerSelection.selectReasoning', { defaultValue: 'Reasoning' })}
          </span>
          <select
            value={currentReasoningEffort}
            onChange={(event) => onReasoningChange(event.target.value)}
            className="bg-transparent text-sm font-medium text-foreground focus:outline-none min-w-[7rem]"
            title={t('providerSelection.selectReasoning', { defaultValue: 'Reasoning level' })}
          >
            {reasoningOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {provider === 'claude' && (
        <ThinkingModeSelector selectedMode={thinkingMode} onModeChange={setThinkingMode} onClose={() => {}} className="" />
      )}

      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border/60 bg-muted/40 max-w-full">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('input.launchCommand', { defaultValue: 'CLI' })}
        </span>
        <code
          className="text-[11px] font-mono text-foreground/85 truncate max-w-[12rem] sm:max-w-[22rem]"
          title={launchCommand || t('input.launchCommandUnavailable', { defaultValue: 'Unavailable' })}
        >
          {isLaunchCommandLoading
            ? t('input.generatingLaunchCommand', { defaultValue: 'Generating...' })
            : launchCommand || t('input.launchCommandUnavailable', { defaultValue: 'Unavailable' })}
        </code>
        <button
          type="button"
          onClick={onRefreshLaunchCommand}
          disabled={isLaunchCommandLoading}
          className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={t('input.refreshLaunchCommand', { defaultValue: 'Refresh command' })}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5 14a7 7 0 0012 2m2-6A7 7 0 007 8" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onCopyLaunchCommand}
          disabled={!launchCommand || isLaunchCommandLoading}
          className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={isLaunchCommandCopied
            ? t('input.launchCommandCopied', { defaultValue: 'Copied' })
            : t('input.copyLaunchCommand', { defaultValue: 'Copy command' })}
        >
          {isLaunchCommandCopied ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
            </svg>
          )}
        </button>
      </div>

      <TokenUsagePie
        used={typeof tokenBudget?.used === 'number' ? tokenBudget.used : null}
        total={typeof tokenBudget?.total === 'number' ? tokenBudget.total : null}
      />

      <button
        type="button"
        onClick={onToggleCommandMenu}
        className="relative flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground sm:h-8 sm:w-8"
        title={t('input.showAllCommands')}
      >
        <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        {slashCommandsCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground sm:h-5 sm:w-5"
          >
            {slashCommandsCount}
          </span>
        )}
      </button>

      {hasInput && (
        <button
          type="button"
          onClick={onClearInput}
          className="group flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-card shadow-sm transition-all duration-200 hover:bg-accent/60 sm:h-8 sm:w-8"
          title={t('input.clearInput', { defaultValue: 'Clear input' })}
        >
          <svg
            className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground sm:h-4 sm:w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {isUserScrolledUp && hasMessages && (
        <button
          onClick={onScrollToBottom}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-all duration-200 hover:scale-105 hover:bg-primary/90 sm:h-8 sm:w-8"
          title={t('input.scrollToBottom', { defaultValue: 'Scroll to bottom' })}
        >
          <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}
