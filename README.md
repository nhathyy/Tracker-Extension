# News Reading Tracker

Hệ thống theo dõi hành vi đọc tin tức trên trình duyệt Chrome.

Bài test thực tập Full-Stack & AI Engineer — Công ty DiID (Digital Intelligent Development).

Hệ thống gồm 3 phần:

- Chrome Extension thu thập hành vi đọc bài báo
- Central Server nhận, validate và lưu dữ liệu
- Dashboard web hiển thị dữ liệu realtime, tóm tắt và phân loại chủ đề

---

## 1. Cài đặt và chạy hệ thống

### Yêu cầu

- Node.js 18 trở lên
- Docker Desktop
- Google Chrome

### 1.1. Clone source

    git clone https://github.com/nhathyy/Tracker-Extension.git
    cd Tracker-Extension
    git checkout develop

### 1.2. Chạy MySQL bằng Docker

    cd server
    docker compose up -d

Thông tin kết nối:

- Host: `127.0.0.1`
- Port: `3306`
- Database: `tracker`
- User: `tracker`
- Password: `123456`

Tạo bảng:

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

### 1.3. Chạy Central Server

    cd server
    npm install
    npm run dev

Kiểm tra: http://localhost:3000

Kết quả mong đợi:

    { "status": "ok", "message": "Tracker Server is running" }

### 1.4. Chạy Dashboard

    cd dashboard
    npm install
    npm run dev

Mở http://localhost:5173

### 1.5. Cài Chrome Extension

1. Mở `chrome://extensions`
2. Bật Developer mode
3. Chọn Load unpacked
4. Chọn thư mục `extension/`
5. Mở một bài viết VnExpress có URL dạng `https://vnexpress.net/<slug>-<id>.html`

---

## 2. Mô tả giải pháp theo đề bài

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

- `event_type`
- `url`
- `title`
- `timestamp`
- `session_id`

`session_id` được tạo bằng `crypto.randomUUID()` cho mỗi tab / mỗi lần đọc bài.

### Câu 3. Central Server

Stack: Node.js, Express, MySQL 8 (Docker), mysql2.

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

## 3. Chức năng đã hoàn thành

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

## 4. Chức năng chưa hoàn thành / hạn chế hiện tại

- Tuổi Trẻ và Dân Trí: đã có hướng cấu hình nhưng extract chưa ổn định bằng VnExpress
- Server chưa chống trùng event
- Queue local chưa tự gửi lại khi mạng có lại
- Tóm tắt và phân loại chưa dùng LLM
- Chưa có API key / authentication
- Chưa thống kê sở thích đọc đa nhãn (Câu 8)
- Chưa dự đoán thời gian đọc (Câu 9)

---
