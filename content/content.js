(function () {
  "use strict";

  console.log("%c[Tracker] content.js đã được inject!", "color: #2196f3; font-weight: bold;");

  const url = window.location.href;
  // Check bài viết hợp lệ
  if (!isTrackedArticle(url)) {
    return;
  }

  // Lấy thông tin site
  const site = getSiteInfo(url);
  const title = document.title.trim();
  const domain = site ? site.domain : new URL(url).hostname;

  function extractContent(site) {
    if (!site || !site.contentSelectors) return "";
    for(const selector of site.contentSelectors) {
        const el = document.querySelector(selector);
        if(el) {
            const clone = el.cloneNode(true);
            clone.querySelectorAll(
                "script, style, iframe, .ads, .advertisement, .box-tinlienquan, .related-news"
            ).forEach(node => node.remove());

            const text = clone.innerText
                .trim()
                .replace(/\n{3,}/g, "\n\n");

            if(text.length > 150) {
                return text;
            }
        }
    }
    return "";
  }

  const content = extractContent(site);
  const sessionId = crypto.randomUUID();

  let isActive = false;
  let lastActivityTime = Date.now();
  let totalReadingTime = 0;          
  let activeStartTime = null;
  const IDLE_TIMEOUT = 30 * 1000;

  //Tạo event
  function createEvent(eventType, extra = {}) {
    return {
        event_type: eventType,
        url,
        domain,
        title,
        content,
        content_length: content.length,
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        total_reading_time_ms: totalReadingTime,
        ...extra
    };
  }

  function emit(eventType, extra = {}) {
    // Cộng thời gian nếu đang active
    if (isActive && activeStartTime) {
        totalReadingTime += Date.now() - activeStartTime;
        activeStartTime = Date.now();
    }

    const event = createEvent(eventType, extra);

    console.log(`%c[Tracker] ${eventType}`, "color: #00c853; font-weight: bold;");
    console.log(event);
  }

  emit("PAGE_ENTER");

  // Nếu đang mở tab (visivle) -> chuyển sang ACTIVE
  if (document.visibilityState === "visible") {
    isActive = true;
    activeStartTime = Date.now();
    emit("PAGE_ACTIVE");
  }

  // 1. Chuyển tab (PAGE_INACTIVE)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (!isActive) {
        isActive = true;
        activeStartTime = Date.now();
        emit("PAGE_ACTIVE");
      }
      lastActivityTime = Date.now();
    } else {
      if (isActive && activeStartTime) {
        totalReadingTime += Date.now() - activeStartTime;
        activeStartTime = null;
      }
      isActive = false;
      emit("PAGE_INACTIVE", { reason: "visibility_hidden" });
    }
  });

  // 2. Chuyển trạng thái nếu không ở trang đọc báo nữa (PAGE_INACTIVE)
  window.addEventListener("focus", () => {
    if (!isActive && document.visibilityState === "visible") {
      isActive = true;
      activeStartTime = Date.now();
      emit("PAGE_ACTIVE");
    }
    lastActivityTime = Date.now();
  });

  window.addEventListener("blur", () => {
    if (isActive && activeStartTime) {
      totalReadingTime += Date.now() - activeStartTime;
      activeStartTime = null;
    }
    isActive = false;
    emit("PAGE_INACTIVE", { reason: "window_blur" });
  });

  // 3. Mở trang báo nma không đọc (PAGE_INACTIVE)
  const activityEvents = ["mousemove", "scroll", "keydown", "click", "touchstart"];
  activityEvents.forEach(evt => {
    window.addEventListener(evt, () => {
      lastActivityTime = Date.now();
      if (!isActive && document.visibilityState === "visible") {
        isActive = true;
        activeStartTime = Date.now();
        emit("PAGE_ACTIVE");
      }
    }, { passive: true });
  });

  setInterval(() => {
    if (isActive && Date.now() - lastActivityTime > IDLE_TIMEOUT) {
      if(activeStartTime) {
        totalReadingTime += Date.now() - activeStartTime;
        activeStartTime = null;
      }
      isActive = false;
      emit("PAGE_INACTIVE", { reason: "idle" });
    }
  }, 5000);

  // Check có đóng tab, reload không (PAGE_LEAVE)
  window.addEventListener("pagehide", () => {
    emit("PAGE_LEAVE");
  });

  window.addEventListener("beforeunload", () => {
    emit("PAGE_LEAVE");
  });


})();