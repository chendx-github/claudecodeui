import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const UI_SETTINGS_PATH = path.join(CLAUDE_DIR, 'claudecodeui-settings.json');

const DEFAULT_UI_SETTINGS = Object.freeze({
  codexAutoDiscoverProjects: true,
});

function normalizeUiSettings(rawSettings = {}) {
  const source =
    rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
      ? rawSettings
      : {};

  return {
    codexAutoDiscoverProjects:
      typeof source.codexAutoDiscoverProjects === 'boolean'
        ? source.codexAutoDiscoverProjects
        : DEFAULT_UI_SETTINGS.codexAutoDiscoverProjects,
  };
}

async function ensureClaudeDirectory() {
  await fs.mkdir(CLAUDE_DIR, { recursive: true });
}

async function loadUiSettings() {
  try {
    const configData = await fs.readFile(UI_SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(configData);
    return normalizeUiSettings(parsed);
  } catch (error) {
    return { ...DEFAULT_UI_SETTINGS };
  }
}

async function saveUiSettings(settings) {
  const normalized = normalizeUiSettings(settings);
  await ensureClaudeDirectory();
  await fs.writeFile(UI_SETTINGS_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function updateUiSettings(partialSettings) {
  const currentSettings = await loadUiSettings();
  return saveUiSettings({
    ...currentSettings,
    ...(partialSettings || {}),
  });
}

export {
  DEFAULT_UI_SETTINGS,
  loadUiSettings,
  saveUiSettings,
  updateUiSettings,
};
