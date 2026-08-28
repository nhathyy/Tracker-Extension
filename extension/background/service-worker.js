const API_URL = "http://localhost:3000/api/events";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "TRACKER_EVENT") return;

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.event),
  })
    .then(async (res) => {
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = { raw: text };
      }
      console.log("[Tracker] Server response:", res.status, data);
      sendResponse({ ok: res.ok, status: res.status, data });
    })
    .catch((err) => {
      console.error("[Tracker] Fetch error:", err);
      sendResponse({ ok: false, error: err.message });
    });

  return true;
});