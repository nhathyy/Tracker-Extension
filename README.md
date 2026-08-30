```md
# News Reading Tracker

Hệ thống theo dõi hành vi đọc tin tức trên trình duyệt Chrome.

Bài test thực tập Full-Stack & AI Engineer — Công ty DiID (Digital Intelligent Development).

Hệ thống gồm 3 phần:

- Chrome Extension thu thập hành vi đọc bài báo
- Central Server nhận, validate và lưu dữ liệu
- Dashboard web hiển thị dữ liệu realtime, tóm tắt và phân loại chủ đề

---

## 1. Kiến trúc hệ thống

```
[Người dùng đọc báo]
        |
        v
Chrome Extension (Manifest V3)
  - content script: detect bài, extract dữ liệu, phát event
  - service worker: gửi event lên server
  - chrome.storage: queue local
        |
        | POST /api/events
        v
Central Server (Node.js + Express + MySQL)
  - lưu event
  - GET /api/sessions
  - GET /api/articles
  - GET /api/events
  - POST /api/summarize
  - POST /api/classify
        |
        | REST API (poll 4s)
        v
Dashboard (Vue 3 + Vite + Chart.js)
  - danh sách bài đã đọc
  - nội dung + tóm tắt + chủ đề
  - timeline event
  - biểu đồ thống kê
```

---

## 2. Cài đặt và chạy hệ thống

### Yêu cầu

- Node.js 18 trở lên
- Docker Desktop
- Google Chrome

### 2.1. Clone source

```bash
git clone https://github.com/nhathyy/Tracker-Extension.git
cd Tracker-Extension
git checkout develop
```

### 2.2. Chạy MySQL bằng Docker

```bash
cd server
docker compose up -d
```

Thông tin kết nối:

- Host: `127.0.0.1`
- Port: `3306`
- Database: `tracker`
- User: `tracker`
- Password: `123456`

Tạo bảng:

```sql
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  domain VARCHAR(255),
  title TEXT,
  content LONGTEXT,
  content_length INT DEFAULT 0,
  session_id VARCHAR(64) NOT NULL,
  timestamp VARCHAR(50) NOT NULL,
  total_reading_time_ms INT DEFAULT 0,
  reason VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_timestamp (timestamp)
);
```

### 2.3. Chạy Central Server

```bash
cd server
npm install
npm run dev
```

Kiểm tra: [http://localhost:3000](http://localhost:3000)

Kết quả mong đợi:

```json
{ "status": "ok", "message": "Tracker Server is running" }
```

### 2.4. Chạy Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Mở [http://localhost:5173](http://localhost:5173)

### 2.5. Cài Chrome Extension

1. Mở `chrome://extensions`
2. Bật Developer mode
3. Chọn Load unpacked
4. Chọn thư mục `extension/`
5. Mở một bài viết trên VnExpress có URL dạng `https://vnexpress.net/<slug>-<id>.html`

---

## 3. Mô tả giải pháp theo đề bài

### Câu 1. Thu thập dữ liệu và thời gian đọc thật

Extension chỉ theo dõi trang bài viết hợp lệ (regex URL), không bắt trang chủ / chuyên mục.

Dữ liệu thu thập:

- URL
- Domain
- Title
- Nội dung chính
- Thời điểm bắt đầu / các mốc event
- Tổng thời gian đọc thật

Cách tính thời gian đọc thật (không lấy thời gian tab mở):

- `visibilitychange`: chuyển tab hoặc minimize
- `focus` / `blur`: chuyển sang cửa sổ khác
- Idle 30 giây không scroll / di chuột / gõ phím / click → `PAGE_INACTIVE`

Chỉ cộng `total_reading_time_ms` khi trạng thái đang `ACTIVE`.

### Câu 2. Thiết kế Event

Các event:

- `PAGE_ENTER`
- `PAGE_ACTIVE`
- `PAGE_INACTIVE`
- `PAGE_LEAVE`

Mỗi event gồm tối thiểu:

```json
{
  "event_type": "PAGE_ENTER",
  "url": "https://vnexpress.net/...",
  "title": "...",
  "timestamp": "2026-08-30T12:00:00.000Z",
  "session_id": "uuid"
}
```

`session_id` được tạo bằng `crypto.randomUUID()` cho mỗi tab / mỗi lần đọc bài.

Vì sao lưu dạng event, không chỉ 1 bản ghi tổng hợp:

- Người dùng có thể đóng Chrome đột ngột, không kịp bản ghi cuối
- Reconstruct được timeline
- Tính lại thời gian đọc từ các đoạn ACTIVE
- Dễ mở rộng thêm loại event sau này

### Câu 3. Central Server

Stack: Node.js, Express, MySQL 8 (Docker), `mysql2`.

API bắt buộc:

- `POST /api/events` — nhận event, validate, lưu DB
- `GET /api/sessions` — lịch sử phiên đọc
- `GET /api/articles` — danh sách bài đã đọc

API bổ sung cho Dashboard:

- `GET /api/events?url=...` hoặc `?session_id=...`
- `POST /api/summarize`
- `POST /api/classify`

Validate tối thiểu: `event_type`, `url`, `session_id`, `timestamp`.

### Câu 4. Dashboard

Dashboard Vue 3 + Vite hiển thị:

- URL, tiêu đề, nội dung
- Tóm tắt
- Chủ đề + confidence
- Tổng thời gian đọc
- Timeline event
- Biểu đồ phân bổ domain
- Biểu đồ thời gian đọc theo ngày

Cập nhật gần realtime bằng polling 4 giây.

### Câu 5. Xử lý tình huống thực tế

1. Mở nhiều tab: mỗi tab một `session_id`.
2. Chuyển tab liên tục: `visibilitychange` phát INACTIVE / ACTIVE.
3. Mở tab nhưng không thao tác: idle 30 giây → INACTIVE.
4. Đóng Chrome đột ngột: dùng `pagehide` để gửi LEAVE. Nếu không kịp, các event trước đó đã được lưu.
5. Gửi trùng event: chưa dedupe phía server (hạn chế đã ghi nhận).
6. Mất Internet: lưu queue trong `chrome.storage.local`. Hiện gửi live qua service worker; chưa tự flush queue khi online lại.
7. Website đổi HTML: `contentSelectors` thử lần lượt. Thêm site mới chỉ cần sửa `extension/config/sites.js`.

### Câu 6. Tóm tắt nội dung

Phương pháp extractive:

- Làm sạch khoảng trắng
- Tách câu
- Lấy 3–4 câu đầu đủ dài từ nội dung gốc

Cách hạn chế thông tin bịa: không dùng LLM sinh câu mới, chỉ lấy câu có trong bài.

Đánh giá: kiểm tra thủ công tóm tắt có nằm trong content gốc hay không.

### Câu 7. Phân loại chủ đề

Rule-based theo từ khóa các nhóm: Technology, Economy, Politics, Sports, Education, Health, Entertainment, Others.

- Title được tính điểm cao hơn body
- Bài thiên tai / không khớp từ khóa → Others
- Trả về `category` và `confidence`

### Câu 8 và Câu 9

Chưa hoàn thành.

---

## 4. Chức năng đã hoàn thành

- Chrome Extension Manifest V3
- Detect bài viết VnExpress theo regex URL
- Extract URL, domain, title, content
- Hệ thống event PAGE_ENTER / ACTIVE / INACTIVE / LEAVE
- Quản lý session_id theo tab
- Tính thời gian đọc thật
- Lưu queue local bằng chrome.storage
- Gửi event lên server qua service worker
- Central Server với 3 API bắt buộc
- MySQL chạy bằng Docker
- Dashboard danh sách bài + nội dung + timeline
- Biểu đồ realtime
- Tóm tắt extractive
- Phân loại chủ đề rule-based

---

## 5. Chức năng chưa hoàn thành / hạn chế hiện tại

- Tuổi Trẻ và Dân Trí: đã có hướng cấu hình nhưng extract chưa ổn định bằng VnExpress
- Server chưa chống trùng event
- Queue local chưa tự gửi lại khi mạng có lại
- Tóm tắt và phân loại chưa dùng LLM
- Chưa có API key / authentication
- Chưa thống kê sở thích đọc đa nhãn (Câu 8)
- Chưa dự đoán thời gian đọc (Câu 9)

---

## 6. Quyết định kỹ thuật quan trọng

- Dùng event stream thay vì một record tổng hợp để xử lý được các tình huống thực tế trong đề.
- Content script không gọi thẳng `localhost` từ trang HTTPS. Service worker chịu trách nhiệm POST API.
- Chọn MySQL + Docker thay vì SQLite để gần môi trường thật và dễ kiểm tra bằng DBeaver.
- Dashboard dùng polling 4 giây thay vì WebSocket để hoàn thành đúng hạn.
- Tóm tắt extractive + phân loại rule-based để không phụ thuộc API key và không bịa nội dung.
- Ưu tiên làm ổn định VnExpress trước, các site khác thêm sau bằng config.

---

## 7. Cấu trúc thư mục

```text
Tracker-Extension/
├── extension/                 # Chrome Extension
│   ├── manifest.json
│   ├── background/service-worker.js
│   ├── config/sites.js
│   └── content/content.js
├── server/                    # Central Server
│   ├── docker-compose.yml
│   ├── package.json
│   └── src/
│       ├── db.js
│       └── index.js
├── dashboard/                 # Dashboard Vue 3
│   └── src/
│       ├── App.vue
│       └── ChartsPanel.vue
└── README.md
```

---

## 8. Ảnh kết quả

Thêm ảnh screenshot vào thư mục `docs/` rồi sửa link bên dưới:

- Console Extension khi phát hiện bài viết
- Bảng `events` trên DBeaver
- Dashboard danh sách bài đã đọc
- Timeline + tóm tắt + phân loại
- Biểu đồ thống kê

```md
![Dashboard](docs/dashboard.png)
![Events](docs/events.png)
```

---

## 9. Video demo

YouTube: _dán link video vào đây_

Nội dung video:

- Demo Extension → Server → Dashboard
- Giải thích thời gian đọc thật và hệ thống event
- Demo các tình huống chuyển tab / idle
- Tóm tắt giải pháp các câu hỏi trong đề
```

Copy hết khối trên vào `README.md` ở root, rồi:

```bash
git add README.md
git commit -m "docs: add submission README"
git push origin develop
```