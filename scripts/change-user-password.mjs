#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';

function printUsage() {
  console.log(`Usage:
  node scripts/change-user-password.mjs --username <name> [--password <value> | --password-env <ENV_VAR> | --prompt] [--no-confirm] [--db <path>] [--rounds <n>]

Examples:
  node scripts/change-user-password.mjs --username chendx --password "MyNewPass123"
  PASSWORD_VALUE="MyNewPass123" node scripts/change-user-password.mjs --username chendx --password-env PASSWORD_VALUE
  node scripts/change-user-password.mjs --username chendx --prompt
`);
}

async function promptHidden(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Interactive prompt requires a TTY terminal');
  }

  return new Promise((resolve, reject) => {
    let value = '';

    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.pause();
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    const onData = (buffer) => {
      const text = buffer.toString('utf8');

      for (const char of text) {
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }

        if (char === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Input cancelled by user'));
          return;
        }

        if (char === '\u0008' || char === '\u007f') {
          value = value.slice(0, -1);
          continue;
        }

        value += char;
      }
    };

    process.stdout.write(label);
    process.stdin.resume();
    process.stdin.setRawMode(true);
    process.stdin.on('data', onData);
  });
}

function parseArgs(argv) {
  const args = {
    username: '',
    password: '',
    passwordEnv: '',
    prompt: false,
    confirmPrompt: true,
    dbPath: '',
    rounds: 12,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];

    switch (key) {
      case '--username':
      case '-u':
        args.username = value || '';
        i += 1;
        break;
      case '--password':
      case '-p':
        args.password = value || '';
        i += 1;
        break;
      case '--password-env':
        args.passwordEnv = value || '';
        i += 1;
        break;
      case '--prompt':
        args.prompt = true;
        break;
      case '--no-confirm':
        args.confirmPrompt = false;
        break;
      case '--db':
        args.dbPath = value || '';
        i += 1;
        break;
      case '--rounds':
        args.rounds = Number.parseInt(value || '', 10);
        i += 1;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        break;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.username) {
    throw new Error('Missing required argument: --username');
  }

  const passwordFromEnv = args.passwordEnv ? process.env[args.passwordEnv] || '' : '';
  const nonPromptPasswordCount = Number(Boolean(args.password)) + Number(Boolean(passwordFromEnv));

  if (args.prompt && nonPromptPasswordCount > 0) {
    throw new Error('Use only one password input mode: --prompt OR (--password / --password-env)');
  }

  if (!args.prompt && nonPromptPasswordCount > 1) {
    throw new Error('Use only one of --password or --password-env');
  }

  let nextPassword = args.password || passwordFromEnv || '';

  if (args.prompt) {
    const first = await promptHidden('Enter new password (hidden): ');
    if (!first) {
      throw new Error('Password is required');
    }

    if (args.confirmPrompt) {
      const second = await promptHidden('Confirm new password (hidden): ');
      if (first !== second) {
        throw new Error('Passwords do not match');
      }
    }

    nextPassword = first;
  }

  if (!nextPassword) {
    throw new Error('Password is required. Use --password, --password-env, or --prompt');
  }

  if (nextPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  if (!Number.isInteger(args.rounds) || args.rounds < 4 || args.rounds > 20) {
    throw new Error('Invalid --rounds value. Choose an integer between 4 and 20');
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '..');
  const defaultDbPath = process.env.DATABASE_PATH || path.join(projectRoot, 'server', 'database', 'auth.db');
  const resolvedDbPath = path.resolve(args.dbPath || defaultDbPath);

  if (!fs.existsSync(resolvedDbPath)) {
    throw new Error(`Database file not found: ${resolvedDbPath}`);
  }

  const db = new Database(resolvedDbPath);

  try {
    const user = db
      .prepare('SELECT id, username, is_active FROM users WHERE username = ? LIMIT 1')
      .get(args.username);

    if (!user) {
      throw new Error(`User not found: ${args.username}`);
    }

    const hash = await bcrypt.hash(nextPassword, args.rounds);
    const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

    if (result.changes !== 1) {
      throw new Error('Password update failed');
    }

    console.log(`Password updated successfully for user: ${user.username}`);
    console.log(`Database: ${resolvedDbPath}`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
