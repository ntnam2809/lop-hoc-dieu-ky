/**
 * Mô hình nội dung (content model) — nguồn sự thật về kiểu dữ liệu cho engine,
 * tool kiểm tra (tools/validate.ts) và pipeline xuất bản.
 *
 * Engine KHÔNG biết bài học cụ thể nào: mọi kịch bản, cảnh, hoạt động, lời
 * thoại, đáp án đều nằm trong gói nội dung (content/lessons/<id>/).
 */

export type ContentStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived';

export interface Versioned {
  contentVersion: string;
  status: ContentStatus;
}

export interface ReviewInfo {
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  generatedBy?: string;
}

/* ───────────────────────── Catalog ───────────────────────── */

export interface Domain extends Versioned {
  id: string;
  name: string;
  /** Tên sản phẩm của mảng — ví dụ "Khu Rừng Kể Chuyện". */
  title: string;
  description: string;
  ageRange: { min: number; max: number };
  order: number;
  theme: DomainTheme;
  /** Minh hoạ động cho thẻ mảng ở màn hình chính. */
  cover?: Visual;
  /** Vòng học cốt lõi, hiển thị cho giáo viên. */
  learningLoop?: string[];
}

export interface DomainTheme {
  /** Màu chủ đạo (hex). */
  primary: string;
  /** Màu nhấn (hex). */
  accent: string;
  /** Màu nền nhạt (hex). */
  soft: string;
}

export interface Topic extends Versioned {
  id: string;
  domainId: string;
  name: string;
  description: string;
  learningObjectives: string[];
  order: number;
}

/* ───────────────────────── Lesson ───────────────────────── */

export interface Objective {
  id: string;
  text: string;
}

export interface TeacherGuide {
  overview: string;
  materials: string[];
  preparation: string[];
  expectedObservations: string[];
  extensionQuestions: string[];
  /** Gợi ý mở rộng sau giờ học — hiển thị ở màn tổng kết. */
  followUp: string[];
}

export interface Lesson extends Versioned {
  id: string;
  domainId: string;
  topicId: string;
  title: string;
  subtitle?: string;
  estimatedMinutes: number;
  targetAge: number;
  learningObjectives: Objective[];
  teacherGuide: TeacherGuide;
  scenarioIds: string[];
  cover?: Visual;
  review?: ReviewInfo;
  order: number;
}

/* ───────────────────────── Scene ───────────────────────── */

export const STAGE_W = 1600;
export const STAGE_H = 900;

export type AnimPreset =
  | 'none' | 'idle' | 'hop' | 'walk' | 'run' | 'sleep' | 'cry' | 'cheer'
  | 'wiggle' | 'bob' | 'sway' | 'spin' | 'pulse' | 'shake' | 'think' | 'peek';

export const ANIM_PRESETS: AnimPreset[] = [
  'none', 'idle', 'hop', 'walk', 'run', 'sleep', 'cry', 'cheer',
  'wiggle', 'bob', 'sway', 'spin', 'pulse', 'shake', 'think', 'peek',
];

export type Emote = 'heart' | 'question' | 'exclaim' | 'tear' | 'zzz' | 'sparkle' | 'music' | 'idea';
export const EMOTES: Emote[] = ['heart', 'question', 'exclaim', 'tear', 'zzz', 'sparkle', 'music', 'idea'];

export type AmbientFx = 'pollen' | 'leaves' | 'fireflies' | 'butterflies' | 'motes' | 'bubbles';
export const AMBIENT_FX: AmbientFx[] = ['pollen', 'leaves', 'fireflies', 'butterflies', 'motes', 'bubbles'];

export interface Entity {
  id: string;
  /** Asset id; bỏ trống khi là `zone` (vùng chạm vô hình trên nền). */
  asset?: string;
  /** Tâm của hộp, theo hệ toạ độ sân khấu 1600×900. */
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  flip?: boolean;
  rotate?: number;
  scale?: number;
  anim?: AnimPreset;
  hidden?: boolean;
  /** Tên gọi đọc to cho trẻ khi chạm (từ vựng). */
  label?: string;
  /** Vùng chạm vô hình trên ảnh nền. */
  zone?: boolean;
  /** Vật trang trí: không nhận chạm (ví dụ mặt kính bể nước). */
  decor?: boolean;
}

export interface AmbientSpec {
  fx: AmbientFx;
  /** Vùng xuất hiện (mặc định cả sân khấu). */
  area?: { x: number; y: number; w: number; h: number };
  /** Hệ số mật độ, mặc định 1. */
  density?: number;
}

export interface Scene {
  id: string;
  background: string;
  /** Nền dự phòng/tô màu dưới ảnh nền (CSS color hoặc gradient). */
  backdrop?: string;
  ambient?: Array<AmbientFx | AmbientSpec>;
  entities: Entity[];
}

export type EntityOverride = Partial<Omit<Entity, 'id'>>;

/* ───────────────────────── Visual (thẻ, minh hoạ nhỏ) ───────────────────────── */

export interface VisualLayer {
  asset: string;
  /** Toạ độ tâm trong khung 400×300 của thẻ. */
  x: number;
  y: number;
  w: number;
  h: number;
  flip?: boolean;
  rotate?: number;
  anim?: AnimPreset;
  emote?: Emote;
}

export interface Visual {
  /** Màu/gradient nền thẻ. */
  bg?: string;
  layers: VisualLayer[];
}

/* ───────────────────────── Timeline DSL ───────────────────────── */

export type Point = { x: number; y: number };
export type Target = string; // entity id hoặc "$tham_số" trong template

export type Ease =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'backOut' | 'backIn'
  | 'bounceOut' | 'elasticOut' | 'sink' | 'float';

export type FxKind = 'splash' | 'ripple' | 'bubbles' | 'sparkle' | 'confetti' | 'leaves' | 'dust' | 'stars' | 'hearts' | 'tears';
export const FX_KINDS: FxKind[] = ['splash', 'ripple', 'bubbles', 'sparkle', 'confetti', 'leaves', 'dust', 'stars', 'hearts', 'tears'];

export type SoundName =
  | 'tap' | 'pop' | 'pickup' | 'drop' | 'correct' | 'retry' | 'splash' | 'plunk'
  | 'bubble' | 'whoosh' | 'sparkle' | 'hop' | 'fanfare' | 'thud' | 'page' | 'chime';
export const SOUND_NAMES: SoundName[] = [
  'tap', 'pop', 'pickup', 'drop', 'correct', 'retry', 'splash', 'plunk',
  'bubble', 'whoosh', 'sparkle', 'hop', 'fanfare', 'thud', 'page', 'chime',
];

/** Tham chiếu tham số timeline mẫu, vd `$delay`; được thay bằng số khi chạy. */
export type Param = `$${string}`;

export type Step =
  | { do: 'move'; target: Target; to: Point | Target; duration?: number; ease?: Ease; arc?: number; offset?: Point }
  | { do: 'show'; target: Target; effect?: 'pop' | 'fade' | 'grow' }
  | { do: 'hide'; target: Target; effect?: 'pop' | 'fade' | 'shrink' }
  | { do: 'anim'; target: Target; preset: AnimPreset }
  | { do: 'emote'; target: Target; emote: Emote; duration?: number }
  | { do: 'fx'; fx: FxKind; at: Point | Target; size?: number; offset?: Point }
  | { do: 'say'; text: string; target?: Target; hold?: number }
  | { do: 'wait'; ms: number | Param }
  | { do: 'sound'; sound: SoundName }
  | { do: 'flip'; target: Target; value: boolean }
  | { do: 'scale'; target: Target; to: number | Param; duration?: number; ease?: Ease }
  | { do: 'rotate'; target: Target; to: number | Param; duration?: number; ease?: Ease }
  | { do: 'camera'; zoom: number; focus?: Point | Target; duration?: number; ease?: Ease }
  | { do: 'parallel'; steps: Step[] }
  | { do: 'play'; timeline: string; args?: TemplateArgs };

/** Tham số timeline mẫu: chuỗi (id nhân vật, câu chữ) hoặc số (toạ độ). */
export type TemplateArgs = Record<string, string | number>;

export type StepKind = Step['do'];
export const STEP_KINDS: StepKind[] = [
  'move', 'show', 'hide', 'anim', 'emote', 'fx', 'say', 'wait', 'sound', 'flip',
  'scale', 'rotate', 'camera', 'parallel', 'play',
];

export type Timeline = Step[];

/* ───────────────────────── Activities ───────────────────────── */

export const ACTIVITY_TYPES = [
  // Trình bày / quan sát
  'story_scene',
  'explore',
  // Ngôn ngữ
  'object_identification',
  'character_identification',
  'action_identification',
  'word_selection',
  'sequence',
  'sentence_builder',
  'story_recall',
  // Khoa học
  'prediction',
  'experiment',
  'classification',
  'comparison',
  'cause_effect',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Các loại dùng chung primitive "chọn đáp án". */
export const CHOICE_TYPES: ActivityType[] = [
  'object_identification', 'character_identification', 'action_identification',
  'word_selection', 'comparison', 'cause_effect',
];

interface ActivityBase {
  id: string;
  scenarioId: string;
  order: number;
  sceneId: string;
  /** Câu ngắn đọc to cho trẻ (≤ 8 từ). */
  instruction: string;
  /** Thay đổi trạng thái cảnh so với cảnh gốc khi vào hoạt động. */
  sceneOverrides?: Record<string, EntityOverride>;
  /** Timeline chạy trước khi trẻ tương tác. */
  intro?: Timeline;
  /** Timeline chạy khi hoàn thành. */
  outro?: Timeline;
  teacherPrompts: string[];
  learningObjectives: string[];
  /** Ghi chú quan sát/đánh giá cho giáo viên. */
  observation?: string;
  /** Biểu tượng nhỏ trên thanh tiến trình. */
  icon?: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  /** Lựa chọn nằm trong cảnh (chạm trực tiếp vào nhân vật/vật/vùng). */
  entity?: string;
  /** Lựa chọn hiển thị dạng thẻ. */
  visual?: Visual;
}

export interface StorySceneActivity extends ActivityBase {
  type: 'story_scene';
  timeline: Timeline;
}

export interface ExploreActivity extends ActivityBase {
  type: 'explore';
  targets: string[];
}

export interface ChoiceActivity extends ActivityBase {
  type: 'object_identification' | 'character_identification' | 'action_identification'
    | 'word_selection' | 'comparison' | 'cause_effect';
  presentation: 'scene' | 'cards';
  options: ChoiceOption[];
  correctAnswer: string;
  /** Câu khen khi đúng (đọc to). */
  praise?: string;
}

export interface OrderCard {
  id: string;
  label: string;
  visual: Visual;
}

export interface SequenceActivity extends ActivityBase {
  type: 'sequence';
  cards: OrderCard[];
  correctOrder: string[];
}

export interface SentenceActivity extends ActivityBase {
  type: 'sentence_builder';
  blocks: OrderCard[];
  correctOrder: string[];
  /** Câu hoàn chỉnh đọc to khi ghép xong. */
  sentence: string;
}

export interface RecallFrame extends OrderCard {
  prompt: string;
}

export interface StoryRecallActivity extends ActivityBase {
  type: 'story_recall';
  frames: RecallFrame[];
}

export interface PredictionActivity extends ActivityBase {
  type: 'prediction';
  subject: string;
  options: ChoiceOption[];
  predictionKey: string;
}

export interface ExperimentSubject {
  entity: string;
  label: string;
  /** id phương án kết quả (khớp options của prediction). */
  result: string;
  predictionKey?: string;
  timeline: Timeline;
}

export interface ExperimentActivity extends ActivityBase {
  type: 'experiment';
  /** Danh mục kết quả để hiển thị huy hiệu (ví dụ nổi / chìm). */
  outcomes: ChoiceOption[];
  subjects: ExperimentSubject[];
}

export interface ClassItem {
  id: string;
  label: string;
  visual: Visual;
  category: string;
  predictionKey?: string;
}

export interface ClassificationActivity extends ActivityBase {
  type: 'classification';
  /** "check": sai thì bật lại; "predict": nhận mọi lựa chọn và ghi lại dự đoán. */
  mode: 'check' | 'predict';
  categories: ChoiceOption[];
  items: ClassItem[];
}

export type Activity =
  | StorySceneActivity
  | ExploreActivity
  | ChoiceActivity
  | SequenceActivity
  | SentenceActivity
  | StoryRecallActivity
  | PredictionActivity
  | ExperimentActivity
  | ClassificationActivity;

/* ───────────────────────── Scenario & bundle ───────────────────────── */

export interface Scenario {
  id: string;
  lessonId: string;
  title: string;
  scenes: Scene[];
  /** Timeline mẫu tái sử dụng — gọi bằng { do: "play", timeline, args }. */
  timelines?: Record<string, Timeline>;
  activityIds: string[];
}

export type AssetType = 'character' | 'object' | 'background' | 'icon' | 'overlay' | 'audio';

export interface AssetRef {
  id: string;
  type: AssetType;
  /** Đường dẫn file trong gói (local) — publish sẽ đổi thành URL Storage. */
  file?: string;
  /** URL đã phân giải tại runtime. */
  src?: string;
  promptId?: string;
  /** Prompt GPT Image (theo art bible). */
  prompt?: string;
  /** placeholder: bản vector tạm · generated: ảnh AI chưa duyệt · approved: đã duyệt. */
  status: 'placeholder' | 'generated' | 'approved';
  version: string;
}

export interface LessonBundle {
  lesson: Lesson;
  scenarios: Scenario[];
  activities: Activity[];
  assets: Record<string, AssetRef>;
}

export interface Catalog {
  domains: Domain[];
  topics: Topic[];
  lessons: Lesson[];
}
