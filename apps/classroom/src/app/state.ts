import type { Catalog, LessonBundle } from '../engine/types';
import { getContentSource } from '../engine/content/source';
import type { Session } from '../engine/runtime/session';
import { sound } from '../engine/fx/audio';
import { narrator } from '../engine/fx/speech';

export interface Settings {
  sound: boolean;
  narration: boolean;
  music: boolean;
  autoAdvance: boolean;
}

const KEY = 'lhdk.settings.v1';
const defaults: Settings = { sound: true, narration: true, music: false, autoAdvance: false };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export const settings: Settings = load();

export function applySettings() {
  sound.enabled = settings.sound;
  narrator.enabled = settings.narration;
  sound.setMusic(settings.music);
}

export function saveSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* chế độ riêng tư: bỏ qua */
  }
  applySettings();
}

let catalogPromise: Promise<Catalog> | null = null;
export function catalog(): Promise<Catalog> {
  catalogPromise ??= getContentSource().then((s) => s.loadCatalog());
  catalogPromise.catch(() => (catalogPromise = null));
  return catalogPromise;
}

const bundles = new Map<string, Promise<LessonBundle>>();
export function lessonBundle(id: string): Promise<LessonBundle> {
  let p = bundles.get(id);
  if (!p) {
    p = getContentSource().then((s) => s.loadLesson(id));
    p.catch(() => bundles.delete(id));
    bundles.set(id, p);
  }
  return p;
}

/** Kết quả buổi học gần nhất — dùng cho màn tổng kết. */
export let lastRun: { lessonId: string; session: Session } | null = null;
export function setLastRun(r: typeof lastRun) {
  lastRun = r;
}
