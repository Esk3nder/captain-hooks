#!/usr/bin/env bun
/**
 * skill-eval.hook.ts — Skill Activation Evaluator (UserPromptSubmit)
 *
 * PURPOSE: Scores user prompts against skill-rules.json using weighted
 *          multi-factor scoring. Matched skills are injected into context.
 * TRIGGER: UserPromptSubmit
 * INPUT:   { prompt, session_id }
 * OUTPUT:  <system-reminder> with skill suggestions (if any match)
 * EXIT:    Always 0 (never blocks the user)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { readStdin } from './lib/stdin.ts';
import { getFrameworkDir } from './lib/paths.ts';
import { log } from './lib/logger.ts';

// ============================================================
// Types
// ============================================================

interface Weights {
  keyword: number;
  pattern: number;
  directory: number;
  intent: number;
  filePath: number;
  content: number;
}

interface Triggers {
  keywords?: string[];
  patterns?: string[];
  fileTypes?: string[];
  directories?: string[];
  intents?: string[];
  contentPatterns?: string[];
}

interface Rule {
  skill: string;
  type: 'proactive' | 'reactive' | 'guard';
  enforcement: 'suggest' | 'inject' | 'require';
  priority: number;
  triggers: Triggers;
  weights?: Partial<Weights>;
  threshold?: number;
  suggestion: string;
  cooldown?: number;
}

interface SkillRules {
  version: string;
  defaults: { weights: Weights; threshold: number };
  rules: Rule[];
  exclusions: { prefixes: string[]; patterns: string[] };
  settings: { maxSuggestions: number; showScores: boolean };
}

interface HookInput {
  prompt: string;
  session_id: string;
}

interface ScoredMatch {
  rule: Rule;
  normalizedScore: number;
  finalScore: number;
}

// ============================================================
// Cooldown tracking (process-scoped, resets per session)
// ============================================================

const cooldownMap = new Map<string, number>();

function isOnCooldown(skill: string, cooldownSeconds: number): boolean {
  const lastFired = cooldownMap.get(skill);
  if (!lastFired) return false;
  return (Date.now() - lastFired) < cooldownSeconds * 1000;
}

function recordFire(skill: string): void {
  cooldownMap.set(skill, Date.now());
}

// ============================================================
// Scoring Engine
// ============================================================

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchKeywords(prompt: string, keywords: string[]): number {
  const lower = prompt.toLowerCase();
  let matches = 0;
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
    if (regex.test(lower)) matches++;
  }
  return matches;
}

function matchPatterns(prompt: string, patterns: string[]): number {
  let matches = 0;
  for (const pat of patterns) {
    try {
      if (new RegExp(pat, 'i').test(prompt)) matches++;
    } catch { /* invalid regex — skip */ }
  }
  return matches;
}

function matchDirectories(cwd: string, directories: string[]): number {
  let matches = 0;
  for (const dir of directories) {
    if (cwd.includes(dir)) matches++;
  }
  return matches;
}

function matchIntents(prompt: string, intents: string[]): number {
  const intentKeywords: Record<string, string[]> = {
    debug:    ['bug', 'error', 'fix', 'broken', 'crash', 'fail', 'debug', 'issue'],
    create:   ['create', 'new', 'add', 'build', 'scaffold', 'generate', 'init'],
    deploy:   ['deploy', 'ship', 'release', 'publish', 'push', 'launch'],
    test:     ['test', 'spec', 'coverage', 'assert', 'expect', 'tdd'],
    refactor: ['refactor', 'clean', 'reorganize', 'restructure', 'simplify'],
    research: ['research', 'investigate', 'explore', 'understand', 'analyze'],
    review:   ['review', 'feedback', 'check', 'audit', 'inspect'],
    extend:   ['extend', 'plugin', 'hook', 'skill', 'customize', 'configure'],
    capture:  ['note', 'capture', 'remember', 'save', 'jot', 'log', 'record'],
  };

  const lower = prompt.toLowerCase();
  let matches = 0;

  for (const intent of intents) {
    const family = intentKeywords[intent];
    if (!family) continue;
    for (const word of family) {
      if (lower.includes(word)) {
        matches++;
        break;
      }
    }
  }
  return matches;
}

function matchFileTypes(prompt: string, fileTypes: string[]): number {
  let matches = 0;
  for (const ft of fileTypes) {
    if (prompt.includes(ft)) matches++;
  }
  return matches;
}

function scoreRule(
  prompt: string,
  rule: Rule,
  defaultWeights: Weights,
  defaultThreshold: number
): ScoredMatch | null {
  const weights: Weights = { ...defaultWeights, ...rule.weights };
  const threshold = rule.threshold ?? defaultThreshold;
  const triggers = rule.triggers;
  const cwd = process.cwd();

  const dims: { count: number; total: number; weight: number }[] = [];

  if (triggers.keywords?.length) {
    dims.push({
      count: matchKeywords(prompt, triggers.keywords),
      total: triggers.keywords.length,
      weight: weights.keyword,
    });
  }
  if (triggers.patterns?.length) {
    dims.push({
      count: matchPatterns(prompt, triggers.patterns),
      total: triggers.patterns.length,
      weight: weights.pattern,
    });
  }
  if (triggers.directories?.length) {
    dims.push({
      count: matchDirectories(cwd, triggers.directories),
      total: triggers.directories.length,
      weight: weights.directory,
    });
  }
  if (triggers.intents?.length) {
    dims.push({
      count: matchIntents(prompt, triggers.intents),
      total: triggers.intents.length,
      weight: weights.intent,
    });
  }
  if (triggers.fileTypes?.length) {
    dims.push({
      count: matchFileTypes(prompt, triggers.fileTypes),
      total: triggers.fileTypes.length,
      weight: weights.filePath,
    });
  }
  // contentPatterns: stubbed for minimal framework
  // Production implementations can read a file cache here.

  if (dims.length === 0) return null;

  const totalMatches = dims.reduce((s, d) => s + d.count, 0);
  if (totalMatches === 0) return null;

  const rawScore = dims.reduce((s, d) => s + d.count * d.weight, 0);
  const maxScore = dims.reduce((s, d) => s + d.total * d.weight, 0);
  const normalizedScore = (rawScore / maxScore) * 100;

  if (normalizedScore < threshold) return null;

  const priority = rule.priority ?? 5;
  const finalScore = normalizedScore * (priority / 10);

  return { rule, normalizedScore, finalScore };
}

// ============================================================
// Exclusion Check
// ============================================================

function isExcluded(prompt: string, exclusions: SkillRules['exclusions']): boolean {
  const trimmed = prompt.trim().toLowerCase();

  for (const prefix of exclusions.prefixes) {
    if (trimmed.startsWith(prefix.toLowerCase())) return true;
  }

  for (const pat of exclusions.patterns) {
    try {
      if (new RegExp(pat, 'i').test(trimmed)) return true;
    } catch { /* skip */ }
  }

  return false;
}

// ============================================================
// Skill Context Loader (for "inject" enforcement)
// ============================================================

function loadSkillContext(skillName: string): string | null {
  const skillPath = join(getFrameworkDir(), 'skills', skillName, 'SKILL.md');
  if (!existsSync(skillPath)) return null;

  try {
    return readFileSync(skillPath, 'utf-8');
  } catch {
    return null;
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const input = await readStdin<HookInput>(100);
  if (!input?.prompt) process.exit(0);

  const rulesPath = join(getFrameworkDir(), 'skills', 'skill-rules.json');
  if (!existsSync(rulesPath)) {
    log('skill-eval', 'No skill-rules.json found, skipping');
    process.exit(0);
  }

  let rules: SkillRules;
  try {
    rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
  } catch (e) {
    log('skill-eval', `Failed to parse skill-rules.json: ${e}`);
    process.exit(0);
  }

  if (isExcluded(input.prompt, rules.exclusions)) process.exit(0);

  const matches: ScoredMatch[] = [];

  for (const rule of rules.rules) {
    if (rule.type !== 'proactive') continue;
    if (rule.cooldown && isOnCooldown(rule.skill, rule.cooldown)) continue;

    const scored = scoreRule(input.prompt, rule, rules.defaults.weights, rules.defaults.threshold);
    if (scored) matches.push(scored);
  }

  if (matches.length === 0) process.exit(0);

  matches.sort((a, b) => b.finalScore - a.finalScore);
  const top = matches.slice(0, rules.settings.maxSuggestions);

  const parts: string[] = [];

  for (const match of top) {
    recordFire(match.rule.skill);

    const scoreStr = rules.settings.showScores
      ? ` [score: ${match.normalizedScore.toFixed(0)}]`
      : '';

    switch (match.rule.enforcement) {
      case 'inject': {
        const ctx = loadSkillContext(match.rule.skill);
        if (ctx) {
          parts.push(`--- Auto-loaded skill: ${match.rule.skill}${scoreStr} ---\n${ctx}`);
        } else {
          parts.push(`Skill suggestion: ${match.rule.suggestion}${scoreStr}`);
        }
        break;
      }
      case 'require':
        parts.push(`REQUIRED: ${match.rule.suggestion}${scoreStr}\nPlease acknowledge before proceeding.`);
        break;
      case 'suggest':
      default:
        parts.push(`Skill suggestion: ${match.rule.suggestion}${scoreStr}`);
        break;
    }
  }

  if (parts.length > 0) {
    console.log(`<system-reminder>\n${parts.join('\n\n')}\n</system-reminder>`);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
