/**
 * Tạo khung một bài học mới (status "draft") — điểm khởi đầu cho người soạn
 * hoặc cho Claude điền nội dung theo docs/content-factory.md.
 *
 *   npm run scaffold -- <lessonId> --domain science --topic plants --title "Cây cần gì để lớn?"
 *
 * Khung sinh ra luôn qua được validate (có phông nền tạm) để chạy thử ngay.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const [id, ...rest] = process.argv.slice(2);
const opt = (k: string) => {
  const i = rest.indexOf(`--${k}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const domain = opt('domain');
const topic = opt('topic');
const title = opt('title') ?? id;
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id) || !domain || !topic) {
  console.error('Cách dùng: npm run scaffold -- <lesson-id> --domain <domainId> --topic <topicId> [--title "Tên bài"]');
  process.exit(1);
}
const dir = join(root, 'lessons', id);
if (existsSync(dir)) {
  console.error(`✗ Đã có thư mục ${dir}`);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
if (!catalog.domains.some((d: { id: string }) => d.id === domain)) {
  console.error(`✗ Không có khu vực "${domain}" trong content/catalog.json`);
  process.exit(1);
}
if (!catalog.topics.some((t: { id: string }) => t.id === topic)) {
  catalog.topics.push({
    id: topic, domainId: domain, name: topic, description: 'TODO: mô tả chủ đề', learningObjectives: [],
    order: catalog.topics.length + 1, contentVersion: '0.1.0', status: 'draft',
  });
  writeFileSync(join(root, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(`+ Thêm chủ đề "${topic}" (draft) vào catalog.json`);
}

const slug = topic.replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'topic';
const bgId = `${domain}_${slug}_background_placeholder_v01`;
mkdirSync(join(dir, 'assets'), { recursive: true });
writeFileSync(join(dir, 'assets', `${bgId}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CDEEFF"/><stop offset="1" stop-color="#FFF4D6"/></linearGradient></defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <path d="M0 640 C 400 580 1200 600 1600 640 L 1600 900 L 0 900 Z" fill="#A8DC84"/>
  <text x="800" y="460" text-anchor="middle" font-family="sans-serif" font-size="48" fill="#7A6355" opacity=".5">Phông nền tạm — thay bằng ảnh theo art bible</text>
</svg>
`);
writeFileSync(join(dir, 'assets.json'), JSON.stringify({
  assets: [{
    id: bgId, type: 'background', file: `assets/${bgId}.svg`, version: 'v01', status: 'placeholder',
    promptId: bgId.replace('_v01', ''), prompt: 'TODO: mô tả phông nền 16:9 theo art bible (docs/art-bible.md)',
  }],
}, null, 2) + '\n');

const lesson = {
  lesson: {
    id, domainId: domain, topicId: topic, title, subtitle: 'TODO',
    estimatedMinutes: 7, targetAge: 5, order: 99,
    learningObjectives: [{ id: 'o-1', text: 'TODO: mục tiêu học tập' }],
    teacherGuide: {
      overview: 'TODO: tóm tắt bài cho giáo viên',
      materials: [], preparation: [],
      expectedObservations: ['TODO'], extensionQuestions: ['TODO'], followUp: [],
    },
    review: { generatedBy: 'scaffold', notes: '' },
    contentVersion: '0.1.0', status: 'draft',
  },
  scenarios: [{
    id: `${id}-main`, title,
    scenes: [{ id: 'scene-1', background: bgId, ambient: ['pollen'], entities: [] }],
    activities: [{
      id: 's1-intro', type: 'story_scene', sceneId: 'scene-1', instruction: 'Cùng xem nhé!',
      timeline: [{ do: 'say', text: 'TODO: lời dẫn mở đầu.' }],
      teacherPrompts: ['TODO: câu hỏi gợi ý'], learningObjectives: ['o-1'],
    }],
  }],
};
writeFileSync(join(dir, 'lesson.json'), JSON.stringify(lesson, null, 2) + '\n');
console.log(`✓ Tạo ${dir}\n  Tiếp theo: điền nội dung → npm run validate → npm run dev (xem tại #/lesson/${id})`);
