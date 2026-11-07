/**
 * Trạng thái một buổi học — chỉ trong bộ nhớ, không gắn với danh tính trẻ
 * (không tài khoản, không hồ sơ học sinh — đúng phạm vi MVP).
 */
export interface ExperimentRecord {
  key: string;
  label: string;
  prediction?: string;
  result: string;
}

export class Session {
  readonly startedAt = Date.now();
  predictions = new Map<string, string>();
  results: ExperimentRecord[] = [];
  completed = new Set<string>();
  visited = new Set<string>();

  predict(key: string, optionId: string) {
    this.predictions.set(key, optionId);
  }

  record(r: ExperimentRecord) {
    this.results = this.results.filter((x) => x.key !== r.key);
    this.results.push(r);
  }
}
