/**
 * Schema máy-đọc-được của gói nội dung (zod). Dùng cho tools/validate.ts,
 * pipeline xuất bản và làm "hợp đồng" khi AI sinh nội dung mới.
 * Đồng bộ với src/engine/types.ts.
 */
import { z } from 'zod';
import {
  AMBIENT_FX, ANIM_PRESETS, EMOTES, FX_KINDS, SOUND_NAMES,
} from '../src/engine/types';

const id = z.string().regex(/^[a-z0-9][a-z0-9-_]*$/i, 'id chỉ gồm chữ, số, - và _');
const semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'contentVersion phải dạng 1.0.0');
const status = z.enum(['draft', 'review', 'approved', 'published', 'archived']);
const param = z.string().regex(/^\$\w+$/);
const coord = z.union([z.number(), param]);
const point = z.object({ x: coord, y: coord }).strict();
const anim = z.enum(ANIM_PRESETS as [string, ...string[]]);
const emote = z.enum(EMOTES as [string, ...string[]]);
const ease = z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'backOut', 'backIn', 'bounceOut', 'elasticOut', 'sink', 'float']);

export const visualSchema = z.object({
  bg: z.string().optional(),
  layers: z.array(z.object({
    asset: z.string(),
    x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(),
    flip: z.boolean().optional(), rotate: z.number().optional(), anim: anim.optional(), emote: emote.optional(),
  }).strict()).min(1),
}).strict();

const entityObject = z.object({
  id,
  asset: z.string().optional(),
  x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(),
  z: z.number().optional(), flip: z.boolean().optional(), rotate: z.number().optional(), scale: z.number().positive().optional(),
  anim: anim.optional(), hidden: z.boolean().optional(), label: z.string().optional(),
  zone: z.boolean().optional(), decor: z.boolean().optional(),
}).strict();
export const entitySchema = entityObject.refine((e) => e.zone || e.asset, { message: 'entity cần asset (hoặc là zone)' });

const area = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).strict();
export const sceneSchema = z.object({
  id,
  background: z.string(),
  backdrop: z.string().optional(),
  ambient: z.array(z.union([
    z.enum(AMBIENT_FX as [string, ...string[]]),
    z.object({ fx: z.enum(AMBIENT_FX as [string, ...string[]]), area: area.optional(), density: z.number().positive().optional() }).strict(),
  ])).optional(),
  entities: z.array(entitySchema),
}).strict();

const target = z.string();
export const stepSchema: z.ZodType = z.lazy(() => z.discriminatedUnion('do', [
  z.object({ do: z.literal('move'), target, to: z.union([point, z.string()]), duration: z.number().optional(), ease: ease.optional(), arc: z.number().optional(), offset: point.optional() }).strict(),
  z.object({ do: z.literal('show'), target, effect: z.enum(['pop', 'fade', 'grow']).optional() }).strict(),
  z.object({ do: z.literal('hide'), target, effect: z.enum(['pop', 'fade', 'shrink']).optional() }).strict(),
  z.object({ do: z.literal('anim'), target, preset: anim }).strict(),
  z.object({ do: z.literal('emote'), target, emote, duration: z.number().optional() }).strict(),
  z.object({ do: z.literal('fx'), fx: z.enum(FX_KINDS as [string, ...string[]]), at: z.union([point, z.string()]), size: z.number().optional(), offset: point.optional() }).strict(),
  z.object({ do: z.literal('say'), text: z.string().min(1), target: target.optional(), hold: z.number().optional() }).strict(),
  z.object({ do: z.literal('wait'), ms: z.number().nonnegative() }).strict(),
  z.object({ do: z.literal('sound'), sound: z.enum(SOUND_NAMES as [string, ...string[]]) }).strict(),
  z.object({ do: z.literal('flip'), target, value: z.boolean() }).strict(),
  z.object({ do: z.literal('scale'), target, to: z.number(), duration: z.number().optional(), ease: ease.optional() }).strict(),
  z.object({ do: z.literal('rotate'), target, to: z.number(), duration: z.number().optional(), ease: ease.optional() }).strict(),
  z.object({ do: z.literal('camera'), zoom: z.number().min(1).max(3), focus: z.union([point, z.string()]).optional(), duration: z.number().optional(), ease: ease.optional() }).strict(),
  z.object({ do: z.literal('parallel'), steps: z.array(stepSchema) }).strict(),
  z.object({ do: z.literal('play'), timeline: z.string(), args: z.record(z.string(), z.union([z.string(), z.number()])).optional() }).strict(),
]));
const timeline = z.array(stepSchema);

const option = z.object({ id, label: z.string().min(1), entity: z.string().optional(), visual: visualSchema.optional() }).strict();
const orderCard = z.object({ id, label: z.string().min(1), visual: visualSchema }).strict();

const base = {
  id,
  scenarioId: z.string().optional(),
  order: z.number().optional(),
  sceneId: z.string(),
  instruction: z.string().min(1),
  sceneOverrides: z.record(z.string(), entityObject.partial().omit({ id: true })).optional(),
  intro: timeline.optional(),
  outro: timeline.optional(),
  teacherPrompts: z.array(z.string().min(1)),
  learningObjectives: z.array(z.string()),
  observation: z.string().optional(),
  icon: z.string().optional(),
};

const choiceTypes = ['object_identification', 'character_identification', 'action_identification', 'word_selection', 'comparison', 'cause_effect'] as const;

export const activitySchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('story_scene'), timeline }).strict(),
  z.object({ ...base, type: z.literal('explore'), targets: z.array(z.string()).min(1) }).strict(),
  ...choiceTypes.map((t) => z.object({
    ...base, type: z.literal(t), presentation: z.enum(['scene', 'cards']), options: z.array(option).min(2).max(4),
    correctAnswer: z.string(), praise: z.string().optional(),
  }).strict()),
  z.object({ ...base, type: z.literal('sequence'), cards: z.array(orderCard).min(2).max(5), correctOrder: z.array(z.string()) }).strict(),
  z.object({ ...base, type: z.literal('sentence_builder'), blocks: z.array(orderCard).min(2).max(5), correctOrder: z.array(z.string()), sentence: z.string().min(1) }).strict(),
  z.object({ ...base, type: z.literal('story_recall'), frames: z.array(orderCard.extend({ prompt: z.string().min(1) }).strict()).min(2).max(6) }).strict(),
  z.object({ ...base, type: z.literal('prediction'), subject: z.string(), options: z.array(option).min(2).max(4), predictionKey: z.string() }).strict(),
  z.object({
    ...base, type: z.literal('experiment'), outcomes: z.array(option).min(2),
    subjects: z.array(z.object({ entity: z.string(), label: z.string(), result: z.string(), predictionKey: z.string().optional(), timeline }).strict()).min(1).max(6),
  }).strict(),
  z.object({
    ...base, type: z.literal('classification'), mode: z.enum(['check', 'predict']), categories: z.array(option).min(2).max(3),
    items: z.array(z.object({ id, label: z.string(), visual: visualSchema, category: z.string(), predictionKey: z.string().optional() }).strict()).min(2).max(8),
  }).strict(),
]);

const objective = z.object({ id, text: z.string().min(1) }).strict();

export const lessonSchema = z.object({
  id, domainId: z.string(), topicId: z.string(),
  title: z.string().min(1), subtitle: z.string().optional(),
  estimatedMinutes: z.number().int().min(3).max(30),
  targetAge: z.number().int().min(3).max(7),
  order: z.number(),
  learningObjectives: z.array(objective).min(1),
  teacherGuide: z.object({
    overview: z.string().min(1),
    materials: z.array(z.string()),
    preparation: z.array(z.string()),
    expectedObservations: z.array(z.string()).min(1),
    extensionQuestions: z.array(z.string()).min(1),
    followUp: z.array(z.string()),
  }).strict(),
  scenarioIds: z.array(z.string()).optional(),
  cover: visualSchema.optional(),
  review: z.object({ reviewedBy: z.string().optional(), reviewedAt: z.string().optional(), notes: z.string().optional(), generatedBy: z.string().optional() }).strict().optional(),
  contentVersion: semver,
  status,
}).strict();

export const packageSchema = z.object({
  lesson: lessonSchema,
  scenarios: z.array(z.object({
    id, title: z.string(),
    scenes: z.array(sceneSchema).min(1),
    timelines: z.record(z.string(), timeline).optional(),
    activities: z.array(activitySchema).min(1),
  }).strict()).min(1),
}).strict();

export const assetManifestSchema = z.object({
  assets: z.array(z.object({
    id: z.string().regex(/^[a-z]+_[a-z0-9-]+_(character|object|background|icon|overlay|audio)_[a-z0-9-]+_v\d{2}$/, 'tên asset theo {domain}_{topic}_{type}_{name}_{vNN}'),
    type: z.enum(['character', 'object', 'background', 'icon', 'overlay', 'audio']),
    file: z.string().optional(),
    src: z.string().optional(),
    promptId: z.string().optional(),
    prompt: z.string().optional(),
    status: z.enum(['placeholder', 'generated', 'approved']),
    version: z.string().regex(/^v\d{2}$/),
  }).strict()),
}).strict();

export const catalogSchema = z.object({
  domains: z.array(z.object({
    id, name: z.string(), title: z.string(), description: z.string(),
    ageRange: z.object({ min: z.number(), max: z.number() }).strict(),
    order: z.number(),
    theme: z.object({ primary: z.string(), accent: z.string(), soft: z.string() }).strict(),
    cover: visualSchema.optional(),
    learningLoop: z.array(z.string()).optional(),
    contentVersion: semver, status,
  }).strict()),
  topics: z.array(z.object({
    id, domainId: z.string(), name: z.string(), description: z.string(),
    learningObjectives: z.array(z.string()), order: z.number(), contentVersion: semver, status,
  }).strict()),
}).strict();
