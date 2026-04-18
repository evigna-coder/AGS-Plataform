#!/usr/bin/env node
// PreToolUse hook: block edits to apps/reportes-ot/ unless CLAUDE_ALLOW_REPORTES_OT=1.
// See .claude/rules/reportes-ot.md for context.

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
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  if (!normalized.includes('/apps/reportes-ot/')) process.exit(0);

  if (process.env.CLAUDE_ALLOW_REPORTES_OT === '1') process.exit(0);

  process.stderr.write(
    `BLOCKED: apps/reportes-ot/ is a frozen surface (.claude/rules/reportes-ot.md).\n` +
    `File: ${filePath}\n` +
    `If this edit is genuinely intended (task is about the técnico app / PDF pipeline), ` +
    `set CLAUDE_ALLOW_REPORTES_OT=1 in the shell env and retry.\n`
  );
  process.exit(2);
});
