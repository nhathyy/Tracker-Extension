<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import ChartsPanel from "./ChartsPanel.vue";

const API = "http://localhost:3000";

const articles = ref([]);
const events = ref([]);
const selected = ref(null);
const loading = ref(false);
const error = ref("");
const summary = ref("");
const category = ref(null);
const query = ref("");
const domainFilter = ref("all");
const detailTab = ref("summary");
const lastUpdated = ref(null);

const CATEGORY_LABELS = {
  Technology: "Công nghệ",
  Economy: "Kinh tế",
  Politics: "Chính trị",
  Sports: "Thể thao",
  Education: "Giáo dục",
  Health: "Sức khỏe",
  Entertainment: "Giải trí",
  Others: "Khác",
};

const EVENT_META = {
  PAGE_ENTER: { label: "Vào trang", tone: "enter" },
  PAGE_ACTIVE: { label: "Đang đọc", tone: "active" },
  PAGE_INACTIVE: { label: "Tạm dừng", tone: "idle" },
  PAGE_LEAVE: { label: "Rời trang", tone: "leave" },
};

const REASON_LABELS = {
  visibility_hidden: "Chuyển tab / ẩn trang",
  window_blur: "Mất focus cửa sổ",
  idle: "Không tương tác",
};

const DOMAIN_LABELS = {
  "vnexpress.net": "VnExpress",
  "www.vnexpress.net": "VnExpress",
  "tuoitre.vn": "Tuổi Trẻ",
  "www.tuoitre.vn": "Tuổi Trẻ",
  "dantri.com.vn": "Dân Trí",
  "www.dantri.com.vn": "Dân Trí",
};

const DOMAIN_COLORS = {
  "vnexpress.net": "#ff5a5f",
  "tuoitre.vn": "#f4a261",
  "dantri.com.vn": "#2ec4b6",
};

function normalizeDomain(domain) {
  return String(domain || "")
    .replace(/^www\./, "")
    .toLowerCase();
}

function prettyDomain(domain) {
  const raw = domain || "";
  return DOMAIN_LABELS[raw] || DOMAIN_LABELS[normalizeDomain(raw)] || raw || "Nguồn khác";
}

function domainColor(domain) {
  return DOMAIN_COLORS[normalizeDomain(domain)] || "#e2b657";
}

function categoryLabel(name) {
  return CATEGORY_LABELS[name] || name || "Khác";
}

function eventMeta(type) {
  return EVENT_META[type] || { label: type || "Sự kiện", tone: "idle" };
}

function reasonLabel(reason) {
  return REASON_LABELS[reason] || reason;
}

function formatMs(ms) {
  const total = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m >= 3) return `${m} phút`;
  if (m > 0) return `${m} phút ${s} giây`;
  return `${s} giây`;
}

function formatRelative(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

function formatClock(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const time = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${day} · ${time}`;
}

const stats = computed(() => {
  const list = articles.value;
  const totalMs = list.reduce((sum, item) => sum + Number(item.total_reading_time_ms || 0), 0);
  const sessions = list.reduce((sum, item) => sum + Number(item.session_count || 0), 0);
  const domainSet = new Set(list.map((item) => item.domain).filter(Boolean));
  return {
    articles: list.length,
    minutes: Math.round(totalMs / 60000),
    domains: domainSet.size,
    sessions,
  };
});

const domains = computed(() => {
  const map = {};
  for (const item of articles.value) {
    const domain = item.domain || "unknown";
    map[domain] = (map[domain] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => ({ domain, count }));
});

const filteredArticles = computed(() => {
  const q = query.value.trim().toLowerCase();
  return articles.value.filter((item) => {
    if (domainFilter.value !== "all" && item.domain !== domainFilter.value) return false;
    if (!q) return true;
    return (
      String(item.title || "").toLowerCase().includes(q) ||
      String(item.domain || "").toLowerCase().includes(q) ||
      String(item.url || "").toLowerCase().includes(q)
    );
  });
});

const wordCount = computed(() => {
  const text = selected.value?.content || "";
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
});

async function loadArticles() {
  try {
    const res = await fetch(`${API}/api/articles`);
    const json = await res.json();
    articles.value = json.data || [];
    error.value = "";
    lastUpdated.value = new Date();
    if (selected.value) {
      const fresh = articles.value.find((item) => item.url === selected.value.url);
      if (fresh) selected.value = { ...selected.value, ...fresh };
    }
  } catch (e) {
    if (!articles.value.length) {
      error.value = "Không kết nối được server. Kiểm tra backend đang chạy ở cổng 3000.";
    }
  }
}

async function selectArticle(article) {
  selected.value = article;
  loading.value = true;
  summary.value = "";
  category.value = null;
  events.value = [];
  detailTab.value = "summary";

  try {
    const [evRes, sumRes, clsRes] = await Promise.all([
      fetch(`${API}/api/events?url=${encodeURIComponent(article.url)}`),
      fetch(`${API}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: article.title, content: article.content }),
      }),
      fetch(`${API}/api/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: article.title,
          content: article.content,
          url: article.url,
        }),
      }),
    ]);

    const evJson = await evRes.json();
    const sumJson = await sumRes.json();
    const clsJson = await clsRes.json();

    events.value = evJson.data || [];
    summary.value = sumJson.summary || "";
    category.value = clsJson;
  } catch (e) {
    events.value = [];
    summary.value = "";
    category.value = null;
  } finally {
    loading.value = false;
  }
}

function clearSelection() {
  selected.value = null;
  events.value = [];
  summary.value = "";
  category.value = null;
  detailTab.value = "summary";
}

function onStoryKey(event, article) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    selectArticle(article);
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
  <div class="shell" :class="{ reading: !!selected }">
    <header class="topbar">
      <button type="button" class="brand" @click="clearSelection">
        <div class="mark" aria-hidden="true">N</div>
        <div class="brand-copy">
          <h1>Newsroom</h1>
          <p>Reading Tracker</p>
        </div>
      </button>

      <div class="kpis" aria-label="Thống kê đọc">
        <div class="kpi">
          <span class="kpi-value">{{ stats.articles }}</span>
          <span class="kpi-label">Bài đã đọc</span>
        </div>
        <div class="kpi">
          <span class="kpi-value">{{ stats.minutes }}</span>
          <span class="kpi-label">Phút đọc</span>
        </div>
        <div class="kpi">
          <span class="kpi-value">{{ stats.domains }}</span>
          <span class="kpi-label">Nguồn</span>
        </div>
        <div class="kpi">
          <span class="kpi-value">{{ stats.sessions }}</span>
          <span class="kpi-label">Phiên</span>
        </div>
      </div>

      <div class="live" :class="{ off: !!error }">
        <span class="pulse" aria-hidden="true"></span>
        <div>
          <strong>{{ error ? "Mất kết nối" : "Đang theo dõi" }}</strong>
          <small>{{ error ? "Thử lại sau vài giây" : "Làm mới mỗi 4 giây" }}</small>
        </div>
      </div>
    </header>

    <div v-if="error" class="banner" role="alert">
      <span class="banner-dot"></span>
      {{ error }}
    </div>

    <main class="workspace">
      <aside class="rail">
        <div class="rail-head">
          <div>
            <h2>Bài đã đọc</h2>
            <p v-if="lastUpdated">Cập nhật {{ formatRelative(lastUpdated) }}</p>
          </div>
          <span class="count">{{ filteredArticles.length }}</span>
        </div>

        <label class="search">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M20 20l-3.2-3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <input v-model="query" type="search" placeholder="Tìm tiêu đề, nguồn, URL..." />
        </label>

        <div class="filters" role="tablist" aria-label="Lọc theo nguồn">
          <button
            type="button"
            class="chip"
            :class="{ on: domainFilter === 'all' }"
            @click="domainFilter = 'all'"
          >
            Tất cả
          </button>
          <button
            v-for="item in domains"
            :key="item.domain"
            type="button"
            class="chip"
            :class="{ on: domainFilter === item.domain }"
            @click="domainFilter = item.domain"
          >
            <i class="dot" :style="{ background: domainColor(item.domain) }"></i>
            {{ prettyDomain(item.domain) }}
            <em>{{ item.count }}</em>
          </button>
        </div>

        <div class="list" role="list">
          <article
            v-for="item in filteredArticles"
            :key="item.url"
            class="story"
            :class="{ on: selected?.url === item.url }"
            role="listitem"
            tabindex="0"
            @click="selectArticle(item)"
            @keydown="onStoryKey($event, item)"
          >
            <span class="accent" :style="{ background: domainColor(item.domain) }"></span>
            <h3>{{ item.title || "(Không có tiêu đề)" }}</h3>
            <div class="story-meta">
              <span>{{ prettyDomain(item.domain) }}</span>
              <span class="sep">·</span>
              <span>{{ formatMs(item.total_reading_time_ms) }}</span>
              <span class="sep">·</span>
              <span>{{ formatRelative(item.last_read_at) }}</span>
            </div>
          </article>

          <div v-if="filteredArticles.length === 0" class="list-empty">
            <p v-if="articles.length === 0">Chưa ghi nhận bài nào.</p>
            <p v-else>Không khớp bộ lọc hiện tại.</p>
          </div>
        </div>
      </aside>

      <section class="stage" v-if="selected">
        <button type="button" class="back" @click="clearSelection">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Tổng quan
        </button>

        <header class="story-head">
          <p class="kicker">
            <i class="dot" :style="{ background: domainColor(selected.domain) }"></i>
            {{ prettyDomain(selected.domain) }}
            <span v-if="selected.session_count"> · {{ selected.session_count }} phiên</span>
          </p>
          <h2>{{ selected.title }}</h2>
          <div class="chips">
            <span class="meta-chip">{{ formatMs(selected.total_reading_time_ms) }} đọc</span>
            <span v-if="wordCount" class="meta-chip">{{ wordCount.toLocaleString("vi-VN") }} từ</span>
            <span v-if="category" class="meta-chip cat" :data-cat="category.category">
              {{ categoryLabel(category.category) }}
              <small>{{ Math.round((category.confidence || 0) * 100) }}%</small>
            </span>
            <a class="meta-chip link" :href="selected.url" target="_blank" rel="noreferrer">
              Mở bài gốc
            </a>
          </div>
        </header>

        <nav class="tabs" aria-label="Phần chi tiết">
          <button type="button" :class="{ on: detailTab === 'summary' }" @click="detailTab = 'summary'">
            Tóm tắt
          </button>
          <button type="button" :class="{ on: detailTab === 'content' }" @click="detailTab = 'content'">
            Nội dung
          </button>
          <button type="button" :class="{ on: detailTab === 'timeline' }" @click="detailTab = 'timeline'">
            Timeline
            <em v-if="events.length">{{ events.length }}</em>
          </button>
        </nav>

        <div class="panel">
          <div v-if="detailTab === 'summary'" class="summary" :class="{ loading: loading && !summary }">
            <span class="summary-label">Tóm tắt AI</span>
            <p>{{ summary || (loading ? "Đang tạo tóm tắt..." : "Chưa có tóm tắt cho bài này.") }}</p>
          </div>

          <article v-else-if="detailTab === 'content'" class="article-body">
            <pre>{{ selected.content || "(Không có nội dung)" }}</pre>
          </article>

          <div v-else class="timeline-wrap">
            <p v-if="loading && events.length === 0" class="muted">Đang tải timeline...</p>
            <ol v-else-if="events.length > 0" class="timeline">
              <li v-for="ev in events" :key="ev.id">
                <span class="tl-dot" :data-tone="eventMeta(ev.event_type).tone"></span>
                <div class="tl-card">
                  <div class="tl-head">
                    <strong :data-tone="eventMeta(ev.event_type).tone">
                      {{ eventMeta(ev.event_type).label }}
                    </strong>
                    <time>{{ formatClock(ev.timestamp) }}</time>
                  </div>
                  <div class="tl-body">
                    <span v-if="ev.reason">{{ reasonLabel(ev.reason) }}</span>
                    <span>Tổng thời gian: {{ formatMs(ev.total_reading_time_ms) }}</span>
                  </div>
                </div>
              </li>
            </ol>
            <p v-else class="muted">Chưa có sự kiện nào được ghi nhận.</p>
          </div>
        </div>
      </section>

      <section class="stage overview" v-else>
        <div class="overview-copy">
          <p class="kicker">Tổng quan</p>
          <h2>Nhịp đọc của bạn</h2>
          <p>
            Chọn một bài bên trái để xem tóm tắt, nội dung gốc và timeline đọc.
            Dữ liệu tự làm mới khi bạn đọc báo.
          </p>
        </div>
        <ChartsPanel :articles="articles" />
      </section>
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 18px 20px 20px;
  gap: 16px;
}

.topbar {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr auto;
  align-items: center;
  gap: 20px;
  padding: 10px 6px 4px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.mark {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #f0d08a, #e2b657);
  color: #1a150d;
  font-weight: 700;
  font-size: 20px;
  box-shadow: 0 8px 20px rgba(226, 182, 87, 0.18);
}

.brand-copy h1 {
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.03em;
}

.brand-copy p {
  color: var(--text-muted);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.kpi {
  background: rgba(23, 26, 34, 0.72);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 10px 14px;
  min-width: 0;
}

.kpi-value {
  display: block;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.04em;
  line-height: 1.1;
}

.kpi-label {
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.live {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--live-soft);
}

.live.off {
  background: var(--danger-soft);
}

.live strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}

.live small {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
}

.pulse {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--live);
  box-shadow: 0 0 0 0 rgba(94, 224, 160, 0.7);
  animation: ping 1.8s ease-out infinite;
}

.live.off .pulse {
  background: var(--danger);
  animation: none;
}

@keyframes ping {
  70% { box-shadow: 0 0 0 8px rgba(94, 224, 160, 0); }
  100% { box-shadow: 0 0 0 0 rgba(94, 224, 160, 0); }
}

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--danger-soft);
  color: #fecaca;
  border: 1px solid rgba(240, 113, 103, 0.28);
  font-size: 14px;
}

.banner-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
}

.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 380px) 1fr;
  gap: 16px;
}

.rail,
.stage {
  min-height: 0;
  background: rgba(18, 20, 26, 0.78);
  border: 1px solid var(--line);
  border-radius: 22px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
}

.rail {
  display: flex;
  flex-direction: column;
  padding: 18px 16px 12px;
}

.rail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 0 6px 12px;
}

.rail-head h2 {
  font-size: 16px;
  font-weight: 600;
}

.rail-head p {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 2px;
}

.count {
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--gold-soft);
  color: var(--gold-2);
  font-size: 12px;
  font-weight: 650;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 2px 10px;
  padding: 0 12px;
  height: 42px;
  border-radius: 12px;
  background: var(--bg);
  border: 1px solid var(--line);
  color: var(--text-muted);
}

.search:focus-within {
  border-color: rgba(226, 182, 87, 0.45);
  color: var(--gold);
}

.search input {
  flex: 1;
  height: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
}

.filters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 0 2px 10px;
  scrollbar-width: none;
}

.filters::-webkit-scrollbar {
  display: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  color: var(--text-muted);
  white-space: nowrap;
  font-size: 12px;
  transition: 160ms ease;
}

.chip:hover,
.chip.on {
  color: var(--text);
  border-color: var(--line-strong);
}

.chip.on {
  background: var(--gold-soft);
  border-color: rgba(226, 182, 87, 0.3);
  color: var(--gold-2);
}

.chip em {
  font-style: normal;
  opacity: 0.7;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.story {
  position: relative;
  padding: 14px 14px 14px 18px;
  border-radius: 14px;
  background: var(--bg-card);
  border: 1px solid transparent;
  cursor: pointer;
  transition: 160ms ease;
}

.story:hover {
  border-color: var(--line-strong);
  transform: translateY(-1px);
}

.story.on {
  background: linear-gradient(180deg, rgba(226, 182, 87, 0.12), rgba(226, 182, 87, 0.04));
  border-color: rgba(226, 182, 87, 0.32);
}

.story:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}

.accent {
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 99px;
}

.story h3 {
  font-family: var(--font-serif);
  font-size: 16.5px;
  font-weight: 560;
  line-height: 1.35;
  letter-spacing: -0.015em;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.story-meta {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.sep {
  opacity: 0.5;
}

.list-empty {
  padding: 40px 12px;
  text-align: center;
  color: var(--text-muted);
}

.stage {
  padding: 22px 26px 24px;
  overflow: auto;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  margin-bottom: 14px;
  font-size: 13px;
}

.back:hover {
  color: var(--text);
}

.kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--gold-2);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
}

.story-head {
  max-width: 760px;
}

.story-head h2 {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: clamp(28px, 4vw, 44px);
  font-weight: 560;
  line-height: 1.16;
  letter-spacing: -0.028em;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  font-size: 12px;
  color: var(--text-muted);
  text-decoration: none;
}

.meta-chip.link {
  color: var(--gold-2);
  border-color: rgba(226, 182, 87, 0.28);
}

.meta-chip.link:hover {
  background: var(--gold-soft);
}

.meta-chip.cat {
  color: var(--text);
}

.meta-chip small {
  color: var(--text-dim);
}

.tabs {
  display: flex;
  gap: 6px;
  margin: 22px 0 16px;
  padding: 4px;
  width: fit-content;
  background: var(--bg);
  border-radius: 12px;
  border: 1px solid var(--line);
}

.tabs button {
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tabs button.on {
  background: var(--bg-card);
  color: var(--text);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);
}

.tabs em {
  font-style: normal;
  font-size: 11px;
  background: var(--gold-soft);
  color: var(--gold-2);
  border-radius: 99px;
  padding: 1px 6px;
}

.panel {
  max-width: 760px;
}

.summary {
  background: linear-gradient(180deg, #f7f0e3, #efe3cf);
  color: var(--paper-ink);
  border-radius: 18px;
  padding: 24px 26px 26px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.summary-label {
  display: block;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--paper-muted);
  font-weight: 650;
  font-family: var(--font-ui);
}

.summary p {
  margin-top: 10px;
  font-family: var(--font-serif);
  font-size: 22px;
  line-height: 1.52;
  font-weight: 450;
}

.summary.loading p {
  font-style: italic;
  opacity: 0.72;
}

.article-body pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: var(--font-serif);
  font-size: 18.5px;
  line-height: 1.72;
  font-weight: 430;
  color: #ddd6c8;
}

.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}

.timeline::before {
  content: "";
  position: absolute;
  left: 6px;
  top: 8px;
  bottom: 8px;
  width: 1px;
  background: var(--line-strong);
}

.timeline li {
  position: relative;
  padding: 0 0 16px 28px;
}

.timeline li:last-child {
  padding-bottom: 0;
}

.tl-dot {
  position: absolute;
  left: 2px;
  top: 10px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 0 4px var(--bg-raised);
}

.tl-dot[data-tone="active"] { background: var(--live); }
.tl-dot[data-tone="idle"] { background: #8b8680; }
.tl-dot[data-tone="leave"] { background: var(--danger); }

.tl-card {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 14px;
}

.tl-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.tl-head strong {
  font-size: 13px;
  font-weight: 650;
}

.tl-head strong[data-tone="enter"] { color: var(--gold-2); }
.tl-head strong[data-tone="active"] { color: var(--live); }
.tl-head strong[data-tone="leave"] { color: var(--danger); }

.tl-head time {
  color: var(--text-dim);
  font-size: 12px;
}

.tl-body {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--text-muted);
  font-size: 13px;
}

.muted {
  color: var(--text-muted);
}

.overview {
  display: flex;
  flex-direction: column;
  gap: 22px;
  justify-content: flex-start;
}

.overview-copy {
  max-width: 560px;
}

.overview-copy h2 {
  margin: 8px 0 10px;
  font-family: var(--font-serif);
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 560;
  letter-spacing: -0.03em;
  line-height: 1.14;
}

.overview-copy p:last-child {
  color: var(--text-muted);
  font-size: 15px;
  max-width: 46ch;
}

@media (max-width: 1100px) {
  .topbar {
    grid-template-columns: 1fr auto;
  }

  .kpis {
    grid-column: 1 / -1;
  }
}

@media (max-width: 960px) {
  .shell {
    padding: 12px;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .shell.reading .rail {
    display: none;
  }

  .shell:not(.reading) .overview {
    min-height: 0;
  }

  .stage {
    padding: 16px;
  }

  .story-head h2,
  .overview-copy h2 {
    font-size: 28px;
  }

  .summary p {
    font-size: 18px;
  }
}

@media (max-width: 640px) {
  .kpis {
    grid-template-columns: 1fr 1fr;
  }

  .live {
    display: none;
  }

  .topbar {
    grid-template-columns: 1fr;
  }
}
</style>
