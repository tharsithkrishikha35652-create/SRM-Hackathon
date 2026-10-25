import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const studentDist = path.join(rootDir, 'student-app', 'dist');

console.log('>>> Building unified Student + Manager app...');
execSync('npm run build:student', { stdio: 'inherit', cwd: rootDir });

console.log('>>> Creating deployment dist directory...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

fs.cpSync(studentDist, distDir, { recursive: true });

console.log('>>> Unified build complete:');
console.log('  / -> Unified student/manager app (dashboard selected by login role)');
console.log('  /api -> FastAPI Serverless Function (via api/index.py)');
