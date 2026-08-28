const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const startLine = parseInt(process.argv[3]) || 1;
const endLine = parseInt(process.argv[4]) || 100;

if (!target) {
  console.error("Please specify a target file path relative to the projects directory or absolute path.");
  process.exit(1);
}

const resolvedPath = path.isAbsolute(target) ? target : path.resolve('/Users/charantejaperala/Downloads/Projects', target);

try {
  const content = fs.readFileSync(resolvedPath, 'utf8');
  const lines = content.split('\n');
  console.log(`--- Lines ${startLine} to ${Math.min(endLine, lines.length)} of ${resolvedPath} ---`);
  for (let i = startLine - 1; i < Math.min(endLine, lines.length); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} catch (err) {
  console.error("Error reading file:", err.message);
}
