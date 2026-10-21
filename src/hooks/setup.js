#!/usr/bin/env node
/**
 * Sets up Claude Code hooks for the companion app.
 * Adds hook entries to the user's Claude Code settings.
 *
 * Run: node src/hooks/setup.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

const HOOKS_DIR = resolve(import.meta.dirname || '.', '.');
const CLAUDE_SETTINGS_DIR = join(homedir(), '.claude');
const SETTINGS_FILE = join(CLAUDE_SETTINGS_DIR, 'settings.json');

function loadSettings() {
  if (existsSync(SETTINGS_FILE)) {
    return JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
  }
  return {};
}

function saveSettings(settings) {
  mkdirSync(CLAUDE_SETTINGS_DIR, { recursive: true });
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n');
}

function makeExecutable(file) {
  try {
    chmodSync(file, 0o755);
  } catch { /* ignore on Windows */ }
}

function setup() {
  const settings = loadSettings();

  if (!settings.hooks) settings.hooks = {};

  const hookScripts = [
    {
      file: 'question-relay.sh',
      event: 'PreToolUse',
      matcher: 'AskUserQuestion',
    },
    {
      file: 'approval-relay.sh',
      event: 'PreToolUse',
      matcher: 'Bash|Write|Edit',
    },
    {
      file: 'usage-tracker.sh',
      event: 'PostToolUse',
      matcher: '',
    },
    {
      file: 'session-start.sh',
      event: 'SessionStart',
      matcher: '',
    },
  ];

  for (const hook of hookScripts) {
    const scriptPath = join(HOOKS_DIR, hook.file);
    makeExecutable(scriptPath);

    if (!settings.hooks[hook.event]) {
      settings.hooks[hook.event] = [];
    }

    const existing = settings.hooks[hook.event].find(
      (h) => h.command?.includes(hook.file)
    );

    if (!existing) {
      const entry = {
        command: `bash ${scriptPath}`,
      };
      if (hook.matcher) {
        entry.matcher = hook.matcher;
      }
      settings.hooks[hook.event].push(entry);
    }
  }

  saveSettings(settings);

  console.log('Claude Companion hooks installed successfully!');
  console.log('');
  console.log('Set these environment variables before running Claude Code:');
  console.log('  export CLAUDE_COMPANION_URL=http://localhost:3847');
  console.log('  export CLAUDE_COMPANION_SECRET=your-api-secret');
  console.log('');
  console.log('Hook scripts installed at:', HOOKS_DIR);
}

setup();
