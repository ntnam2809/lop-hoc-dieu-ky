import { getApps, initializeApp, type App } from 'firebase-admin/app';
import type { Config } from './config.js';

const APP_NAME = 'lhdk-server';

/** Dùng Application Default Credentials; không đọc file key, không credential cứng. */
export function initFirebase(cfg: Pick<Config, 'firebaseProjectId'>): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  const options: { projectId?: string } = {};
  if (cfg.firebaseProjectId !== undefined) options.projectId = cfg.firebaseProjectId;
  return initializeApp(options, APP_NAME);
}
