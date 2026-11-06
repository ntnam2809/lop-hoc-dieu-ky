import type { Emote } from '../engine/types';

/** Bộ icon giao diện (không phải nội dung bài học) — SVG nét tròn, đồng bộ. */
const wrap = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  play: wrap('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  pause: wrap('<rect x="6" y="4.5" width="4" height="15" rx="1.5" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1.5" fill="currentColor"/>'),
  next: wrap('<path d="M9 5l7 7-7 7"/>'),
  prev: wrap('<path d="M15 5l-7 7 7 7"/>'),
  skip: wrap('<path d="M5 5l7 7-7 7M13 5l7 7-7 7"/>'),
  replay: wrap('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/>'),
  prompt: wrap('<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M8 10h8M8 13.5h5"/>'),
  close: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  home: wrap('<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>'),
  back: wrap('<path d="M11 5l-7 7 7 7M4 12h16"/>'),
  speaker: wrap('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  sound: wrap('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/>'),
  music: wrap('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor"/>'),
  voice: wrap('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
  fullscreen: wrap('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  settings: wrap('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  clock: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  target: wrap('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  box: wrap('<path d="M3.5 8L12 4l8.5 4v8L12 20l-8.5-4z"/><path d="M3.5 8L12 12l8.5-4M12 12v8"/>'),
  eye: wrap('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  bulb: wrap('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  check: wrap('<path d="M5 12.5l4.5 4.5L19 7.5"/>', '0 0 24 24'),
  star: wrap('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z" fill="currentColor"/>'),
  list: wrap('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>'),
  hand: wrap('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 6.5-6 6.5-2.5 0-4-1.2-5.2-3L4 14.3a1.5 1.5 0 0 1 2.4-1.8L8 14"/>'),
};

/** Icon nhỏ theo loại hoạt động — hiển thị trên thanh tiến trình và màn chuẩn bị. */
export const activityIcon: Record<string, string> = {
  story_scene: wrap('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>', '0 0 24 25'),
  explore: icons.eye,
  object_identification: icons.hand,
  character_identification: wrap('<circle cx="12" cy="9" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>'),
  action_identification: wrap('<circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v4M6 11l4-3h4l3 4M11 15l-1-7"/>'),
  word_selection: wrap('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 15l3-4 2.5 3 2-2L18 15"/><circle cx="9" cy="8.5" r="1.2" fill="currentColor"/>'),
  sequence: wrap('<rect x="2.5" y="7" width="5" height="10" rx="1.5"/><rect x="9.5" y="7" width="5" height="10" rx="1.5"/><rect x="16.5" y="7" width="5" height="10" rx="1.5"/>'),
  sentence_builder: wrap('<rect x="2.5" y="8" width="7" height="8" rx="2"/><rect x="11" y="8" width="4.5" height="8" rx="2"/><rect x="17" y="8" width="4.5" height="8" rx="2"/>'),
  story_recall: icons.voice,
  prediction: wrap('<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><circle cx="12" cy="17.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="9"/>'),
  experiment: wrap('<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>'),
  classification: wrap('<path d="M3 13h7v7H3zM14 13h7v7h-7z"/><path d="M6.5 9V4M17.5 9V4M4.5 6.5l2-2.5 2 2.5M15.5 6.5l2-2.5 2 2.5"/>'),
  comparison: wrap('<path d="M12 4v16M5 20h14M4 9l3-5 3 5a3 3 0 0 1-6 0zM14 9l3-5 3 5a3 3 0 0 1-6 0z"/>'),
  cause_effect: wrap('<circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9.5 12h5M12.5 9.5l2.5 2.5-2.5 2.5"/>'),
};

export const activityTypeName: Record<string, string> = {
  story_scene: 'Xem truyện',
  explore: 'Quan sát',
  object_identification: 'Tìm đồ vật',
  character_identification: 'Tìm nhân vật',
  action_identification: 'Nhận biết hành động',
  word_selection: 'Chọn từ',
  sequence: 'Sắp xếp thứ tự',
  sentence_builder: 'Ghép câu',
  story_recall: 'Kể lại chuyện',
  prediction: 'Dự đoán',
  experiment: 'Thí nghiệm',
  classification: 'Phân loại',
  comparison: 'So sánh',
  cause_effect: 'Nguyên nhân – kết quả',
};

const E = (body: string) => `<svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;

export function emoteIcon(kind: Emote): string {
  switch (kind) {
    case 'heart':
      return E('<path d="M32 54C14 41 8 32 8 23c0-7 5.5-12 12-12 5 0 9 3 12 7 3-4 7-7 12-7 6.5 0 12 5 12 12 0 9-6 18-24 31z" fill="#FF6F91" stroke="#C2385B" stroke-width="3"/><ellipse cx="20" cy="22" rx="5" ry="3.5" fill="#fff" opacity=".7" transform="rotate(-30 20 22)"/>');
    case 'question':
      return E('<circle cx="32" cy="32" r="26" fill="#FFF" stroke="#5AB3F0" stroke-width="4"/><path d="M24 25a8 8 0 1 1 11 7.4c-2 .9-3 2.4-3 4.6v2" fill="none" stroke="#3A8FD0" stroke-width="5.5" stroke-linecap="round"/><circle cx="32" cy="47" r="3.6" fill="#3A8FD0"/>');
    case 'exclaim':
      return E('<circle cx="32" cy="32" r="26" fill="#FFF7D6" stroke="#FFB300" stroke-width="4"/><path d="M32 16v19" stroke="#E68A00" stroke-width="7" stroke-linecap="round"/><circle cx="32" cy="46" r="4" fill="#E68A00"/>');
    case 'tear':
      return E('<path d="M32 8C24 22 16 30 16 40a16 16 0 0 0 32 0c0-10-8-18-16-32z" fill="#8FD3FF" stroke="#3A8FD0" stroke-width="3"/><ellipse cx="25" cy="40" rx="4" ry="6" fill="#fff" opacity=".7"/>');
    case 'zzz':
      return E('<text x="8" y="50" font-family="Baloo 2, sans-serif" font-weight="800" font-size="30" fill="#7E6CF0">Z</text><text x="30" y="34" font-family="Baloo 2, sans-serif" font-weight="800" font-size="22" fill="#9C88FF">z</text><text x="46" y="20" font-family="Baloo 2, sans-serif" font-weight="800" font-size="16" fill="#B9AAFF">z</text>');
    case 'sparkle':
      return E('<path d="M32 4l6 20 20 8-20 8-6 20-6-20-20-8 20-8z" fill="#FFD54F" stroke="#E6A100" stroke-width="2.5"/><circle cx="52" cy="12" r="4" fill="#FFE082"/>');
    case 'music':
      return E('<path d="M24 46V16l26-6v30" fill="none" stroke="#9C88FF" stroke-width="5" stroke-linejoin="round"/><ellipse cx="18" cy="46" rx="8" ry="6.5" fill="#9C88FF"/><ellipse cx="44" cy="40" rx="8" ry="6.5" fill="#9C88FF"/>');
    case 'idea':
      return E('<circle cx="32" cy="27" r="16" fill="#FFE57F" stroke="#E6A100" stroke-width="3"/><rect x="25" y="42" width="14" height="10" rx="3" fill="#B0BEC5" stroke="#78909C" stroke-width="2.5"/><path d="M8 14l6 4M56 14l-6 4M32 2v6" stroke="#FFB300" stroke-width="3.5" stroke-linecap="round"/>');
  }
}
