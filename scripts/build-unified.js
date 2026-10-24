import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const studentDist = path.join(rootDir, 'student-app', 'dist');
const managerDist = path.join(rootDir, 'manager-web', 'dist');

console.log('>>> Building Student App...');
execSync('npm run build:student', { stdio: 'inherit', cwd: rootDir });

console.log('>>> Building Manager Web App (base: /manager/)...');
execSync('npx vite build --base=/manager/', { stdio: 'inherit', cwd: path.join(rootDir, 'manager-web') });

console.log('>>> Creating unified dist directory...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Copy student app to root of dist
fs.cpSync(studentDist, distDir, { recursive: true });

// Copy manager app to dist/manager
const managerTarget = path.join(distDir, 'manager');
fs.mkdirSync(managerTarget, { recursive: true });
fs.cpSync(managerDist, managerTarget, { recursive: true });

console.log('>>> Unified build complete:');
console.log('  / -> Student App (from student-app/dist)');
console.log('  /manager -> Manager Web (from manager-web/dist)');
console.log('  /api -> FastAPI Serverless Function (via api/index.py)');
