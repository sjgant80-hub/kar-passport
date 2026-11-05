// kar/inputs.mjs: the thin, ungated I/O around the slicer. It reads Kar's memory on this machine and nothing else:
// the memory index and topic files, the brain's digest (Kar's working memory, via kar-mind's brain-cli), the working
// memory's business facts, the estate index, and the hand-over log a returned token was merged into (organ 4).
// The lists the leak gate needs (private repository names, the operator's names) are read here at run time and are
// never written into the repository.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, userInfo } from 'node:os';
import { execFileSync } from 'node:child_process';
import { readLog, mergedOf } from '../src/drift.mjs';
import { noteOf, ordered } from '../src/notes.mjs';
import { textOf, jsonOf } from './text.mjs';

// Every file is read through kar/text.mjs: a byte-order mark (Windows PowerShell's `>`, some Windows editors) is read,
// never a reason to throw.
const read = (p, fb = '') => { try { return textOf(readFileSync(p)); } catch { return fb; } };

// This machine's paths live in ~/.kar-passport/config.json (never committed): where the memory, the brain and its CLI
// are, and the full slice's private retrieval lines. The passport's own state (the key seed, the REF lookup, the tokens
// it made, the ingest plans) lives beside it.
export const HOME_DIR = process.env.KAR_PASSPORT_DIR || join(homedir(), '.kar-passport');
export const CONFIG_FILE = join(HOME_DIR, 'config.json');
const config = jsonOf(read(CONFIG_FILE, '{}'));
/** Why config.json could not be read as an object ('' when it could, or when there is none): the command says so plainly. */
export const CONFIG_PROBLEM = !config.ok ? config.why + (read(CONFIG_FILE).includes('\\') ? ' (in JSON a backslash starts an escape: write each backslash of a Windows path as a forward slash)' : '')
  : config.value === null || typeof config.value !== 'object' || Array.isArray(config.value) ? 'it is not a JSON object' : '';
export const CONFIG = CONFIG_PROBLEM ? {} : config.value;
export const PATHS = { memory: CONFIG.memory || '', brain: CONFIG.brain || '', brainCli: CONFIG.brainCli || '', keys: HOME_DIR };

/** A topic file's frontmatter: name, description, type (and the body, for the retrospectives). */
export function topicOf(file, text) {
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text.replace(/\r\n/g, '\n'));
  const head = fm ? fm[1] : '';
  const get = (k) => { const m = new RegExp('^\\s*' + k + ':\\s*(.*)$', 'm').exec(head); return m ? m[1].replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"') : ''; };
  return { name: get('name') || file.replace(/\.md$/, ''), description: get('description'), type: get('type'), body: fm ? text.slice(fm[0].length) : text };
}

export function brainDigest() {
  try { return execFileSync(process.execPath, [PATHS.brainCli, 'digest'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000 }).toString('utf8'); } catch { return read(join(PATHS.brain, 'digest.txt')); }
}

export function readInputs(now, memoryDir = PATHS.memory) {
  const files = readdirSync(memoryDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md').sort();
  const topics = files.map((f) => topicOf(f, read(join(memoryDir, f))));
  const ix = JSON.parse(read(join(PATHS.memory, 'estate-index.json'), '{"nodes":[]}'));
  const name = (() => { try { return execFileSync('git', ['config', 'user.name'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } })();
  const log = topics.find((t) => t.name === 'symbfer-handoff-log');
  return {
    now, today: now.slice(0, 10),
    index: read(join(memoryDir, 'MEMORY.md')),
    topics: topics.map(({ name: n, description, type }) => ({ name: n, description, type })),
    retros: (topics.find((t) => t.name === 'build-retrospectives') || { body: '' }).body,
    digest: brainDigest(),
    working: read(join(PATHS.brain, 'kar-working-memory.txt')).split('\n'),
    estate: { total: ix.total, public: ix.public, private: ix.private, live: ix.live, repos: (ix.nodes || []).map((r) => ({ name: r.name, desc: r.desc, live: r.live, private: r.private })) },
    operator: { first: name.split(' ')[0] || '', fullName: name },
    handoff: log ? mergedOf(readLog(log.body)) : {},
    workingDirectory: CONFIG.workingDirectory || '',
    retrieve: Array.isArray(CONFIG.retrieveFull) ? CONFIG.retrieveFull : [],
  };
}

export function readLists() {
  const ix = JSON.parse(read(join(PATHS.memory, 'estate-index.json'), '{"nodes":[]}'));
  const name = (() => { try { return execFileSync('git', ['config', 'user.name'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } })();
  const parts = name.split(/\s+/).filter(Boolean);
  return {
    privateNames: (ix.nodes || []).filter((r) => r.private === true).map((r) => r.name),
    surnames: [...parts.slice(1), userInfo().username].filter((x) => x && x.length > 1),
    firstNames: parts.slice(0, 1),
    canaries: [],
  };
}

/** A team's own notes folder (src/notes.mjs): every note but the hand-over log, in MEMORY.md's order, and that log merged. */
export function teamInput(now, dir = PATHS.memory) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md').sort();
  const notes = files.map((f) => noteOf(read(join(dir, f)))).filter((n) => n && n.name !== 'symbfer-handoff-log');
  const log = topicOf('symbfer-handoff-log.md', read(join(dir, 'symbfer-handoff-log.md')));
  return { now, about: CONFIG.about || {}, notes: ordered(read(join(dir, 'MEMORY.md')), notes), handoff: log.body.trim() ? mergedOf(readLog(log.body)) : {} };
}

export const exists = existsSync;
