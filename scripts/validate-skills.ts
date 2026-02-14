#!/usr/bin/env bun
/**
 * validate-skills.ts — Validate all skills against Captain Hooks conventions.
 *
 * Checks:
 * 1. Every skill directory has a SKILL.md
 * 2. SKILL.md has valid YAML frontmatter with name + description
 * 3. Description contains "USE WHEN" (except CORE)
 * 4. Workflows/ directory exists
 * 5. Tools/ directory exists
 * 6. All referenced workflows exist as files
 * 7. skill-rules.json has a matching entry
 * 8. No file exceeds 500 lines
 *
 * Usage: bun scripts/validate-skills.ts
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const skillsDir = join(import.meta.dir, '..', 'skills');
const rulesPath = join(skillsDir, 'skill-rules.json');

interface ValidationResult {
  skill: string;
  errors: string[];
  warnings: string[];
}

function countLines(filePath: string): number {
  return readFileSync(filePath, 'utf-8').split('\n').length;
}

function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      result[key] = value;
    }
  }
  return result;
}

function extractWorkflowRefs(content: string): string[] {
  const refs: string[] = [];
  const matches = content.matchAll(/`Workflows\/([^`]+)`/g);
  for (const m of matches) {
    refs.push(m[1]);
  }
  return refs;
}

function validateSkill(skillName: string, skillPath: string): ValidationResult {
  const result: ValidationResult = { skill: skillName, errors: [], warnings: [] };

  // Check SKILL.md exists
  const skillMdPath = join(skillPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    result.errors.push('Missing SKILL.md');
    return result;
  }

  const content = readFileSync(skillMdPath, 'utf-8');

  // Check YAML frontmatter
  const fm = parseFrontmatter(content);
  if (!fm) {
    result.errors.push('Missing YAML frontmatter (---\\n...\\n---)');
  } else {
    if (!fm.name) result.errors.push('Frontmatter missing "name" field');
    if (!fm.description) result.errors.push('Frontmatter missing "description" field');

    // Check USE WHEN (except CORE)
    if (skillName !== 'CORE' && fm.description && !fm.description.includes('USE WHEN')) {
      result.errors.push('Description must contain "USE WHEN"');
    }

    // Check TitleCase name
    if (fm.name && fm.name !== skillName && !skillName.startsWith('_')) {
      result.warnings.push(`Frontmatter name "${fm.name}" doesn't match directory "${skillName}"`);
    }
  }

  // Check Workflows/ directory
  const workflowsDir = join(skillPath, 'Workflows');
  if (!existsSync(workflowsDir)) {
    result.warnings.push('Missing Workflows/ directory');
  } else {
    // Check referenced workflows exist
    const refs = extractWorkflowRefs(content);
    for (const ref of refs) {
      if (!existsSync(join(workflowsDir, ref))) {
        result.errors.push(`Referenced workflow missing: Workflows/${ref}`);
      }
    }
  }

  // Check Tools/ directory
  const toolsDir = join(skillPath, 'Tools');
  if (!existsSync(toolsDir)) {
    result.errors.push('Missing Tools/ directory');
  }

  // Check line counts
  const lines = countLines(skillMdPath);
  if (lines > 500) {
    result.warnings.push(`SKILL.md is ${lines} lines (guideline: <500)`);
  }

  return result;
}

function main(): void {
  console.log('Captain Hooks — Skill Validator\n');

  // Load skill-rules.json
  let rulesSkills: Set<string> = new Set();
  if (existsSync(rulesPath)) {
    try {
      const rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
      for (const rule of rules.rules || []) {
        rulesSkills.add(rule.skill);
      }
    } catch (e) {
      console.error(`Failed to parse skill-rules.json: ${e}`);
    }
  } else {
    console.error('Warning: skill-rules.json not found\n');
  }

  // Find all skill directories
  const entries = readdirSync(skillsDir).filter(e => {
    const full = join(skillsDir, e);
    return statSync(full).isDirectory();
  });

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const entry of entries) {
    const result = validateSkill(entry, join(skillsDir, entry));

    // Check skill-rules.json entry (except CORE which loads via hook)
    if (entry !== 'CORE' && !rulesSkills.has(entry)) {
      result.warnings.push('No matching entry in skill-rules.json');
    }

    const icon = result.errors.length > 0 ? '  ' : '  ';
    console.log(`${icon} ${result.skill}`);

    for (const err of result.errors) {
      console.log(`    ERROR: ${err}`);
    }
    for (const warn of result.warnings) {
      console.log(`    WARN:  ${warn}`);
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log('    OK');
    }

    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
    console.log('');
  }

  console.log('---');
  console.log(`Skills: ${entries.length} | Errors: ${totalErrors} | Warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.log('\nValidation FAILED');
    process.exit(1);
  } else {
    console.log('\nValidation PASSED');
    process.exit(0);
  }
}

main();
