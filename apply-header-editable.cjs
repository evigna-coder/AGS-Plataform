const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/Evigna/Desktop/Ags plataform';

function editFile(relPath, replacements) {
  const abs = path.join(ROOT, relPath);
  let src = fs.readFileSync(abs, 'utf8');
  for (const { find, replace } of replacements) {
    if (!src.includes(find)) {
      console.error(`[${relPath}] FIND NOT FOUND:\n${find.slice(0, 120)}...`);
      process.exit(1);
    }
    src = src.replace(find, replace);
  }
  fs.writeFileSync(abs, src);
  console.log(`[OK] ${relPath}`);
}

// ==========================================================================
// 1) useAppLogic.ts  — add handler + export
// ==========================================================================
editFile('apps/reportes-ot/hooks/useAppLogic.ts', [
  {
    find: `  const handleColumnVisibilityChange = (tableId: string, colKey: string, visible: boolean) => {`,
    replace: `  const handleColumnHeaderDataChange = (tableId: string, colKey: string, value: string) => {
    setProtocolSelections(prev =>
      prev.map(s =>
        s.tableId !== tableId ? s : {
          ...s,
          columnHeaderData: { ...(s.columnHeaderData ?? {}), [colKey]: value },
        }
      )
    );
  };

  const handleColumnVisibilityChange = (tableId: string, colKey: string, visible: boolean) => {`,
  },
  {
    find: `handleAddRow, handleRemoveRow, handleDuplicateRow, handleHeaderDataChange, handleColumnVisibilityChange,`,
    replace: `handleAddRow, handleRemoveRow, handleDuplicateRow, handleHeaderDataChange, handleColumnVisibilityChange, handleColumnHeaderDataChange,`,
  },
]);

// ==========================================================================
// 2) ProtocolSection.tsx — add prop to interface + destructure + pass down
// ==========================================================================
editFile('apps/reportes-ot/components/ProtocolSection.tsx', [
  {
    find: `  handleColumnVisibilityChange: (tableId: string, colKey: string, visible: boolean) => void;`,
    replace: `  handleColumnVisibilityChange: (tableId: string, colKey: string, visible: boolean) => void;
  handleColumnHeaderDataChange: (tableId: string, colKey: string, value: string) => void;`,
  },
  {
    find: `handleAddRow, handleRemoveRow, handleDuplicateRow, handleHeaderDataChange, handleColumnVisibilityChange,`,
    replace: `handleAddRow, handleRemoveRow, handleDuplicateRow, handleHeaderDataChange, handleColumnVisibilityChange, handleColumnHeaderDataChange,`,
  },
  {
    find: `                onChangeColumnVisibility={handleColumnVisibilityChange}`,
    replace: `                onChangeColumnVisibility={handleColumnVisibilityChange}
                onChangeColumnHeader={handleColumnHeaderDataChange}`,
  },
]);

// ==========================================================================
// 3) App.tsx — pass handler in 2 places
// ==========================================================================
editFile('apps/reportes-ot/App.tsx', [
  {
    find: `            handleColumnVisibilityChange={app.handleColumnVisibilityChange}
            handleChecklistAnswer={app.handleChecklistAnswer}`,
    replace: `            handleColumnVisibilityChange={app.handleColumnVisibilityChange}
            handleColumnHeaderDataChange={app.handleColumnHeaderDataChange}
            handleChecklistAnswer={app.handleChecklistAnswer}`,
  },
  {
    find: `        handleColumnVisibilityChange={app.handleColumnVisibilityChange}
        handleChecklistAnswer={app.handleChecklistAnswer}`,
    replace: `        handleColumnVisibilityChange={app.handleColumnVisibilityChange}
        handleColumnHeaderDataChange={app.handleColumnHeaderDataChange}
        handleChecklistAnswer={app.handleChecklistAnswer}`,
  },
]);

// ==========================================================================
// 4) CatalogTableView.tsx — add prop, destructure, render inline input (3 places)
// ==========================================================================
const headerInputSnippet = (indent) => `{col.headerEditable && (
${indent}  <>
${indent}    <span className={\`font-normal ml-1 \${isPrint ? 'text-slate-500' : 'text-slate-400'}\`}>(</span>
${indent}    {isPrint || readOnly ? (
${indent}      <span className="font-normal">{selection.columnHeaderData?.[col.key] || '\\u00A0\\u00A0\\u00A0\\u00A0'}</span>
${indent}    ) : (
${indent}      <input
${indent}        type="text"
${indent}        maxLength={col.headerEditableMaxLength ?? 15}
${indent}        value={selection.columnHeaderData?.[col.key] ?? ''}
${indent}        onChange={(e) => onChangeColumnHeader?.(selection.tableId, col.key, e.target.value)}
${indent}        onClick={(e) => e.stopPropagation()}
${indent}        className="inline-block border-b border-slate-400 bg-transparent px-1 text-xs font-normal focus:outline-none focus:border-blue-500"
${indent}        style={{ width: \`\${Math.max((col.headerEditableMaxLength ?? 15) * 0.6, 4)}em\` }}
${indent}        placeholder="—"
${indent}      />
${indent}    )}
${indent}    <span className={\`font-normal \${isPrint ? 'text-slate-500' : 'text-slate-400'}\`}>)</span>
${indent}  </>
${indent})}`;

editFile('apps/reportes-ot/components/CatalogTableView.tsx', [
  // Add prop to Props interface
  {
    find: `  onChangeColumnVisibility?: (tableId: string, colKey: string, visible: boolean) => void;`,
    replace: `  onChangeColumnVisibility?: (tableId: string, colKey: string, visible: boolean) => void;
  /** Cambio del input editable en el encabezado de una columna (feature headerEditable) */
  onChangeColumnHeader?: (tableId: string, colKey: string, value: string) => void;`,
  },
  // Destructure from props
  {
    find: `  onChangeHeaderData,
  onChangeColumnVisibility,`,
    replace: `  onChangeHeaderData,
  onChangeColumnVisibility,
  onChangeColumnHeader,`,
  },
  // Place 1: no-groups mode (line ~1564)
  {
    find: `                        <th key={col.key} className={\`\${thClass(colIdx)} \${col.align === 'right' ? '!text-right' : ''}\`}
                          style={{ ...thStyle, ...(col.width ? { width: \`\${col.width}mm\` } : {}) }}>
                          {col.label || null}
                          {col.label && col.unit && <span className={\`font-normal ml-1 \${isPrint ? 'text-slate-300' : 'text-slate-400'}\`}>({col.unit})</span>}
                          {col.label && col.required && !isPrint && <span className="text-red-400 ml-0.5">*</span>}`,
    replace: `                        <th key={col.key} className={\`\${thClass(colIdx)} \${col.align === 'right' ? '!text-right' : ''}\`}
                          style={{ ...thStyle, ...(col.width ? { width: \`\${col.width}mm\` } : {}) }}>
                          {col.label || null}
                          {col.label && col.unit && <span className={\`font-normal ml-1 \${isPrint ? 'text-slate-300' : 'text-slate-400'}\`}>({col.unit})</span>}
                          ${headerInputSnippet('                          ')}
                          {col.label && col.required && !isPrint && <span className="text-red-400 ml-0.5">*</span>}`,
  },
  // Place 2: with-groups, rowSpan=2 non-grouped column (line ~1605)
  {
    find: `                        <th key={col.key} rowSpan={2}
                          className={\`\${thClass(colIdx)} \${col.align === 'right' ? '!text-right' : ''} \${isPrint ? '' : 'border-b border-slate-200'}\`}
                          style={{ ...thStyle, ...(col.width ? { width: \`\${col.width}mm\` } : {}) }}>
                          {col.label || null}
                          {col.label && col.unit && <span className={\`font-normal ml-1 \${isPrint ? 'text-slate-300' : 'text-slate-400'}\`}>({col.unit})</span>}
                          {col.label && col.required && !isPrint && <span className="text-red-400 ml-0.5">*</span>}`,
    replace: `                        <th key={col.key} rowSpan={2}
                          className={\`\${thClass(colIdx)} \${col.align === 'right' ? '!text-right' : ''} \${isPrint ? '' : 'border-b border-slate-200'}\`}
                          style={{ ...thStyle, ...(col.width ? { width: \`\${col.width}mm\` } : {}) }}>
                          {col.label || null}
                          {col.label && col.unit && <span className={\`font-normal ml-1 \${isPrint ? 'text-slate-300' : 'text-slate-400'}\`}>({col.unit})</span>}
                          ${headerInputSnippet('                          ')}
                          {col.label && col.required && !isPrint && <span className="text-red-400 ml-0.5">*</span>}`,
  },
  // Place 3: with-groups, sub-columns (line ~1625)
  {
    find: `                          <th key={col.key}
                            className={\`\${thClass(colIdx)} \${col.align === 'right' ? '!text-right' : ''} \${!isPrint && isLastInGroup && !isLastCol ? 'border-r border-slate-200' : ''}\`}
                            style={{ ...thStyle, ...(col.width ? { width: \`\${col.width}mm\` } : {}) }}>
                            {col.label || null}
                            {col.label && col.unit && <span className={\`font-normal ml-1 \${isPrint ? 'text-slate-300' : 'text-slate-400'}\`}>({col.unit})</span>}
                          </th>`,
    replace: `                          <th key={col.key}
                            className={\`\${thClass(colIdx)} \${col.align === 'right' ? '!text-right' : ''} \${!isPrint && isLastInGroup && !isLastCol ? 'border-r border-slate-200' : ''}\`}
                            style={{ ...thStyle, ...(col.width ? { width: \`\${col.width}mm\` } : {}) }}>
                            {col.label || null}
                            {col.label && col.unit && <span className={\`font-normal ml-1 \${isPrint ? 'text-slate-300' : 'text-slate-400'}\`}>({col.unit})</span>}
                            ${headerInputSnippet('                            ')}
                          </th>`,
  },
]);

console.log('\nAll edits applied successfully.');
