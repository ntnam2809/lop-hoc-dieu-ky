import type { Activity, LessonBundle, Point, Scenario, TemplateArgs, Timeline } from '../types';
import type { AssetStore } from '../runtime/assets';
import type { Stage } from '../runtime/stage';
import type { Session } from '../runtime/session';

/**
 * Những gì một hoạt động được phép dùng. Hoạt động không tự điều hướng bài
 * học — chỉ báo `complete()`; giáo viên quyết định khi nào sang phần sau.
 */
export interface ActivityHost {
  stage: Stage;
  assets: AssetStore;
  bundle: LessonBundle;
  scenario: Scenario;
  session: Session;
  signal: AbortSignal;
  /** Báo hoàn thành (bật nút "Tiếp" phát sáng cho giáo viên). */
  complete(): void;
  runTimeline(t: Timeline | undefined, args?: TemplateArgs): Promise<void>;
  /** Đọc to + phụ đề; target = id nhân vật để hiện bong bóng thoại. */
  say(text: string, target?: string): Promise<void>;
  /** Biểu ngữ yêu cầu ở trên cùng (có nút loa đọc lại). */
  instruct(text: string): Promise<void>;
  /** Thu biểu ngữ yêu cầu lại (nhường chỗ cho mô phỏng). */
  hideInstruction(): void;
  /** Khen: sao bung + chuông + chữ nảy (toạ độ lớp UI). */
  celebrate(at: Point, text?: string): void;
  /** Mời thử lại nhẹ nhàng — không có tín hiệu "sai". */
  encourage(el: HTMLElement, text?: string): void;
  /** Gọi `fn` khi trẻ không tương tác trong `ms` (nhắc khéo). Tự huỷ khi rời hoạt động. */
  onIdle(ms: number, fn: () => void): void;
  /** Đánh dấu có tương tác (đặt lại đồng hồ nhắc). */
  touch(): void;
}

export interface ActivityController {
  start(): Promise<void>;
  destroy?(): void;
}

export type ActivityFactory<A extends Activity = Activity> = (activity: A, host: ActivityHost) => ActivityController;
