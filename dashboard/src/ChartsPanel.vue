<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { Chart } from "chart.js/auto";

const props = defineProps({
  articles: { type: Array, default: () => [] },
});

const domainCanvas = ref(null);
const timeCanvas = ref(null);
let domainChart = null;
let timeChart = null;
let lastSnapshot = "";

const DOMAIN_COLORS = {
  "vnexpress.net": "#ff5a5f",
  "tuoitre.vn": "#f4a261",
  "dantri.com.vn": "#2ec4b6",
};

const DOMAIN_LABELS = {
  "vnexpress.net": "VnExpress",
  "tuoitre.vn": "Tuổi Trẻ",
  "dantri.com.vn": "Dân Trí",
};

const FALLBACK = ["#e2b657", "#7aa2ff", "#c084fc", "#fb923c", "#67e8f9", "#f07167"];

const hasData = computed(() => props.articles.length > 0);

const domainSlices = computed(() => {
  const map = {};
  for (const item of props.articles) {
    const domain = item.domain || "unknown";
    map[domain] = (map[domain] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count], index) => ({
      domain,
      count,
      label: labelForDomain(domain),
      color: colorForDomain(domain, index),
    }));
});

function colorForDomain(domain, index) {
  const key = String(domain || "")
    .replace(/^www\./, "")
    .toLowerCase();
  return DOMAIN_COLORS[key] || FALLBACK[index % FALLBACK.length];
}

function labelForDomain(domain) {
  const key = String(domain || "")
    .replace(/^www\./, "")
    .toLowerCase();
  return DOMAIN_LABELS[key] || domain || "Khác";
}

function snapshotOf(articles) {
  return JSON.stringify(
    articles.map((item) => [
      item.domain,
      (item.last_read_at || "").slice(0, 10),
      Math.round(Number(item.total_reading_time_ms || 0) / 60000),
    ])
  );
}

function collect() {
  const domainCount = {};
  const dayCount = {};

  for (const item of props.articles) {
    const domain = item.domain || "unknown";
    domainCount[domain] = (domainCount[domain] || 0) + 1;

    const day = (item.last_read_at || "").slice(0, 10);
    if (!day) continue;
    const minutes = Math.round(Number(item.total_reading_time_ms || 0) / 60000);
    dayCount[day] = (dayCount[day] || 0) + minutes;
  }

  const domainLabels = Object.keys(domainCount);
  const days = Object.keys(dayCount).sort();

  return {
    domainLabels: domainLabels.map(labelForDomain),
    domainValues: domainLabels.map((key) => domainCount[key]),
    domainColors: domainLabels.map((key, i) => colorForDomain(key, i)),
    dayLabels: days.map((day) => {
      const [, m, d] = day.split("-");
      return d && m ? `${d}/${m}` : day;
    }),
    dayValues: days.map((day) => dayCount[day]),
  };
}

const centerText = {
  id: "centerText",
  afterDraw(chart) {
    if (chart.config.type !== "doughnut") return;
    const values = chart.data.datasets[0]?.data || [];
    const total = values.reduce((sum, n) => sum + Number(n || 0), 0);
    const { ctx, chartArea } = chart;
    const x = (chartArea.left + chartArea.right) / 2;
    const y = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ece7dc";
    ctx.font = "600 22px 'Be Vietnam Pro', sans-serif";
    ctx.fillText(String(total), x, y - 8);
    ctx.fillStyle = "#9a9488";
    ctx.font = "400 11px 'Be Vietnam Pro', sans-serif";
    ctx.fillText("bài", x, y + 12);
    ctx.restore();
  },
};

function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 450, easing: "easeOutQuart" },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#9a9488",
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: "circle",
          padding: 14,
          font: { family: "Be Vietnam Pro, sans-serif", size: 11 },
        },
      },
      tooltip: {
        backgroundColor: "#12141a",
        borderColor: "rgba(236, 231, 220, 0.12)",
        borderWidth: 1,
        titleColor: "#ece7dc",
        bodyColor: "#ece7dc",
        padding: 10,
        displayColors: false,
      },
    },
  };
}

function buildCharts() {
  if (!hasData.value || !domainCanvas.value || !timeCanvas.value) {
    domainChart?.destroy();
    timeChart?.destroy();
    domainChart = null;
    timeChart = null;
    lastSnapshot = "";
    return;
  }

  const snap = snapshotOf(props.articles);
  const data = collect();

  if (domainChart && timeChart && snap === lastSnapshot) return;
  lastSnapshot = snap;

  const domainPayload = {
    labels: data.domainLabels,
    datasets: [
      {
        data: data.domainValues,
        backgroundColor: data.domainColors,
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  const timePayload = {
    labels: data.dayLabels,
    datasets: [
      {
        label: "Phút đọc",
        data: data.dayValues,
        backgroundColor: "rgba(226, 182, 87, 0.82)",
        hoverBackgroundColor: "#e2b657",
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 28,
      },
    ],
  };

  if (domainChart && timeChart) {
    domainChart.data = domainPayload;
    timeChart.data = timePayload;
    domainChart.update();
    timeChart.update();
    return;
  }

  domainChart?.destroy();
  timeChart?.destroy();

  domainChart = new Chart(domainCanvas.value, {
    type: "doughnut",
    data: domainPayload,
    plugins: [centerText],
    options: {
      ...baseOptions(),
      cutout: "72%",
      plugins: {
        ...baseOptions().plugins,
        legend: { display: false },
      },
    },
  });

  timeChart = new Chart(timeCanvas.value, {
    type: "bar",
    data: timePayload,
    options: {
      ...baseOptions(),
      plugins: {
        ...baseOptions().plugins,
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: "#9a9488", font: { family: "Be Vietnam Pro, sans-serif", size: 11 } },
          grid: { display: false },
          border: { color: "rgba(236, 231, 220, 0.08)" },
        },
        y: {
          beginAtZero: true,
          suggestedMax: Math.max(5, ...data.dayValues, 0),
          ticks: {
            color: "#9a9488",
            precision: 0,
            font: { family: "Be Vietnam Pro, sans-serif", size: 11 },
          },
          grid: { color: "rgba(236, 231, 220, 0.06)" },
          border: { display: false },
        },
      },
    },
  });
}

async function render() {
  await nextTick();
  buildCharts();
}

watch(() => props.articles, render, { deep: true });
onMounted(render);
onUnmounted(() => {
  domainChart?.destroy();
  timeChart?.destroy();
});
</script>

<template>
  <section class="charts" v-if="hasData">
    <div class="chart-card">
      <div class="chart-head">
        <h3>Nguồn đọc</h3>
        <p>Tỷ lệ bài theo domain</p>
      </div>
      <div class="doughnut-layout">
        <div class="chart-box doughnut">
          <canvas ref="domainCanvas"></canvas>
        </div>
        <ul class="legend">
          <li v-for="slice in domainSlices" :key="slice.domain">
            <i :style="{ background: slice.color }"></i>
            <span>{{ slice.label }}</span>
            <em>{{ slice.count }}</em>
          </li>
        </ul>
      </div>
    </div>
    <div class="chart-card">
      <div class="chart-head">
        <h3>Nhịp đọc</h3>
        <p>Tổng phút theo ngày</p>
      </div>
      <div class="chart-box">
        <canvas ref="timeCanvas"></canvas>
      </div>
    </div>
  </section>
  <section v-else class="charts-empty">
    <p>Chưa có dữ liệu để vẽ biểu đồ.</p>
    <span>Đọc một bài báo được theo dõi, dashboard sẽ hiện nhịp đọc tại đây.</span>
  </section>
</template>

<style scoped>
.charts {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 16px;
}

.chart-card {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px 18px 12px;
  min-height: 280px;
}

.chart-head h3 {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.chart-head p {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.chart-box {
  height: 220px;
  margin-top: 8px;
}

.doughnut-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px;
  align-items: center;
  gap: 8px;
}

.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend li {
  display: grid;
  grid-template-columns: 8px 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend span {
  color: var(--text);
}

.legend em {
  font-style: normal;
  color: var(--text-dim);
}

.charts-empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  justify-content: center;
  min-height: 220px;
  padding: 28px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  color: var(--text-muted);
  background: rgba(23, 26, 34, 0.4);
}

.charts-empty p {
  color: var(--text);
  font-weight: 500;
}

.charts-empty span {
  font-size: 13px;
}

@media (max-width: 960px) {
  .charts {
    grid-template-columns: 1fr;
  }

  .chart-card {
    min-height: 0;
  }

  .doughnut-layout {
    grid-template-columns: minmax(0, 1fr) 120px;
  }
}
</style>
