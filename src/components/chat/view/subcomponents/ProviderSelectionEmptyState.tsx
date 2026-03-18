import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SessionProviderLogo from '../../../llm-logo-provider/SessionProviderLogo';
import { NextTaskBanner } from '../../../task-master';
import {
  CLAUDE_MODELS,
  CURSOR_MODELS,
  CODEX_MODELS,
  CODEX_REASONING_LEVELS,
  GEMINI_MODELS,
} from '../../../../../shared/modelConstants';
import type { ProjectSession, SessionProvider } from '../../../../types/app';

type ProviderSelectionEmptyStateProps = {
  selectedSession: ProjectSession | null;
  currentSessionId: string | null;
  provider: SessionProvider;
  setProvider: (next: SessionProvider) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  claudeModel: string;
  setClaudeModel: (model: string) => void;
  cursorModel: string;
  setCursorModel: (model: string) => void;
  codexModel: string;
  setCodexModel: (model: string) => void;
  codexModelOptions: Array<{ value: string; label: string }>;
  codexReasoningEffort: string;
  setCodexReasoningEffort: (effort: string) => void;
  modelReasoningControlsEnabled: boolean;
  setModelReasoningControlsEnabled: (enabled: boolean) => void;
  geminiModel: string;
  setGeminiModel: (model: string) => void;
  tasksEnabled: boolean;
  isTaskMasterInstalled: boolean | null;
  onShowAllTasks?: (() => void) | null;
  setInput: React.Dispatch<React.SetStateAction<string>>;
};

type ProviderDef = {
  id: SessionProvider;
  name: string;
  infoKey: string;
  accent: string;
  ring: string;
  check: string;
};

const PROVIDERS: ProviderDef[] = [
  {
    id: "claude",
    name: "Claude Code",
    infoKey: "providerSelection.providerInfo.anthropic",
    accent: "border-primary",
    ring: "ring-primary/15",
    check: "bg-primary text-primary-foreground",
  },
  {
    id: "cursor",
    name: "Cursor",
    infoKey: "providerSelection.providerInfo.cursorEditor",
    accent: "border-violet-500 dark:border-violet-400",
    ring: "ring-violet-500/15",
    check: "bg-violet-500 text-white",
  },
  {
    id: "codex",
    name: "Codex",
    infoKey: "providerSelection.providerInfo.openai",
    accent: "border-emerald-600 dark:border-emerald-400",
    ring: "ring-emerald-600/15",
    check: "bg-emerald-600 dark:bg-emerald-500 text-white",
  },
  {
    id: "gemini",
    name: "Gemini",
    infoKey: "providerSelection.providerInfo.google",
    accent: "border-blue-500 dark:border-blue-400",
    ring: "ring-blue-500/15",
    check: "bg-blue-500 text-white",
  },
];

function getModelConfig(p: SessionProvider) {
  if (p === "claude") return CLAUDE_MODELS;
  if (p === "codex") return CODEX_MODELS;
  if (p === "gemini") return GEMINI_MODELS;
  return CURSOR_MODELS;
}

function getModelValue(
  p: SessionProvider,
  c: string,
  cu: string,
  co: string,
  g: string,
) {
  if (p === "claude") return c;
  if (p === "codex") return co;
  if (p === "gemini") return g;
  return cu;
}

export default function ProviderSelectionEmptyState({
  selectedSession,
  currentSessionId,
  provider,
  setProvider,
  textareaRef,
  claudeModel,
  setClaudeModel,
  cursorModel,
  setCursorModel,
  codexModel,
  setCodexModel,
  codexModelOptions,
  codexReasoningEffort,
  setCodexReasoningEffort,
  modelReasoningControlsEnabled,
  setModelReasoningControlsEnabled,
  geminiModel,
  setGeminiModel,
  tasksEnabled,
  isTaskMasterInstalled,
  onShowAllTasks,
  setInput,
}: ProviderSelectionEmptyStateProps) {
  const { t } = useTranslation("chat");
  const nextTaskPrompt = t("tasks.nextTaskPrompt", {
    defaultValue: "Start the next task",
  });

  const selectProvider = (next: SessionProvider) => {
    setProvider(next);
    localStorage.setItem("selected-provider", next);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleModelChange = (value: string) => {
    if (provider === "claude") {
      setClaudeModel(value);
      localStorage.setItem("claude-model", value);
    } else if (provider === "codex") {
      setCodexModel(value);
      localStorage.setItem("codex-model", value);
    } else if (provider === "gemini") {
      setGeminiModel(value);
      localStorage.setItem("gemini-model", value);
    } else {
      setCursorModel(value);
      localStorage.setItem("cursor-model", value);
    }
  };

  const modelConfig = getModelConfig(provider);
  const currentModel = getModelValue(provider, claudeModel, cursorModel, codexModel, geminiModel);
  const resolvedModelOptions = provider === 'codex' ? codexModelOptions : modelConfig.OPTIONS;
  const codexReasoningOptions =
    codexReasoningEffort &&
    !CODEX_REASONING_LEVELS.OPTIONS.some(({ value }) => value === codexReasoningEffort)
      ? [{ value: codexReasoningEffort, label: codexReasoningEffort }, ...CODEX_REASONING_LEVELS.OPTIONS]
      : CODEX_REASONING_LEVELS.OPTIONS;

  /* ── New session — provider picker ── */
  if (!selectedSession && !currentSessionId) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-8 text-center">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {t("providerSelection.title")}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {t("providerSelection.description")}
            </p>
          </div>

          {/* Provider cards — horizontal row, equal width */}
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
            {PROVIDERS.map((p) => {
              const active = provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => selectProvider(p.id)}
                  className={`
                    relative flex flex-col items-center gap-2.5 rounded-xl border-[1.5px] px-2
                    pb-4 pt-5 transition-all duration-150
                    active:scale-[0.97]
                    ${
                      active
                        ? `${p.accent} ${p.ring} bg-card shadow-sm ring-2`
                        : "border-border bg-card/60 hover:border-border/80 hover:bg-card"
                    }
                  `}
                >
                  <SessionProviderLogo
                    provider={p.id}
                    className={`h-9 w-9 transition-transform duration-150 ${active ? "scale-110" : ""}`}
                  />
                  <div className="text-center">
                    <p className="text-[13px] font-semibold leading-none text-foreground">
                      {p.name}
                    </p>
                    <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
                      {t(p.infoKey)}
                    </p>
                  </div>
                  {/* Check badge */}
                  {active && (
                    <div
                      className={`absolute -right-1 -top-1 h-[18px] w-[18px] rounded-full ${p.check} flex items-center justify-center shadow-sm`}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Model picker — appears after provider is chosen */}
          <div className={`transition-all duration-200 ${provider ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}`}>
            <label className="flex items-center justify-center gap-2 mb-5 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={modelReasoningControlsEnabled}
                onChange={(event) => setModelReasoningControlsEnabled(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/30"
              />
              <span>{t('input.enableModelReasoningControls', { defaultValue: 'Enable model/reasoning controls' })}</span>
            </label>

            {modelReasoningControlsEnabled && (
              <div className="flex items-center justify-center gap-2 mb-5">
                <span className="text-sm text-muted-foreground">{t('providerSelection.selectModel')}</span>
                <div className="relative">
                  <select
                    value={currentModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    tabIndex={-1}
                    className="appearance-none pl-3 pr-7 py-1.5 text-sm font-medium bg-muted/50 border border-border/60 rounded-lg text-foreground cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {resolvedModelOptions.map(({ value, label }: { value: string; label: string }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}

            {modelReasoningControlsEnabled && provider === 'codex' && (
              <div className="flex items-center justify-center gap-2 mb-5">
                <span className="text-sm text-muted-foreground">
                  {t('providerSelection.selectReasoning', { defaultValue: 'Reasoning level' })}
                </span>
                <div className="relative">
                  <select
                    value={codexReasoningEffort}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setCodexReasoningEffort(nextValue);
                      localStorage.setItem('codex-reasoning-effort', nextValue);
                    }}
                    tabIndex={-1}
                    className="appearance-none pl-3 pr-7 py-1.5 text-sm font-medium bg-muted/50 border border-border/60 rounded-lg text-foreground cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {codexReasoningOptions.map(({ value, label }: { value: string; label: string }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground/70">
              {
                {
                  claude: t("providerSelection.readyPrompt.claude", {
                    model: claudeModel,
                  }),
                  cursor: t("providerSelection.readyPrompt.cursor", {
                    model: cursorModel,
                  }),
                  codex: t("providerSelection.readyPrompt.codex", {
                    model: codexModel,
                  }),
                  gemini: t("providerSelection.readyPrompt.gemini", {
                    model: geminiModel,
                  }),
                }[provider]
              }
            </p>
          </div>

          {/* Task banner */}
          {provider && tasksEnabled && isTaskMasterInstalled && (
            <div className="mt-5">
              <NextTaskBanner
                onStartTask={() => setInput(nextTaskPrompt)}
                onShowAllTasks={onShowAllTasks}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Existing session — continue prompt ── */
  if (selectedSession) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md px-6 text-center">
          <p className="mb-1.5 text-lg font-semibold text-foreground">
            {t("session.continue.title")}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("session.continue.description")}
          </p>

          {tasksEnabled && isTaskMasterInstalled && (
            <div className="mt-5">
              <NextTaskBanner
                onStartTask={() => setInput(nextTaskPrompt)}
                onShowAllTasks={onShowAllTasks}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
