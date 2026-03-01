/**
 * OpenAI Codex CLI Integration
 * ============================
 *
 * This module streams Codex events by spawning the local `codex` CLI with
 * `exec --experimental-json`, so it stays aligned with the user's working CLI
 * authentication and configuration.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import TOML from '@iarna/toml';

// Track active sessions
const activeCodexSessions = new Map();
const CODEX_CONFIG_CACHE_TTL_MS = 5000;
let cachedCodexConfig = null;
let cachedCodexConfigReadAt = 0;

function buildCodexProcessEnv() {
  const env = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  // Ensure native CLI identity unless the user explicitly sets another value.
  if (env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE === 'codex_sdk_ts') {
    delete env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE;
  }

  return env;
}

function normalizeComparablePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return '';
  }

  const withoutLongPathPrefix = inputPath.startsWith('\\\\?\\')
    ? inputPath.slice(4)
    : inputPath;
  const normalized = path.normalize(withoutLongPathPrefix.trim());

  if (!normalized) {
    return '';
  }

  const resolved = path.resolve(normalized);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

async function readCodexConfig() {
  const now = Date.now();
  if ((now - cachedCodexConfigReadAt) < CODEX_CONFIG_CACHE_TTL_MS) {
    return cachedCodexConfig;
  }

  const configPath = path.join(os.homedir(), '.codex', 'config.toml');
  try {
    const content = await fs.readFile(configPath, 'utf8');
    cachedCodexConfig = TOML.parse(content);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[Codex] Failed to parse ~/.codex/config.toml:', error.message);
    }
    cachedCodexConfig = null;
  }

  cachedCodexConfigReadAt = now;
  return cachedCodexConfig;
}

function getTrustLevelFromConfig(config, workingDirectory) {
  const projectsConfig = config?.projects;
  if (!projectsConfig || typeof projectsConfig !== 'object') {
    return null;
  }

  const normalizedWorkingDirectory = normalizeComparablePath(workingDirectory);
  if (!normalizedWorkingDirectory) {
    return null;
  }

  let matchedTrustLevel = null;
  let matchedPathLength = -1;

  for (const [projectPath, projectConfig] of Object.entries(projectsConfig)) {
    const normalizedProjectPath = normalizeComparablePath(projectPath);
    if (!normalizedProjectPath) {
      continue;
    }

    const isExactMatch = normalizedWorkingDirectory === normalizedProjectPath;
    const isChildMatch = normalizedWorkingDirectory.startsWith(`${normalizedProjectPath}${path.sep}`);
    if (!isExactMatch && !isChildMatch) {
      continue;
    }

    if (normalizedProjectPath.length > matchedPathLength) {
      matchedPathLength = normalizedProjectPath.length;
      matchedTrustLevel = typeof projectConfig?.trust_level === 'string'
        ? projectConfig.trust_level
        : null;
    }
  }

  return matchedTrustLevel;
}

async function resolveEffectivePermissionMode(permissionMode, workingDirectory) {
  if (permissionMode !== 'default') {
    return permissionMode;
  }

  const config = await readCodexConfig();
  if (!config) {
    return permissionMode;
  }

  const approvalMode = typeof config.approval_mode === 'string'
    ? config.approval_mode.trim().toLowerCase()
    : '';
  const sandboxMode = typeof config.sandbox_mode === 'string'
    ? config.sandbox_mode.trim().toLowerCase()
    : '';
  const isDangerFullAccessSandbox =
    sandboxMode === 'danger-full-access' || sandboxMode === 'danger_full_access';

  if (approvalMode === 'never') {
    // Respect explicit yolo settings from ~/.codex/config.toml.
    return isDangerFullAccessSandbox ? 'bypassPermissions' : 'acceptEdits';
  }

  const trustLevel = getTrustLevelFromConfig(config, workingDirectory);
  if (trustLevel === 'trusted') {
    return 'acceptEdits';
  }

  return permissionMode;
}

/**
 * Transform Codex SDK event to WebSocket message format
 * @param {object} event - SDK event
 * @returns {object} - Transformed event for WebSocket
 */
function transformCodexEvent(event) {
  // Map SDK event types to a consistent format
  switch (event.type) {
    case 'item.started':
    case 'item.updated':
    case 'item.completed':
      const item = event.item;
      if (!item) {
        return { type: event.type, item: null };
      }

      // Transform based on item type
      switch (item.type) {
        case 'agent_message':
          return {
            type: 'item',
            itemType: 'agent_message',
            message: {
              role: 'assistant',
              content: item.text
            }
          };

        case 'reasoning':
          return {
            type: 'item',
            itemType: 'reasoning',
            message: {
              role: 'assistant',
              content: item.text,
              isReasoning: true
            }
          };

        case 'command_execution':
          return {
            type: 'item',
            itemType: 'command_execution',
            itemId: item.id || item.call_id || null,
            command: item.command,
            output: item.aggregated_output,
            exitCode: item.exit_code,
            status: item.status
          };

        case 'file_change':
          return {
            type: 'item',
            itemType: 'file_change',
            changes: item.changes,
            status: item.status
          };

        case 'mcp_tool_call':
          return {
            type: 'item',
            itemType: 'mcp_tool_call',
            server: item.server,
            tool: item.tool,
            arguments: item.arguments,
            result: item.result,
            error: item.error,
            status: item.status
          };

        case 'web_search':
          return {
            type: 'item',
            itemType: 'web_search',
            query: item.query
          };

        case 'todo_list':
          return {
            type: 'item',
            itemType: 'todo_list',
            items: item.items
          };

        case 'error':
          return {
            type: 'item',
            itemType: 'error',
            message: {
              role: 'error',
              content: item.message
            }
          };

        default:
          return {
            type: 'item',
            itemType: item.type,
            item: item
          };
      }

    case 'turn.started':
      return {
        type: 'turn_started'
      };

    case 'turn.completed':
      return {
        type: 'turn_complete',
        usage: event.usage
      };

    case 'turn.failed':
      return {
        type: 'turn_failed',
        error: event.error
      };

    case 'thread.started':
      return {
        type: 'thread_started',
        threadId: event.thread_id || event.id || null
      };

    case 'error':
      return {
        type: 'error',
        message: event.message
      };

    default:
      return {
        type: event.type,
        data: event
      };
  }
}

/**
 * Map permission mode to Codex CLI options
 * @param {string} permissionMode - 'default', 'acceptEdits', or 'bypassPermissions'
 * @returns {object} - { sandboxMode, approvalPolicy }
 */
function mapPermissionModeToCodexOptions(permissionMode) {
  switch (permissionMode) {
    case 'acceptEdits':
      return {
        sandboxMode: 'workspace-write',
        approvalPolicy: 'never'
      };
    case 'bypassPermissions':
      return {
        sandboxMode: 'danger-full-access',
        approvalPolicy: 'never'
      };
    case 'default':
    default:
      return {
        // Do not force sandbox/approval in default mode.
        // Let the local Codex CLI and ~/.codex/config.toml decide.
        sandboxMode: null,
        approvalPolicy: null
      };
  }
}

function getImageFileExtension(image, mimeType) {
  const mimeExtensionMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };

  if (typeof image?.name === 'string') {
    const ext = path.extname(image.name).toLowerCase().replace('.', '');
    if (ext) {
      return ext;
    }
  }

  const normalizedMimeType = typeof mimeType === 'string'
    ? mimeType.trim().toLowerCase()
    : '';
  return mimeExtensionMap[normalizedMimeType] || 'png';
}

async function materializeCodexImages(images) {
  const imagePaths = [];
  let tempDir = null;

  if (!Array.isArray(images) || images.length === 0) {
    return { imagePaths, tempDir };
  }

  tempDir = path.join(
    os.tmpdir(),
    'claudecodeui-codex-images',
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await fs.mkdir(tempDir, { recursive: true });

  for (const [index, image] of images.entries()) {
    if (!image || typeof image !== 'object' || typeof image.data !== 'string') {
      continue;
    }

    const match = image.data.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      console.warn('[Codex] Skipping invalid image payload at index:', index);
      continue;
    }

    const [, mimeType, base64Data] = match;
    const extension = getImageFileExtension(image, image.mimeType || mimeType);
    const imagePath = path.join(tempDir, `image_${index + 1}.${extension}`);
    await fs.writeFile(imagePath, Buffer.from(base64Data, 'base64'));
    imagePaths.push(imagePath);
  }

  if (imagePaths.length === 0 && tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }

  return { imagePaths, tempDir };
}

async function cleanupCodexImageTempDir(tempDir) {
  if (!tempDir) {
    return;
  }

  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('[Codex] Failed to cleanup temp image directory:', error.message);
  }
}

/**
 * Execute a Codex query with streaming
 * @param {string} command - The prompt to send
 * @param {object} options - Options including cwd, sessionId, model, permissionMode
 * @param {WebSocket|object} ws - WebSocket connection or response writer
 */
export async function queryCodex(command, options = {}, ws) {
  const {
    sessionId,
    cwd,
    projectPath,
    model,
    permissionMode = 'default',
    images,
  } = options;

  const workingDirectory = cwd || projectPath || process.cwd();
  const effectivePermissionMode = await resolveEffectivePermissionMode(permissionMode, workingDirectory);
  const { sandboxMode, approvalPolicy } = mapPermissionModeToCodexOptions(effectivePermissionMode);

  let codexImagePaths = [];
  let codexTempImageDir = null;
  try {
    const imageProcessingResult = await materializeCodexImages(images);
    codexImagePaths = imageProcessingResult.imagePaths;
    codexTempImageDir = imageProcessingResult.tempDir;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendMessage(ws, {
      type: 'codex-error',
      error: `Failed to process images: ${message}`,
      sessionId: sessionId || null,
    });
    return;
  }

  const args = ['exec', '--experimental-json'];
  if (model) {
    args.push('--model', model);
  }
  if (sandboxMode) {
    args.push('--sandbox', sandboxMode);
  }
  if (workingDirectory) {
    args.push('--cd', workingDirectory);
  }
  args.push('--skip-git-repo-check');
  if (approvalPolicy) {
    args.push('--config', `approval_policy="${approvalPolicy}"`);
  }
  if (sessionId) {
    args.push('resume');
    for (const imagePath of codexImagePaths) {
      args.push('--image', imagePath);
    }
    args.push(sessionId);
  } else {
    for (const imagePath of codexImagePaths) {
      args.push('--image', imagePath);
    }
  }

  let currentSessionId = sessionId || `codex-pending-${Date.now()}`;
  let sessionCreatedSent = false;
  const startedAt = new Date().toISOString();
  const prompt = typeof command === 'string' ? command : '';
  let codexProcess = null;

  try {
    codexProcess = spawn('codex', args, {
      env: buildCodexProcessEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    activeCodexSessions.set(currentSessionId, {
      process: codexProcess,
      status: 'running',
      startedAt,
    });

    const emitSessionCreated = (id) => {
      if (sessionCreatedSent || !id) {
        return;
      }
      sessionCreatedSent = true;
      sendMessage(ws, {
        type: 'session-created',
        sessionId: id,
        provider: 'codex',
      });
    };

    if (sessionId) {
      emitSessionCreated(sessionId);
    }

    const closePromise = new Promise((resolve) => {
      codexProcess.once('close', (code) => resolve(code ?? -1));
    });

    codexProcess.stdin?.write(prompt);
    codexProcess.stdin?.end();

    const stderrChunks = [];
    codexProcess.stderr?.on('data', (chunk) => {
      stderrChunks.push(chunk.toString());
    });

    const rl = readline.createInterface({
      input: codexProcess.stdout,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) {
        continue;
      }

      let event;
      try {
        event = JSON.parse(trimmed);
      } catch {
        continue;
      }

      const threadId = typeof event.thread_id === 'string' ? event.thread_id : null;
      if (event.type === 'thread.started' && threadId) {
        if (threadId !== currentSessionId) {
          const trackedSession = activeCodexSessions.get(currentSessionId);
          if (trackedSession) {
            activeCodexSessions.delete(currentSessionId);
            activeCodexSessions.set(threadId, trackedSession);
          }
          currentSessionId = threadId;
        }
        emitSessionCreated(threadId);
      }

      const trackedSession = activeCodexSessions.get(currentSessionId);
      if (!trackedSession || trackedSession.status === 'aborted') {
        break;
      }

      if (event.type === 'item.started' || event.type === 'item.updated') {
        continue;
      }

      const transformed = transformCodexEvent(event);
      sendMessage(ws, {
        type: 'codex-response',
        data: transformed,
        sessionId: currentSessionId,
      });

      if (event.type === 'turn.completed' && event.usage) {
        const totalTokens = (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0);
        sendMessage(ws, {
          type: 'token-budget',
          data: {
            used: totalTokens,
            total: 200000,
          },
          sessionId: currentSessionId,
        });
      }
    }

    const exitCode = await closePromise;
    const trackedSession = activeCodexSessions.get(currentSessionId);
    const wasAborted = trackedSession?.status === 'aborted';

    if (!wasAborted && exitCode !== 0) {
      const stderrText = stderrChunks.join('').trim();
      throw new Error(stderrText || `Codex Exec exited with code ${exitCode}`);
    }

    if (!wasAborted) {
      if (!sessionCreatedSent && currentSessionId) {
        emitSessionCreated(currentSessionId);
      }
      sendMessage(ws, {
        type: 'codex-complete',
        sessionId: currentSessionId,
        actualSessionId: currentSessionId,
      });
    }

  } catch (error) {
    const session = currentSessionId ? activeCodexSessions.get(currentSessionId) : null;
    const wasAborted =
      session?.status === 'aborted' ||
      String(error?.message || '').toLowerCase().includes('aborted');

    if (!wasAborted) {
      console.error('[Codex] Error:', error);
      sendMessage(ws, {
        type: 'codex-error',
        error: error.message,
        sessionId: currentSessionId,
      });
    }

  } finally {
    // Update session status
    if (currentSessionId) {
      const session = activeCodexSessions.get(currentSessionId);
      if (session) {
        session.status = session.status === 'aborted' ? 'aborted' : 'completed';
      }
    }

    await cleanupCodexImageTempDir(codexTempImageDir);
  }
}

/**
 * Abort an active Codex session
 * @param {string} sessionId - Session ID to abort
 * @returns {boolean} - Whether abort was successful
 */
export function abortCodexSession(sessionId) {
  const session = activeCodexSessions.get(sessionId);

  if (!session) {
    return false;
  }

  session.status = 'aborted';
  try {
    session.process?.kill('SIGTERM');
  } catch (error) {
    console.warn(`[Codex] Failed to abort session ${sessionId}:`, error);
  }

  return true;
}

/**
 * Check if a session is active
 * @param {string} sessionId - Session ID to check
 * @returns {boolean} - Whether session is active
 */
export function isCodexSessionActive(sessionId) {
  const session = activeCodexSessions.get(sessionId);
  return session?.status === 'running';
}

/**
 * Get all active sessions
 * @returns {Array} - Array of active session info
 */
export function getActiveCodexSessions() {
  const sessions = [];

  for (const [id, session] of activeCodexSessions.entries()) {
    if (session.status === 'running') {
      sessions.push({
        id,
        status: session.status,
        startedAt: session.startedAt
      });
    }
  }

  return sessions;
}

/**
 * Helper to send message via WebSocket or writer
 * @param {WebSocket|object} ws - WebSocket or response writer
 * @param {object} data - Data to send
 */
function sendMessage(ws, data) {
  try {
    if (ws.isSSEStreamWriter || ws.isWebSocketWriter) {
      // Writer handles stringification (SSEStreamWriter or WebSocketWriter)
      ws.send(data);
    } else if (typeof ws.send === 'function') {
      // Raw WebSocket - stringify here
      ws.send(JSON.stringify(data));
    }
  } catch (error) {
    console.error('[Codex] Error sending message:', error);
  }
}

// Clean up old completed sessions periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  for (const [id, session] of activeCodexSessions.entries()) {
    if (session.status !== 'running') {
      const startedAt = new Date(session.startedAt).getTime();
      if (now - startedAt > maxAge) {
        activeCodexSessions.delete(id);
      }
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
