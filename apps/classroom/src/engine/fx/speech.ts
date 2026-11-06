/**
 * Đọc to lời dẫn bằng giọng tiếng Việt có sẵn của hệ điều hành (Web Speech).
 * Không phải AI tạo sinh: chỉ đọc đúng văn bản đã duyệt trong gói nội dung.
 * Không có giọng vi-VN → im lặng, phụ đề vẫn hiển thị để giáo viên đọc.
 */
class Narrator {
  enabled = true;
  private voice: SpeechSynthesisVoice | null = null;
  private ready = false;

  private init() {
    if (this.ready || typeof speechSynthesis === 'undefined') return;
    const choose = () => {
      const voices = speechSynthesis.getVoices();
      this.voice = voices.find((v) => v.lang?.toLowerCase().startsWith('vi')) ?? null;
    };
    choose();
    speechSynthesis.addEventListener?.('voiceschanged', choose);
    this.ready = true;
  }

  get available(): boolean {
    this.init();
    return !!this.voice;
  }

  /** Đọc và resolve khi đọc xong (hoặc ngay nếu không đọc được). */
  speak(text: string, signal?: AbortSignal): Promise<void> {
    this.init();
    if (!this.enabled || !this.voice || !text || signal?.aborted || new URLSearchParams(location.search).has('mute')) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.voice;
      u.lang = this.voice!.lang;
      u.rate = 0.92;
      u.pitch = 1.15;
      const done = () => resolve();
      u.onend = done;
      u.onerror = done;
      signal?.addEventListener('abort', () => {
        speechSynthesis.cancel();
        done();
      }, { once: true });
      speechSynthesis.speak(u);
      // Phòng khi trình duyệt không bắn onend.
      setTimeout(done, 1200 + text.length * 110);
    });
  }

  pause(p: boolean) {
    if (typeof speechSynthesis === 'undefined') return;
    if (p) speechSynthesis.pause();
    else speechSynthesis.resume();
  }

  stop() {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }
}

export const narrator = new Narrator();
