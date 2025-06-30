
// This script runs after `npm install` to copy necessary assets to the public folder.
// It is cross-platform and replaces the failing shell commands.

const fs = require('fs');
const path = require('path');

const CWD = process.cwd();

function copyFile(source, destination) {
  try {
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, destination);
      console.log(`Copied: ${path.basename(source)} -> ${path.relative(CWD, destination)}`);
    } else {
      console.warn(`Warning: Source file not found, skipping copy: ${path.relative(CWD, source)}`);
    }
  } catch (e) {
    console.error(`Error copying ${path.basename(source)}: ${e.message}`);
  }
}

function copyDir(source, destination) {
  try {
    if (!fs.existsSync(source)) {
      console.warn(`Warning: Source directory not found, skipping copy: ${path.relative(CWD, source)}`);
      return;
    }
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }
    fs.cpSync(source, destination, { recursive: true });
    console.log(`Copied directory: ${path.relative(CWD, source)} -> ${path.relative(CWD, destination)}`);
  } catch(e) {
    console.error(`Error copying directory ${source}: ${e.message}`);
  }
}

console.log('Running post-install script...');

// Copy ffmpeg assets
copyDir(
  path.join(CWD, 'node_modules', '@ffmpeg', 'core', 'dist'),
  path.join(CWD, 'public', 'ffmpeg')
);

// Copy jeep-sqlite wasm - THIS IS THE CRITICAL FIX
copyFile(
  path.join(CWD, 'node_modules', 'jeep-sqlite', 'dist', 'jeep-sqlite', 'sql-wasm.wasm'),
  path.join(CWD, 'public', 'assets', 'sql-wasm.wasm')
);

console.log('Post-install script finished.');
