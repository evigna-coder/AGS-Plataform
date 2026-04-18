#!/usr/bin/env node
// PostToolUse hook: soft warning if an edit introduces `: undefined` or `= undefined`
// in a service file near a Firestore write call. See .claude/rules/firestore.md.

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
  if (!/\.tsx?$/.test(normalized)) process.exit(0);
  if (!/\/apps\/[^/]+\/src\/services\//i.test(normalized)) process.exit(0);

  // Collect the "new content" surface this edit produced.
  const pieces = [];
  if (tool === 'Write') {
    pieces.push(evt.tool_input?.content || '');
  } else if (tool === 'Edit') {
    pieces.push(evt.tool_input?.new_string || '');
  } else if (tool === 'MultiEdit') {
    for (const e of evt.tool_input?.edits || []) pieces.push(e.new_string || '');
  }
  const surface = pieces.join('\n');
  if (!surface) process.exit(0);

  // Look for a write call in the surface (or adjacent) AND an explicit undefined.
  const hasWriteCall = /\b(setDoc|updateDoc|addDoc|setDocs|writeBatch)\s*\(/.test(surface);
  const hasExplicitUndefined = /[:=]\s*undefined\b/.test(surface);

  if (hasExplicitUndefined) {
    const msg = hasWriteCall
      ? 'WARN: explicit `undefined` appears next to a Firestore write in this edit.'
      : 'WARN: explicit `undefined` in a service file — Firestore will reject it if it reaches a write.';
    process.stderr.write(
      `${msg}\n` +
      `File: ${filePath}\n` +
      `Use cleanFirestoreData() for flat payloads or deepCleanForFirestore() for nested. ` +
      `See .claude/rules/firestore.md.\n`
    );
    // Non-blocking: exit 1 surfaces the message without aborting.
    process.exit(1);
  }

  process.exit(0);
});
