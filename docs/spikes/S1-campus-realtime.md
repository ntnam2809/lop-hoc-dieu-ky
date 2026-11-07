# Spike S1 — Campus 2D realtime (Phaser + Colyseus)

Đo lại bản cuối: 2026-11-06 · commit nền `0dc1e15` (cây làm việc có sửa chưa commit) · công cụ `apps/campus/tools/measure.ts` · phiếu WO-world-04b.
Lịch sử: đo lần 1 trước khi sửa lỗi tốc độ client (WO-07): **không dùng**, mọi số fps / độ trễ / heap của lần đó đã bỏ.

## Giới hạn (đọc trước)
- **fps chỉ là proxy.** Chromium headless vẽ phần mềm (SwiftShader), không GPU, máy ảo 4 nhân. Không suy ra được fps trên tablet tầm trung, theo cả hai chiều. Chỉ so sánh tương đối giữa 1 / 20 / 30 avatar trên cùng máy. Ngay 1 avatar đã chỉ 38,7–41,9 fps (< 50), nên mốc tuyệt đối "≥ 50 fps" **không đánh giá được** ở môi trường này.
- Chưa đo trên tablet thật, chưa thử chạm thật.
- ADR-0003 viết tiêu chí "chuyển campus ↔ sân khấu bài học không rò sau 10 lần", nhưng spike chỉ đo mount/unmount của chính campus (hook `__campus`). Sân khấu bài học (`apps/classroom`) không nằm trong phép đo, nên tiêu chí đó **chưa đánh giá được**; số heap dưới đây là của vòng mount/unmount campus.
- 30 avatar vượt trần sản phẩm 20 (ADR-0017); chạy trên server riêng `CAMPUS_MAX_CLIENTS=30`.
- Máy chạy độc quyền (không tiến trình khác) trong lúc đo; vẫn là máy ảo nên có nhiễu.
- Các lần chạy bảng `main` (bundle, fps, latency, server) dùng bản `measure.ts` trước khi sửa lỗi lệch đích của mục throttle; mục throttle trong các lần đó bỏ (có mẫu quãng 0 px), dùng 3 lần chạy riêng ở §Tốc độ client dưới tải.

## Môi trường
- Ngày 2026-11-06; commit `0dc1e15`; `nproc` = 4 (Intel Xeon @ 2,10 GHz); `free -m`: 16.086 MB tổng, 13.905 MB trống trước khi đo; Node v22.
- Chromium: Chrome for Testing 153.0.8010.12, headless, cờ `--use-gl=swiftshader --enable-precise-memory-info --js-flags=--expose-gc`, viewport 1024×768, DPR 1.
- Trước khi đo: không còn tiến trình tsx/vite/chrom; cổng 2567, 2577, 2578, 5197, 5198 trống (đọc `/proc/net/tcp`, máy không có `ss`). `npm run build -w @lhdk/campus` mới nhất.
- Server `npm run start -w @lhdk/server` cổng 2577 với `CAMPUS_LOG_CORRECT=1`; stress `CAMPUS_MAX_CLIENTS=30` cổng 2578; client qua `vite preview` cổng 5197.
- Phụ thuộc pin: phaser 4.2.1 · @colyseus/sdk 0.18.6 · @colyseus/schema 5.0.42 · @colyseus/core 0.18.23 · colyseus 0.18.10 · vite 8.3.6 · tsx 4.23.15 · typescript 5.9.3 · vitest 5.1.0 · @playwright/test 1.65.0.

## Kết quả theo tiêu chí ADR-0003
| Tiêu chí | Kết quả | Ghi chú |
|---|---|---|
| ≥ 50 fps, 30 avatar, tablet tầm trung | **Không kết luận được** | Không có tablet; SwiftShader cho 1 avatar 38,7–41,9 fps nên mốc 50 không đo được. Tương đối: 30 avatar giữ 62,6% fps của 1 avatar (0,617–0,641), 20 avatar giữ 72,4% (0,706–0,747). |
| Bundle gzip ≤ 1,5 MB | **Đạt** | 410.107 B gzip (400,5 KiB) / 1.500.000 B; raw 1.547.239 B; 3 lần cùng số. |
| Không rò bộ nhớ sau 10 lần (chỉ phần campus) | **Không thấy rò** sau 60 vòng; ở 10 vòng chưa thấy phẳng | Độ dốc vòng 6–60: 8,1 và 7,6 KB/vòng (≤ 20, ổn định giữa hai lần 60 vòng). Heap tăng ~2 MB trong ~10 vòng đầu rồi phẳng (xem bảng). Ở đúng 10 vòng độ dốc vòng 6–10 là 107–111 KB/vòng, là khởi động chứ không phải rò. Phần chuyển sang sân khấu bài học chưa đo. |

## Số đo

### fps (proxy, SwiftShader) — 3 lần, 20 s mỗi lần, mẫu sau 5 s khởi động
Trước mỗi mẫu kiểm `players.length` của người xem đúng mục tiêu; `players_after` = mục tiêu ở cả 9 mẫu. Trước khi đóng tab gọi `unmount()`.
| Kịch bản | fps TB lần 1 / 2 / 3 | Trung bình | p5 (1/2/3) | p1 (1/2/3) |
|---|---|---|---|---|
| 1 avatar | 41,9 / 41,0 / 38,7 | 40,5 | 29,9 / 29,9 / 29,9 | 29,9 / 29,9 / 29,9 |
| 20 avatar | 29,6 / 29,5 / 28,9 | 29,3 | 20 / 20 / 20 | 20 / 20 / 20 |
| 30 avatar (server trần 30) | 26,0 / 25,3 / 24,8 | 25,4 | 20 / 20 / 20 | 20 / 15 / 20 |

| Tỉ lệ | Lần 1 / 2 / 3 | Trung bình |
|---|---|---|
| fps20 / fps1 | 0,706 / 0,720 / 0,747 | 0,724 |
| fps30 / fps1 | 0,621 / 0,617 / 0,641 | 0,626 |

RTT cuối (ms), 1 / 20 / 30 avatar: 23 / 33 / 43 · 24 / 36 / 37 · 28 / 37 / 37. p5 và p1 nhận các giá trị rời rạc (29,9; 20; 15) vì khung bị vẽ theo bước ~33/50/67 ms.

### Bundle (3 lần cùng số)
`assets/index-*.js` một chunk; không có CSS; tổng 410.107 B gzip, 1.547.239 B raw. Vite cảnh báo chunk > 500 kB raw (Phaser chiếm gần hết).

### Rò bộ nhớ (mount → 2 s → unmount; heap sau `collectGarbage` ×2)
Đếm sau mỗi vòng: node DOM, canvas, listener trên `window` (lấy được bằng CDP `DOMDebugger.getEventListeners`), số player server qua client quan sát. Bỏ 5 vòng đầu; độ dốc là hồi quy tuyến tính usedSize trên các vòng còn lại.

| Cấu hình | Lần | usedSize baseline (B) | sau vòng cuối (B) | độ dốc vòng 6→cuối (KB/vòng) |
|---|---|---|---|---|
| 10 vòng | 1 | 4.141.248 | 6.117.416 | 111,5 |
| 10 vòng | 2 | 4.141.356 | 6.016.424 | 107,0 |
| 10 vòng | 3 | 4.141.356 | 6.089.824 | 108,0 |
| 60 vòng | 1 | 4.141.248 | 6.342.828 | 8,1 (vòng 31→60: 4,0) |
| 60 vòng | 2 | 4.141.356 | 6.295.712 | 7,6 (vòng 31→60: 1,7) |

Khoảng giữa các lần: 10 vòng 107,0–111,5 KB/vòng; 60 vòng 7,6–8,1 KB/vòng. Dốc tính trên mọi vòng kể cả 5 vòng đầu: 10 vòng 136,7–149,6; 60 vòng 14,7–15,2 KB/vòng.
Heap lần 60 vòng 1 mỗi 6 vòng (B): 5,08M · 5,66M · 6,12M · 6,13M · 6,15M · 6,24M · 6,26M · 6,27M · 6,33M · 6,33M. Vòng 5 ≈ 5,63M, vòng 60 ≈ 6,30–6,34M: tăng ~0,7 MB trong 55 vòng, hầu hết ở vòng 6–15.
Ở cả 5 lần: node DOM 9 mọi vòng (baseline 9), canvas 0, player phía server khi mount = 1 và sau unmount = 0 mọi vòng, đóng sạch ≤ 102 ms. Listener `window`: 1 trước khi mount, 3 sau mỗi vòng, không đổi qua các vòng (không tích luỹ).

**Kết luận: không thấy rò.** Dốc ≤ 20 KB/vòng và ổn định giữa hai lần 60 vòng. Giới hạn: chỉ JS heap (không GPU/texture), chỉ campus, 60 vòng × 2 s. Chưa thấy phẳng hẳn ở đúng 10 vòng (khởi động của Phaser/JIT).

### Độ trễ A→B (50 mẫu/lần, cục bộ)
| | Lần 1 | Lần 2 | Lần 3 | Trung bình |
|---|---|---|---|---|
| median (ms) | 151 | 158 | 157 | 155,3 |
| p95 (ms) | 208 | 217 | 213 | 212,7 |
| min / max (ms) | 62 / 229 | 67 / 242 | 67 / 218 | |
| median trừ 100 ms đệm | 51 | 58 | 57 | 55,3 |
| p95 trừ 100 ms đệm | 108 | 117 | 113 | 112,7 |

Đã gồm ~100 ms đệm nội suy cố định (`INTERP_DELAY_MS`) và nhịp gửi 10 Hz, đo bằng `state()` của B (vị trí đã nội suy, cập nhật theo khung hình). Cột "trừ 100 ms" chỉ là phép trừ số học 100 ms, chưa tách riêng lượng tử hoá theo khung hình (~25–33 ms ở môi trường này); coi là ước lượng. Trễ qua mạng thật cao hơn.

### Tốc độ client dưới tải CPU (kiểm chứng WO-07)
CDP `Emulation.setCPUThrottlingRate`; avatar mình `moveTo` đích cách ~600 px (luân phiên 150 ↔ 750), tốc độ = quãng đường thực / thời gian (px/s), 3 mẫu mỗi mức mỗi lần, 3 lần chạy riêng. Trần client 200 px/s, trần server 220 px/s. Server in dòng `[campus] correct <lý do>` (`CAMPUS_LOG_CORRECT=1`); đếm dòng bằng cách đọc stdout.
| Throttle | Lần 1 (px/s) | Lần 2 | Lần 3 | TB 9 mẫu | Số dòng correct (3 lần) |
|---|---|---|---|---|---|
| ×1 | 199,8 / 200 / 200,1 | 200,1 / 198,5 / 199 | 198,4 / 199,9 / 200 | 199,5 | 0 |
| ×4 | 198,7 / 196,7 / 195,5 | 199 / 196,2 / 200 | 198,6 / 200,2 / 200,2 | 198,3 | 0 |
| ×12 | 193,3 / 193,8 / 201,1 | 195,6 / 200 / 197,8 | 193,3 / 198,8 / 197,2 | 196,7 | 0 |

Không có correct nào ở cả 27 lượt đi. Mọi lượt đến đích. Throttle ×40 không chạy ở lần đo này; xem phát hiện (g).

### Tài nguyên server (một tiến trình Node, tsx) — 3 lần
| Mốc | RSS (MB) lần 1 / 2 / 3 (TB) | CPU% cửa sổ 10 s lần 1 / 2 / 3 (TB) |
|---|---|---|
| 0 client, rảnh | 85,9 / 86,3 / 83,3 (85,2) | 0,9 / 1,0 / 1,1 (1,0) |
| 19 bot | 91,6 / 92,7 / 90,1 (91,5) | 3,7 / 4,1 / 4,4 (4,1) |
| sau khi bot rời, rảnh | 92,9 / 93,3 / 91,8 (92,7) | 0,1 / 0,1 / 0,0 |

Khởi động lạnh (spawn → `/health` 200): `npm run start -w @lhdk/server` 631 / 630 / 660 ms (TB 640); `npx tsx src/index.ts` 758 / 738 / 804 ms (TB 767). Máy đã có cache đĩa; không phải khởi động lạnh của host miễn phí.

## Phương pháp (tóm tắt)
- fps: `requestAnimationFrame` trong trang 20 s, fps TB = khung / thời gian; p5, p1 = phân vị thấp của fps tức thời. 19 / 29 bot (`npm run bots`, 10 Hz) + người xem = 20 / 30 avatar.
- Rò bộ nhớ: `?harness=1`, tham số `--rounds N` (mặc định 10); bỏ 5 vòng đầu khỏi hồi quy.
- Độ trễ: hai tab A, B; `moveTo` của A đến khi `state()` của B thấy vị trí A lệch > 2 px; `Date.now()` cùng máy.
- Server: RSS từ `/proc/<pid>/status`; CPU% = chênh `utime+stime` trong cửa sổ 10 s.

## Phát hiện cho M2
- (a) `@colyseus/sdk` 0.18 mặc định `minUptime` = 5000 ms: phòng sống < 5 s không nối lại. Phải đặt `minUptime: 0` (và delay 150) thì reconnect mới đúng.
- (b) Đóng tab thẳng để lại người ma 30 s (giữ chỗ reconnect) và có thể đẩy người tiếp theo sang room phụ. Cần `unmount()` / `leave(true)` khi đóng.
- (c) `joinOrCreate` khi room đầy sẽ mở room `campus` phụ (trần `CAMPUS_MAX_CLIENTS`, mặc định 20): hai người cùng phiên có thể không thấy nhau. Cần luật gán room theo phiên.
- (d) Dự án dùng Phaser 4.2.1, ADR-0003 ghi Phaser 3; cần sửa ADR. Trong phạm vi spike (scene, đồ hoạ avatar, camera, input, vòng lặp) không thấy khác biệt API đáng kể; chưa thử tilemap Tiled, arcade physics, chạm đa điểm.
- (e) `delta` của Phaser bị làm mượt (đo thấy ≤ 17 ms khi khoảng cách thật giữa khung > 100 ms): phải tính dt từ `performance.now()`.
- (f) Luật tốc độ phía server dựa dt giữa hai message gây `correct` oan khi message đến dồn/giãn: đã đổi sang xô ngân sách (trần 55 px, hồi 220 px/s). Đo lại: 0 correct ở 27 lượt đi ×1/×4/×12.
- (g) Client chặn dt ở 100 ms: dưới ~10 fps nhân vật đi chậm (ví dụ throttle ×40 cho ~66 px/s, số từ phiếu WO-07, chưa đo lại ở phiếu này).
- (h) Hạn mức host miễn phí (Render, Koyeb, Cloud Run): **chưa tra**. Thời gian đánh thức host: **chưa đo**. Host ngủ thì state room mất và token reconnect cũ vô hiệu; cửa sổ giữ chỗ 30 s chỉ có nghĩa khi tiến trình còn sống.
- (i) Campus spike là không gian người lớn, chưa gắn danh tính; trẻ không dùng (ADR-0014).
- Khác: nhánh hết hạn giữ chỗ 30 s chưa có test; chưa đo bộ nhớ GPU/texture; chưa đo trên tablet thật.

## Kết luận đề xuất (chỉ đề xuất; quyết định thuộc manager / anh Nam)
- **ADR-0003 (Phaser):** giữ có điều kiện. Bundle đạt với dư lớn. Heap không thấy rò sau 60 vòng (chỉ phần campus). fps không kết luận được. Điều kiện: một lần đo tay trên tablet thật (Q-01) và sửa ADR thành "Phaser 4".
- **ADR-0004 (Colyseus):** giữ Colyseus. Một tiến trình ~85–93 MB RSS, CPU ~4% với 19 client; nêu rõ phát hiện (a) cần cấu hình `minUptime: 0`, cùng (b), (c).

## Việc cho M2
1. Đo tablet thật, GPU thật; ngân sách 20 avatar, 30 chỉ dự phòng (Q-01).
2. Đo vòng chuyển campus ↔ sân khấu bài học và bộ nhớ GPU.
3. Luật gán room theo phiên học.
4. Tra hạn mức host miễn phí, đo thời gian đánh thức.
5. Tách chunk Phaser nếu cần (cảnh báo > 500 kB).
6. Chạy đo này như bước tay hoặc nightly trên máy rảnh.
