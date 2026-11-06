# Giao thức Manager ↔ Lead ↔ Thợ

> Subagent **không** spawn được subagent → mọi phiếu đi qua manager (ADR-0012).

## Luồng
1. **Manager** chuẩn hoá yêu cầu (mục tiêu · module · tiêu chí xong) → gọi `lead-<module>` với *Brief*.
2. **Lead** đọc L1, trả **Kế hoạch module** + 1..n **Phiếu việc** (WO). Không viết code.
3. **Manager** gọi thợ trong WO, dán **nguyên văn** WO (song song nếu WO ghi `song song: có`).
4. **Thợ** làm, chạy kiểm, trả **Báo cáo**.
5. **Manager** gửi báo cáo về **đúng lead đó** bằng `SendMessage` (lead giữ ngữ cảnh).
6. **Lead** duyệt: `PASS` / `REWORK` (WO sửa) / `ESCALATE` (cần anh Nam hoặc ADR). PASS kèm cập nhật file module.
7. Chạm chat/tương tác/dữ liệu trẻ → `lead-safety` duyệt trước khi commit.
8. **Manager** chạy `npm run check`, ghi `.talia/log.jsonl`, commit, PR (skill `ship`).

Việc ≤ 2 file, rõ ràng → manager tự làm, bỏ bước 2–6.

## Brief (manager → lead)
```
BRIEF <module> · <tiêu đề>
Mục tiêu: … · Vì sao: … (mốc/phiếu HO)
Tiêu chí xong: - … 
Ràng buộc: CONSTITUTION §… · ADR-…
Không làm: …
```

## Phiếu việc (lead → thợ)
```
WO-<module>-<NN> · <tiêu đề>            thợ: implementer|content-author|test-runner|code-scout|guard-reviewer
Đọc (chỉ những file này): - path[:dòng]
Được sửa: - path                       Không được sửa: mọi file khác
Spec: <hành vi cụ thể, input/output, ca biên>
Test phải có/chạy: <lệnh> · <tên test mới>
Tiêu chí xong: - …
Song song: có|không (phụ thuộc WO-…)
```
Phiếu phải **tự đủ**: thợ không có ngữ cảnh nào khác ngoài phiếu.

## Báo cáo (thợ → manager → lead)
```
REPORT WO-… · DONE|PARTIAL|BLOCKED|NEED_CONTEXT
Đã sửa: - path (+n/−m)
Kiểm đã chạy: <lệnh> → <kết quả thật, lỗi đầu tiên nguyên văn nếu có>
Lệch spec / cần quyết: - …
```

## Duyệt (lead → manager)
```
REVIEW WO-… · PASS|REWORK|ESCALATE
Lý do: … · WO sửa (nếu REWORK): … · Cập nhật knowledge: …
```
