# Codex Image Restore Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the previously working Codex image flow on `main`, including sending attached images and preserving image messages in session history.

**Architecture:** Reuse the already-proven logic from commit `21565d2`. Restore the missing `images` payload in the Codex chat submit path, and restore Codex history parsing so image-only user messages remain visible in the UI.

**Tech Stack:** React hooks, Node.js, Codex CLI session JSONL parsing, Node built-in test runner

---

### Task 1: Lock the session-history regression with a failing test

**Files:**
- Create: `tests/codex-session-images.test.js`
- Modify: `server/projects.js`

**Step 1: Write the failing test**

Add a regression test that creates a temporary `~/.codex/sessions/.../*.jsonl` file containing an image-only user message and asserts that `getCodexSessionMessages()` returns that message with `message.images`.

**Step 2: Run test to verify it fails**

Run: `node --test tests/codex-session-images.test.js`

Expected: FAIL because the current parser drops image-only messages.

**Step 3: Write minimal implementation**

Restore the historical Codex content parsing logic so text markers are stripped, image parts are extracted, and image-only messages are preserved.

**Step 4: Run test to verify it passes**

Run: `node --test tests/codex-session-images.test.js`

Expected: PASS.

### Task 2: Restore Codex upload forwarding from the chat composer

**Files:**
- Modify: `src/components/chat/hooks/useChatComposerState.ts`

**Step 1: Restore the missing field**

Add `images: uploadedImages` back to the `provider === 'codex'` `sendMessage(...).options` payload.

**Step 2: Verify compile/build**

Run:
- `npm run typecheck`
- `npm run build`

Expected: both commands exit successfully.
