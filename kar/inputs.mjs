// kar/inputs.mjs: the thin, ungated I/O around the slicer. It reads Kar's memory on this machine and nothing else:
// the memory index and topic files, the brain's digest (Kar's working memory, via kar-mind's brain-cli), the working
// memory's business facts, the estate index, and the hand-over log a returned token was merged into (organ 4).
// The lists the leak gate needs (private repository names, the operator's names) are read here at run time and are
// never written into the repository.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, userInfo } from 'node:os';
import { execFileSync } from 'node:child_process';

export const PATHS = {
  memory: process.env.KAR_MEMORY_DIR || join(homedir(), '.claude', 'projects', 'C--Users-sjgan--claude', 'memory'),
  brain: process.env.KAR_BRAIN_DIR || join(homedir(), '.si-didy', 'brain'),
  brainCli: join(homedir(), 'kar-mind', 'brain-cli.mjs'),
  keys: process.env.KAR_PASSPORT_DIR || join(homedir(), '.si-didy', 'passport'),
};

const read = (p, fb = '') => { try { return readFileSync(p, 'utf8'); } catch { return fb; } };

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
    handoff: log ? handoffOf(log.body) : {},
    workingDirectory: join(homedir(), '.claude'),
  };
}

/** The hand-over log (organ 4 writes it): every returned token's session blocks, milestones, lessons and resolved items. */
export function handoffOf(body) {
  try { const m = /```json\n([\s\S]*?)\n```/.exec(body); return m ? JSON.parse(m[1]) : {}; } catch { return {}; }
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

export const exists = existsSync;
