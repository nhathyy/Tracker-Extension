<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import ChartsPanel from "./ChartsPanel.vue";

const API = "http://localhost:3000";

const articles = ref([]);
const events = ref([]);
const selected = ref(null);
const loading = ref(false);
const error = ref("");
const summary = ref("");

function formatMs(ms) {
  const s = Math.round((ms || 0) / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m} phút ${r} giây` : `${r} giây`;
}

async function loadArticles() {
  try {
    const res = await fetch(`${API}/api/articles`);
    const json = await res.json();
    articles.value = json.data || [];
    error.value = "";
  } catch (e) {
    error.value = "Không kết nối được server. Kiểm tra npm run dev.";
  }
}

async function selectArticle(article) {
  selected.value = article;
  loading.value = true;
  summary.value = "";
  try {
    const [evRes, sumRes] = await Promise.all([
      fetch(`${API}/api/events?url=${encodeURIComponent(article.url)}`),
      fetch(`${API}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: article.title, content: article.content }),
      }),
    ]);
    const evJson = await evRes.json();
    const sumJson = await sumRes.json();
    events.value = evJson.data || [];
    summary.value = sumJson.summary || "";
  } catch (e) {
    events.value = [];
    summary.value = "";
  } finally {
    loading.value = false;
  }
}

let timer = null;
onMounted(() => {
  loadArticles();
  timer = setInterval(loadArticles, 4000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="header-content">
        <h1>News Reading Tracker</h1>
        <p>Dữ liệu đọc báo realtime · Tự động làm mới mỗi 4 giây</p>
      </div>
      <ChartsPanel :articles="articles" />
    </header>

    <div v-if="error" class="error-banner">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      {{ error }}
    </div>

    <main class="main-layout">
      <!-- Cột danh sách -->
      <section class="list-section">
        <div class="section-header">
          <h2>Bài đã đọc</h2>
          <span class="badge">{{ articles.length }}</span>
        </div>
        
        <div class="article-list">
          <article
            v-for="item in articles"
            :key="item.url"
            class="card"
            :class="{ active: selected?.url === item.url }"
            @click="selectArticle(item)"
          >
            <h3>{{ item.title }}</h3>
            <div class="card-meta">
              <span class="domain">{{ item.domain }}</span>
              <span class="dot">•</span>
              <span class="time">{{ formatMs(item.total_reading_time_ms) }}</span>
            </div>
            <p class="url" :title="item.url">{{ item.url }}</p>
          </article>
        </div>
      </section>

      <!-- Cột chi tiết -->
      <section class="detail-section" v-if="selected">
        <h2 class="detail-title">{{ selected.title }}</h2>
        <div class="detail-meta">
          <span class="time-badge">⏳ {{ formatMs(selected.total_reading_time_ms) }}</span>
          <a :href="selected.url" target="_blank" class="url-link">{{ selected.url }}</a>
        </div>

        <div class="content-blocks">
          <div class="block summary-block">
            <h3>Tóm tắt AI</h3>
            <div class="summary-content" :class="{ 'is-loading': loading && !summary }">
              {{ summary || (loading ? "Đang tạo tóm tắt..." : "Chưa có tóm tắt") }}
            </div>
          </div>

          <div class="block">
            <h3>Nội dung gốc</h3>
            <pre class="content">{{ selected.content || "(Không có nội dung)" }}</pre>
          </div>

          <div class="block">
            <h3>Timeline sự kiện</h3>
            <p v-if="loading && events.length === 0" class="loading-text">Đang tải dữ liệu...</p>
            <ul class="timeline" v-if="events.length > 0">
              <li v-for="ev in events" :key="ev.id">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="event-type">{{ ev.event_type }}</span>
                    <span class="timestamp">{{ ev.timestamp }}</span>
                  </div>
                  <div class="timeline-details">
                    <span v-if="ev.reason" class="reason">Lý do: {{ ev.reason }}</span>
                    <span class="duration">Tổng thời gian: {{ formatMs(ev.total_reading_time_ms) }}</span>
                  </div>
                </div>
              </li>
            </ul>
            <p v-else-if="!loading" class="empty-text">Chưa có sự kiện nào được ghi nhận.</p>
          </div>
        </div>
      </section>

      <!-- Trạng thái trống -->
      <section class="detail-section empty-state" v-else>
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
        <p>Chọn một bài viết bên trái để xem chi tiết nội dung và timeline.</p>
      </section>
    </main>
  </div>
</template>

<style>
/* Reset & Base */
* { box-sizing: border-box; }
body { 
  margin: 0; 
  font-family: 'Inter', system-ui, -apple-system, sans-serif; 
  background: #0f172a; 
  color: #e2e8f0; 
  line-height: 1.5;
}

/* Custom Scrollbar */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #0f172a; border-radius: 4px; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #475569; }

.page { max-width: 1280px; margin: 0 auto; padding: 32px 24px; }

/* Header */
.header { margin-bottom: 32px; }
.header-content h1 { margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #f8fafc; tracking: tight; }
.header-content p { margin: 0; color: #94a3b8; font-size: 15px; }

/* Alerts */
.error-banner { 
  display: flex; align-items: center; gap: 12px;
  background: #7f1d1d; color: #fca5a5; 
  padding: 16px; border-radius: 8px; 
  margin-bottom: 24px; font-weight: 500;
}

/* Layout */
.main-layout { 
  display: grid; 
  grid-template-columns: 1fr; 
  gap: 24px; 
}
@media (min-width: 900px) {
  .main-layout { grid-template-columns: 380px 1fr; }
}

/* Sections Shared */
.list-section, .detail-section { 
  background: #1e293b; 
  border-radius: 16px; 
  padding: 24px; 
  border: 1px solid #334155;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* List Column */
.section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.section-header h2 { margin: 0; font-size: 18px; color: #f8fafc; }
.badge { background: #334155; padding: 2px 10px; border-radius: 99px; font-size: 13px; font-weight: 600; color: #94a3b8; }

.article-list { display: flex; flex-direction: column; gap: 12px; }

.card { 
  padding: 16px; 
  background: #0f172a;
  border-radius: 12px; 
  cursor: pointer; 
  border: 1px solid transparent; 
  transition: all 0.2s ease;
}
.card:hover { border-color: #475569; transform: translateY(-1px); }
.card.active { background: #172554; border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }

.card h3 { margin: 0 0 8px; font-size: 15px; font-weight: 600; color: #f1f5f9; line-height: 1.4; }
.card-meta { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #94a3b8; margin-bottom: 8px; }
.card-meta .domain { color: #cbd5e1; font-weight: 500; }
.card-meta .dot { font-size: 10px; opacity: 0.5; }
.card .url { margin: 0; font-size: 12px; color: #7dd3fc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.8; }

/* Detail Column */
.detail-title { margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #f8fafc; line-height: 1.3; }
.detail-meta { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #334155; }
.time-badge { background: #334155; padding: 6px 12px; border-radius: 8px; font-size: 14px; font-weight: 500; }
.url-link { color: #38bdf8; text-decoration: none; font-size: 14px; word-break: break-all; }
.url-link:hover { text-decoration: underline; }

.content-blocks { display: flex; flex-direction: column; gap: 32px; }
.block h3 { margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #f1f5f9; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9; }

/* Summary Block */
.summary-content { background: #082f49; border-left: 4px solid #38bdf8; padding: 16px 20px; border-radius: 0 8px 8px 0; font-size: 15px; color: #e0f2fe; line-height: 1.6; }
.summary-content.is-loading { opacity: 0.7; font-style: italic; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
@keyframes pulse { 50% { opacity: 0.3; } }

/* Content Block */
.content { 
  margin: 0;
  white-space: pre-wrap; 
  font-family: inherit;
  font-size: 14.5px;
  line-height: 1.7;
  color: #cbd5e1;
  max-height: 400px; 
  overflow-y: auto; 
  background: #0f172a; 
  padding: 20px; 
  border-radius: 12px; 
  border: 1px solid #334155;
}

/* Timeline */
.timeline { list-style: none; padding: 0; margin: 0; position: relative; }
.timeline::before { content: ''; position: absolute; left: 11px; top: 8px; bottom: 8px; width: 2px; background: #334155; }

.timeline li { position: relative; padding: 0 0 24px 32px; }
.timeline li:last-child { padding-bottom: 0; }
.timeline li:last-child::before { display: none; } /* Hide line on last item if needed */

.timeline-dot { position: absolute; left: 6px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 0 4px #1e293b; z-index: 1; }

.timeline-content { background: #0f172a; padding: 12px 16px; border-radius: 8px; border: 1px solid #334155; }
.timeline-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
.event-type { font-weight: 600; color: #f8fafc; font-size: 14px; text-transform: capitalize; background: #334155; padding: 2px 8px; border-radius: 4px; }
.timestamp { font-size: 12px; color: #94a3b8; }

.timeline-details { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #cbd5e1; }
.timeline-details .reason { color: #fca5a5; }

.loading-text, .empty-text { color: #94a3b8; font-style: italic; }

/* Empty State */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #64748b; padding: 64px 24px; min-height: 400px; }
.empty-icon { margin-bottom: 16px; opacity: 0.5; }
</style>