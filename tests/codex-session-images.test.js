import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

test('getCodexSessionMessages preserves image-only user messages', async (t) => {
  const tempHomeDir = await mkdtemp(path.join(os.tmpdir(), 'claudecodeui-codex-images-'));
  const originalHome = process.env.HOME;

  t.after(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await rm(tempHomeDir, { recursive: true, force: true });
  });

  process.env.HOME = tempHomeDir;

  const sessionId = '019c-image-history-test';
  const sessionDir = path.join(tempHomeDir, '.codex', 'sessions', '2026', '03', '17');
  const sessionFilePath = path.join(sessionDir, `${sessionId}.jsonl`);
  await mkdir(sessionDir, { recursive: true });

  const imageDataUrl = 'data:image/png;base64,ZmFrZS1pbWFnZS1ieXRlcw==';
  const jsonlContent = [
    JSON.stringify({
      timestamp: '2026-03-17T10:00:00.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_text', text: '<image name=[Image #1]>' },
          { type: 'input_image', name: 'Image #1', image_url: imageDataUrl },
          { type: 'input_text', text: '</image>' },
        ],
      },
    }),
  ].join('\n');

  await writeFile(sessionFilePath, `${jsonlContent}\n`, 'utf8');

  const projectsModuleUrl = `${pathToFileURL(path.join(process.cwd(), 'server/projects.js')).href}?test=${Date.now()}`;
  const { getCodexSessionMessages } = await import(projectsModuleUrl);

  const result = await getCodexSessionMessages(sessionId);

  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].type, 'user');
  assert.equal(result.messages[0].message.content, '');
  assert.deepEqual(result.messages[0].message.images, [
    {
      name: 'Image #1',
      data: imageDataUrl,
    },
  ]);
});
