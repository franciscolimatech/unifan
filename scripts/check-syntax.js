'use strict';

const { readdirSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const roots = ['api', 'lib', 'public/scripts'];

function listarJs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listarJs(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

let falhou = false;

for (const arquivo of roots.flatMap(listarJs)) {
  const resultado = spawnSync(process.execPath, ['--check', arquivo], {
    stdio: 'inherit',
  });

  if (resultado.status !== 0) {
    falhou = true;
  }
}

process.exit(falhou ? 1 : 0);
