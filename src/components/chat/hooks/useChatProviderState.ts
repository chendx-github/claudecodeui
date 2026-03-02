import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../../../utils/api';
import {
  CLAUDE_MODELS,
  CODEX_MODELS,
  CODEX_REASONING_LEVELS,
  CURSOR_MODELS,
  GEMINI_MODELS,
} from '../../../../shared/modelConstants';
import type { PendingPermissionRequest, PermissionMode, Provider } from '../types/types';
import type { ProjectSession, SessionProvider } from '../../../types/app';

interface UseChatProviderStateArgs {
  selectedSession: ProjectSession | null;
}

type ModelOption = {
  value: string;
  label: string;
};

function buildCodexModelOption(model: string): ModelOption {
  const trimmedModel = model.trim();
  const defaultOption = CODEX_MODELS.OPTIONS.find((option) => option.value === trimmedModel);
  return {
    value: trimmedModel,
    label: defaultOption?.label || trimmedModel,
  };
}

export function useChatProviderState({ selectedSession }: UseChatProviderStateArgs) {
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('default');
  const [pendingPermissionRequests, setPendingPermissionRequests] = useState<PendingPermissionRequest[]>([]);
  const [provider, setProvider] = useState<SessionProvider>(() => {
    return (localStorage.getItem('selected-provider') as SessionProvider) || 'claude';
  });
  const [cursorModel, setCursorModel] = useState<string>(() => {
    return localStorage.getItem('cursor-model') || CURSOR_MODELS.DEFAULT;
  });
  const [claudeModel, setClaudeModel] = useState<string>(() => {
    return localStorage.getItem('claude-model') || CLAUDE_MODELS.DEFAULT;
  });
  const [codexModelValue, setCodexModelValue] = useState<string>(() => {
    return localStorage.getItem('codex-model') || CODEX_MODELS.DEFAULT;
  });
  const [codexModelOptions, setCodexModelOptions] = useState<ModelOption[]>(() => {
    const localModel = localStorage.getItem('codex-model');
    if (!localModel?.trim()) {
      return CODEX_MODELS.OPTIONS;
    }

    if (CODEX_MODELS.OPTIONS.some((option) => option.value === localModel.trim())) {
      return CODEX_MODELS.OPTIONS;
    }

    return [...CODEX_MODELS.OPTIONS, buildCodexModelOption(localModel)];
  });
  const [codexReasoningEffort, setCodexReasoningEffort] = useState<string>(() => {
    return localStorage.getItem('codex-reasoning-effort') || CODEX_REASONING_LEVELS.DEFAULT;
  });
  const [geminiModel, setGeminiModel] = useState<string>(() => {
    return localStorage.getItem('gemini-model') || GEMINI_MODELS.DEFAULT;
  });
  const [modelReasoningControlsEnabled, setModelReasoningControlsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('model-reasoning-controls-enabled') === 'true';
  });

  const lastProviderRef = useRef(provider);

  const ensureCodexModelOption = useCallback((model: string) => {
    const trimmedModel = model.trim();
    if (!trimmedModel) {
      return;
    }

    setCodexModelOptions((previousOptions) => {
      if (previousOptions.some((option) => option.value === trimmedModel)) {
        return previousOptions;
      }
      return [...previousOptions, buildCodexModelOption(trimmedModel)];
    });
  }, []);

  const setCodexModel = useCallback(
    (model: string) => {
      setCodexModelValue(model);
      ensureCodexModelOption(model);
    },
    [ensureCodexModelOption],
  );

  const codexModel = codexModelValue;

  useEffect(() => {
    if (!selectedSession?.id) {
      return;
    }

    const savedMode = localStorage.getItem(`permissionMode-${selectedSession.id}`);
    setPermissionMode((savedMode as PermissionMode) || 'default');
  }, [selectedSession?.id]);

  useEffect(() => {
    if (!selectedSession?.__provider || selectedSession.__provider === provider) {
      return;
    }

    setProvider(selectedSession.__provider);
    localStorage.setItem('selected-provider', selectedSession.__provider);
  }, [provider, selectedSession]);

  useEffect(() => {
    if (lastProviderRef.current === provider) {
      return;
    }
    setPendingPermissionRequests([]);
    lastProviderRef.current = provider;
  }, [provider]);

  useEffect(() => {
    setPendingPermissionRequests((previous) =>
      previous.filter((request) => !request.sessionId || request.sessionId === selectedSession?.id),
    );
  }, [selectedSession?.id]);

  useEffect(() => {
    if (provider !== 'cursor') {
      return;
    }

    authenticatedFetch('/api/cursor/config')
      .then((response) => response.json())
      .then((data) => {
        if (!data.success || !data.config?.model?.modelId) {
          return;
        }

        const modelId = data.config.model.modelId as string;
        if (!localStorage.getItem('cursor-model')) {
          setCursorModel(modelId);
        }
      })
      .catch((error) => {
        console.error('Error loading Cursor config:', error);
      });
  }, [provider]);

  useEffect(() => {
    ensureCodexModelOption(codexModel);
  }, [codexModel, ensureCodexModelOption]);

  useEffect(() => {
    if (provider !== 'codex') {
      return;
    }

    let cancelled = false;
    const localModel = localStorage.getItem('codex-model') || '';
    ensureCodexModelOption(localModel);

    authenticatedFetch('/api/codex/config')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data.success) {
          return;
        }

        const configModel = typeof data.config?.model === 'string' ? data.config.model : '';
        ensureCodexModelOption(configModel);

        if (!localModel.trim() && configModel.trim()) {
          setCodexModelValue(configModel.trim());
          localStorage.setItem('codex-model', configModel.trim());
        }
      })
      .catch((error) => {
        console.error('Error loading Codex config:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [provider, ensureCodexModelOption]);

  useEffect(() => {
    if (codexReasoningEffort?.trim()) {
      localStorage.setItem('codex-reasoning-effort', codexReasoningEffort.trim());
    } else {
      localStorage.removeItem('codex-reasoning-effort');
    }
  }, [codexReasoningEffort]);

  useEffect(() => {
    localStorage.setItem(
      'model-reasoning-controls-enabled',
      modelReasoningControlsEnabled ? 'true' : 'false',
    );
  }, [modelReasoningControlsEnabled]);

  const cyclePermissionMode = useCallback(() => {
    const modes: PermissionMode[] =
      provider === 'codex'
        ? ['default', 'acceptEdits', 'bypassPermissions']
        : ['default', 'acceptEdits', 'bypassPermissions', 'plan'];

    const currentIndex = modes.indexOf(permissionMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    setPermissionMode(nextMode);

    if (selectedSession?.id) {
      localStorage.setItem(`permissionMode-${selectedSession.id}`, nextMode);
    }
  }, [permissionMode, provider, selectedSession?.id]);

  return {
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
    setPermissionMode,
    pendingPermissionRequests,
    setPendingPermissionRequests,
    cyclePermissionMode,
  };
}
