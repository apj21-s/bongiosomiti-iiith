const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');

// Strip comments and strings
let cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
cleanCss = cleanCss.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');

let depth = 0;
let line = 1;
let col = 1;
let errors = [];

for (let i = 0; i < cleanCss.length; i++) {
  const char = cleanCss[i];
  if (char === '\n') {
    line++;
    col = 1;
  } else {
    col++;
  }

  if (char === '{') {
    depth++;
  } else if (char === '}') {
    depth--;
    if (depth < 0) {
      errors.push(`Extra closing brace '}' at line ${line}, col ${col}`);
      depth = 0;
    }
  }
}

if (depth !== 0) {
  errors.push(`Unclosed braces at end of file! Remaining depth: ${depth}`);
}

console.log('=== CSS VALIDATION REPORT ===');
if (errors.length === 0) {
  console.log('[PASS] CSS curly brace nesting is 100% BALANCED and VALID! Depth: 0');
} else {
  console.error('[FAIL] CSS errors found:');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
