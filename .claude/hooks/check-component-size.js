#!/usr/bin/env node
// PostToolUse hook: soft warning when an edited .tsx component exceeds 250 lines.
// Excludes apps/reportes-ot (frozen). See .claude/rules/components.md.

const fs = require('fs');
const LIMIT = 250;

const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  let evt;
  try {
    evt = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    process.exit(0);
  }

  const tool = evt.tool_name;
  if (tool !== 'Edit' && tool !== 'Write' && tool !== 'MultiEdit') process.exit(0);

  const filePath = evt.tool_input?.file_path || '';
  const normalized = filePath.replace(/\\/g, '/');
  if (!/\.tsx$/.test(normalized)) process.exit(0);
  if (/\/apps\/reportes-ot\//i.test(normalized)) process.exit(0);
  if (!/\/apps\/(sistema-modular|portal-ingeniero)\/src\//i.test(normalized)) process.exit(0);

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    process.exit(0);
  }

  const lines = content.split(/\r?\n/).length;
  if (lines > LIMIT) {
    process.stderr.write(
      `WARN: component is ${lines} lines (budget ${LIMIT}).\n` +
      `File: ${filePath}\n` +
      `Extract a hook (useXxx) or subcomponent before adding more. ` +
      `See .claude/rules/components.md.\n`
    );
    process.exit(1);
  }
  process.exit(0);
});
