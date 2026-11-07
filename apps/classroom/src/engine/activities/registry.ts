import type { Activity, ActivityType } from '../types';
import type { ActivityFactory } from './host';
import { choice } from './choice';
import { sentenceBuilder, sequence } from './ordering';
import { storyRecall } from './recall';
import { classification, experiment, prediction } from './science';
import { explore, storyScene } from './story';

/**
 * Bảng đăng ký primitive. Thêm loại hoạt động mới = thêm một factory ở đây
 * (và schema trong tools/schema.ts). Nội dung mới thì KHÔNG cần sửa file này.
 */
const registry = new Map<ActivityType, ActivityFactory<any>>([
  ['story_scene', storyScene],
  ['explore', explore],
  ['object_identification', choice],
  ['character_identification', choice],
  ['action_identification', choice],
  ['word_selection', choice],
  ['comparison', choice],
  ['cause_effect', choice],
  ['sequence', sequence],
  ['sentence_builder', sentenceBuilder],
  ['story_recall', storyRecall],
  ['prediction', prediction],
  ['experiment', experiment],
  ['classification', classification],
]);

export function getFactory(type: Activity['type']): ActivityFactory | undefined {
  return registry.get(type);
}

export function registerActivity(type: ActivityType, factory: ActivityFactory<any>) {
  registry.set(type, factory);
}
