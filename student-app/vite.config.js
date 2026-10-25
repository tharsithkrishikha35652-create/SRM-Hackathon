import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(appDirectory, '..');
const backendDirectory = path.join(repositoryRoot, 'backend');

function findPython() {
  if (process.env.MESSMATE_PYTHON) return process.env.MESSMATE_PYTHON;

  const candidates = [
    path.join(repositoryRoot, '.venv', 'Scripts', 'python.exe'),
    path.join(backendDirectory, '.venv', 'Scripts', 'python.exe'),
    path.join(repositoryRoot, '.venv', 'bin', 'python'),
    path.join(backendDirectory, '.venv', 'bin', 'python'),
  ];
  return candidates.find(candidate => existsSync(candidate)) || (process.platform === 'win32' ? 'python' : 'python3');
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const { port } = listener.address();
      listener.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function launchBackend() {
  const port = await getAvailablePort();
  const python = findPython();
  const child = spawn(python, [
    '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port),
  ], {
    cwd: backendDirectory,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let output = '';
  const appendOutput = chunk => { output = `${output}${chunk}`.slice(-6000); };
  child.stdout.on('data', appendOutput);
  child.stderr.on('data', appendOutput);

  const stopBackend = () => {
    if (child.exitCode === null && !child.killed) child.kill();
  };
  const stopOnInterrupt = () => stopBackend();
  process.on('exit', stopBackend);
  process.on('SIGINT', stopOnInterrupt);
  process.on('SIGTERM', stopOnInterrupt);

  let server;
  try {
    const startupDeadline = Date.now() + 30000;
    while (Date.now() < startupDeadline) {
      if (child.exitCode !== null) {
        throw new Error(`The API process exited with code ${child.exitCode}.\n${output}`);
      }
      try {
        const response = await fetch(`http://127.0.0.1:${port}/docs`);
        if (response.ok) {
          console.log(`MessMate API ready on an internal port; use http://localhost:5174.`);
          return {
            target: `http://127.0.0.1:${port}`,
            stop() {
              stopBackend();
              process.off('exit', stopBackend);
              process.off('SIGINT', stopOnInterrupt);
              process.off('SIGTERM', stopOnInterrupt);
            },
          };
        }
      } catch {
        // Uvicorn may still be starting; retry until it responds or exits.
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`The API did not become ready within 30 seconds.\n${output}`);
  } catch (error) {
    stopBackend();
    process.off('exit', stopBackend);
    process.off('SIGINT', stopOnInterrupt);
    process.off('SIGTERM', stopOnInterrupt);
    throw new Error(`Could not start the MessMate API using "${python}". Check backend/requirements.txt and the Python environment.\n${error.message}`);
  }
}

export default defineConfig(async ({ command }) => {
  const backend = command === 'serve' ? await launchBackend() : null;
  return {
    plugins: [
      react(),
      ...(backend ? [{
        name: 'messmate-managed-api',
        configureServer(server) {
          server.httpServer?.once('close', backend.stop);
        },
      }] : []),
    ],
    server: backend ? {
      proxy: { '/api': { target: backend.target, changeOrigin: true } },
    } : undefined,
  };
});
