// Aplica las migraciones sobre la base de test antes de correr la suite.
import { execSync } from 'node:child_process';
import path from 'node:path';

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) return;
  const dbDir = path.resolve(__dirname, '../../../packages/db');
  execSync('pnpm exec prisma migrate deploy', {
    cwd: dbDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
