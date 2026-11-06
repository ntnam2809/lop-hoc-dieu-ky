# ADR-0016 — MVP-B: giáo viên thiết kế phiên học cho trẻ ở chế độ private, hiệu trưởng thật phê duyệt

**Trạng thái:** Accepted · 2026-11-06 · theo phương châm của anh Nam · module `school` + `classroom` + `learning` + `safety`

## Bối cảnh
Anh Nam (2026-11-06): "Giáo viên làm SKKN trình demo vẫn là không gian người lớn, nhưng con người chủ động thiết kế phiên học cho trẻ, hiệu trưởng trường thật phê duyệt giáo viên sử dụng app chế độ private để quản lý riêng."

## Quyết định
1. **MVP-B vẫn là không gian người lớn.** Người dùng app là giáo viên thật. Trẻ **không có tài khoản, không có hồ sơ, không dùng thiết bị riêng** trong MVP-B. Trẻ trải nghiệm bài qua **chế độ trình chiếu** do cô dẫn trên màn hình lớn của lớp, đúng mô hình của prototype.
2. **Giáo viên chủ động thiết kế phiên học** (`SessionPlan`): chọn bài, thứ tự hoạt động, ghi chú sư phạm, câu hỏi gợi ý. Giáo viên chạy thử với người lớn (đồng nghiệp, hội đồng SKKN) như một phiên bình thường, rồi trình chiếu cho lớp thật.
3. **Chế độ private:** trường dạng `organization` không hiện ở đâu, không nhận người lạ, không livestream. Hiệu trưởng của trường thật **phê duyệt** giáo viên được dùng app cho lớp mình (`grantTeacher` đã có, kèm kiểm toán).
4. **Bằng chứng cho SKKN:** giáo viên xuất được bản tóm tắt phiên đã dạy (bài, hoạt động, ghi chú, quan sát lớp do cô nhập). Không chứa tên trẻ.
5. Hồ sơ trẻ (`createManagedStudent`) **giữ trong domain nhưng không bật ở MVP-B**. Chỉ mở ở phase sau khi Q-02 có câu trả lời.

## Phương án đã cân nhắc
Cho trẻ dùng tablet có hồ sơ ngay ở MVP-B (cần đồng ý phụ huynh và trách nhiệm dữ liệu trẻ; chậm và rủi ro) · bỏ hẳn trường tổ chức, chỉ dùng trường chơi (giáo viên không có không gian riêng để quản lý lớp thật, và phải tách khỏi livestream).

## Hệ quả
- MVP-B không thu dữ liệu nào của trẻ, nên Q-02 không còn chặn MVP-B. Q-02 chỉ chặn phase có hồ sơ trẻ.
- Việc mới: `SessionPlan` trong domain, chế độ "trình chiếu cho lớp" kèm ghi quan sát, xuất bản tóm tắt SKKN (M2–M4).
- Xác minh tổ chức (Q-13): phê duyệt giáo viên do hiệu trưởng thật làm. Nền tảng vẫn phải biết hiệu trưởng là người của trường thật trước khi trường được dùng chế độ private.
