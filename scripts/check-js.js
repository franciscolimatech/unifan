'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const roots = ['api', 'lib', path.join('public', 'scripts')];

function collectJavaScriptFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJavaScriptFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = roots.flatMap((root) => collectJavaScriptFiles(root)).sort();

if (!files.length) {
  console.log('[check-js] Nenhum arquivo JavaScript encontrado.');
  process.exit(0);
}

let hasFailure = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log(`[check-js] ${files.length} arquivo(s) JavaScript validado(s).`);
