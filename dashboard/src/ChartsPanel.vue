<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { Chart } from "chart.js/auto";

const props = defineProps({
  articles: { type: Array, default: () => [] },
});

const domainCanvas = ref(null);
const timeCanvas = ref(null);
let domainChart = null;
let timeChart = null;

function buildCharts() {
  const domainCount = {};
  const dayCount = {};

  for (const item of props.articles) {
    const domain = item.domain || "unknown";
    domainCount[domain] = (domainCount[domain] || 0) + 1;

    const day = (item.last_read_at || "").slice(0, 10) || "unknown";
    const minutes = Math.round((item.total_reading_time_ms || 0) / 60000);
    dayCount[day] = (dayCount[day] || 0) + minutes;
  }

  if (domainChart) domainChart.destroy();
  if (timeChart) timeChart.destroy();

  domainChart = new Chart(domainCanvas.value, {
    type: "doughnut",
    data: {
      labels: Object.keys(domainCount),
      datasets: [{ data: Object.values(domainCount) }],
    },
    options: {
      plugins: { legend: { labels: { color: "#e2e8f0" } } },
    },
  });

  timeChart = new Chart(timeCanvas.value, {
    type: "bar",
    data: {
      labels: Object.keys(dayCount),
      datasets: [{ label: "Phút đọc", data: Object.values(dayCount) }],
    },
    options: {
      plugins: { legend: { labels: { color: "#e2e8f0" } } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
      },
    },
  });
}

watch(() => props.articles, buildCharts, { deep: true });
onMounted(buildCharts);
onUnmounted(() => {
  domainChart?.destroy();
  timeChart?.destroy();
});
</script>

<template>
  <section class="charts">
    <div>
      <h3>Phân bổ domain</h3>
      <canvas ref="domainCanvas"></canvas>
    </div>
    <div>
      <h3>Thời gian đọc theo ngày (phút)</h3>
      <canvas ref="timeCanvas"></canvas>
    </div>
  </section>
</template>

<style scoped>
.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 20px 0;
}
.charts > div {
  background: #1e293b;
  border-radius: 12px;
  padding: 16px;
}
h3 { margin: 0 0 12px; }
</style>