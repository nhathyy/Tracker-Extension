require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { pool, initDb } = require("./db");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get('/', (req, res) => {
  res.json({ status: "ok", massage: "Tracker Server is running" });
});

app.post("/api/events", async (req, res) => {
    try {
        const event = req.body;

        if(!event.event_type || !event.url || !event.session_id || !event.timestamp) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: event_type, url, session_id, timestamp",
            });
        }

        const [result] = await pool.query(
            `INSERT INTO events
                (event_type, url, domain, title, content, content_length,
                session_id, timestamp, total_reading_time_ms, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                event.event_type,
                event.url,
                event.domain || null,
                event.title || null,
                event.content || null,
                event.content_length || 0,
                event.session_id,
                event.timestamp,
                event.total_reading_time_ms || 0,
                event.reason || null,
            ]
        );
        
        res.status(201).json({
            success: true,
            id: result.insertId,
            message: "Event saved",
        });
    } catch(err) {
        console.error("POST /api/events error: ", err);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

app.get("/api/events", async (req, res) => {
  try {
    const { session_id, url } = req.query;
    let sql = "SELECT * FROM events WHERE 1=1";
    const params = [];

    if (session_id) {
      sql += " AND session_id = ?";
      params.push(session_id);
    }
    if (url) {
      sql += " AND url = ?";
      params.push(url);
    }

    sql += " ORDER BY timestamp ASC LIMIT 500";
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET /api/events error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/sessions", async (req, res) => {
  try {
    const [sessions] = await pool.query(`
      SELECT
        session_id,
        url,
        domain,
        title,
        MIN(timestamp) AS start_time,
        MAX(timestamp) AS end_time,
        MAX(total_reading_time_ms) AS total_reading_time_ms,
        COUNT(*) AS event_count
      FROM events
      GROUP BY session_id, url, domain, title
      ORDER BY start_time DESC
      LIMIT 100
    `);

    res.json({ success: true, data: sessions });
  } catch (err) {
    console.error("GET /api/sessions error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/articles", async (req, res) => {
  try {
    const [articles] = await pool.query(`
      SELECT
        url,
        domain,
        title,
        content,
        content_length,
        MAX(total_reading_time_ms) AS total_reading_time_ms,
        COUNT(DISTINCT session_id) AS session_count,
        MIN(timestamp) AS first_read_at,
        MAX(timestamp) AS last_read_at
      FROM events
      WHERE event_type = 'PAGE_ENTER'
      GROUP BY url, domain, title, content, content_length
      ORDER BY last_read_at DESC
      LIMIT 100
    `);

    res.json({ success: true, data: articles });
  } catch (err) {
    console.error("GET /api/articles error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

function fallbackSummarize(title, content) {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  if (!text) return title || "";
  const parts = text.split(/(?<=[.!?…])\s+/).filter((s) => s.length > 20);
  return (parts.length ? parts : [text]).slice(0, 4).join(" ");
}

async function summarizeWithGemini(title, content) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const bodyText = String(content || "").slice(0, 8000);
  const prompt = `Tóm tắt bài báo tiếng Việt thành 3 đến 5 câu.
Chỉ dùng thông tin có trong tiêu đề và nội dung bên dưới.
Không thêm thông tin không xuất hiện trong bài.
Không viết lời dẫn kiểu "Bài báo này nói về".

Tiêu đề: ${title || ""}

Nội dung:
${bodyText}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 400,
        },
      }),
    }
  );

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!res.ok || !text) {
    console.error("Gemini error:", data);
    throw new Error("Gemini summarize failed");
  }
  return text;
}

app.post("/api/summarize", async (req, res) => {
  try {
    const { title, content } = req.body || {};
    if (!content && !title) {
      return res.status(400).json({ success: false, message: "Missing content" });
    }

    try {
      const summary = await summarizeWithGemini(title, content);
      return res.json({ success: true, summary, provider: "gemini" });
    } catch (err) {
      console.error("AI summarize fallback:", err.message);
      const summary = fallbackSummarize(title, content);
      return res.json({ success: true, summary, provider: "extractive" });
    }
  } catch (err) {
    console.error("POST /api/summarize error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

const DANTRI_CATEGORY_MAP = {
  "cong-nghe": "Technology",
  "khoa-hoc": "Technology",
  "o-to-xe-may": "Technology",
  "kinh-doanh": "Economy",
  "bat-dong-san": "Economy",
  "lao-dong-viec-lam": "Economy",
  "thoi-su": "Politics",
  "phap-luat": "Politics",
  "noi-vu": "Politics",
  "the-gioi": "Politics",
  "the-thao": "Sports",
  "giao-duc": "Education",
  "suc-khoe": "Health",
  "giai-tri": "Entertainment",
  "du-lich": "Entertainment",
  "doi-song": "Entertainment",
  "tinh-yeu-gioi-tinh": "Entertainment",
  "tam-long-nhan-ai": "Others",
};

const CATEGORY_RULES = [
  { category: "Technology", keywords: ["công nghệ", "trí tuệ nhân tạo", "phần mềm", "robot", "bán dẫn", "internet"] },
  { category: "Economy", keywords: ["kinh tế", "chứng khoán", "ngân hàng", "lạm phát", "đầu tư", "doanh nghiệp"] },
  { category: "Politics", keywords: ["chính phủ", "quốc hội", "ngoại giao", "nghị quyết", "chính trị"] },
  { category: "Sports", keywords: ["bóng đá", "world cup", "sea games", "thể thao", "huấn luyện viên"] },
  { category: "Education", keywords: ["giáo dục", "học sinh", "sinh viên", "kỳ thi", "giáo viên", "bộ giáo dục"] },
  { category: "Health", keywords: ["y tế", "bệnh viện", "sức khỏe", "vaccine", "bác sĩ"] },
  { category: "Entertainment", keywords: ["giải trí", "showbiz", "ca sĩ", "diễn viên", "âm nhạc"] },
];

const OTHER_HINTS = ["lũ", "lũ quét", "sạt lở", "thiên tai", "động đất", "bão", "mưa lớn"];

function countHits(text, keywords) {
  return keywords.reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0);
}

function classifyFromDantriUrl(url) {
  const match = String(url || "").match(/dantri\.com\.vn\/([^/]+)\//i);
  if (!match) return null;

  const slug = match[1].toLowerCase();
  const category = DANTRI_CATEGORY_MAP[slug] || "Others";

  return {
    category,
    confidence: DANTRI_CATEGORY_MAP[slug] ? 0.99 : 0.8,
    source: slug,
  };
}

function classifyByKeywords(title, content) {
  const titleText = String(title || "").toLowerCase();
  const bodyText = String(content || "").toLowerCase();
  const all = `${titleText} ${bodyText}`;

  let best = { category: "Others", score: 0 };

  for (const rule of CATEGORY_RULES) {
    const score =
      countHits(titleText, rule.keywords) * 3 +
      countHits(bodyText, rule.keywords);
    if (score > best.score) {
      best = { category: rule.category, score };
    }
  }

  const otherScore = countHits(all, OTHER_HINTS) * 2;
  if (otherScore >= best.score) {
    return {
      category: "Others",
      confidence: Number(Math.min(0.9, 0.5 + otherScore * 0.1).toFixed(2)),
    };
  }

  if (best.score === 0) {
    return { category: "Others", confidence: 0.4 };
  }

  return {
    category: best.category,
    confidence: Number(Math.min(0.95, 0.45 + best.score * 0.1).toFixed(2)),
  };
}

function classifyArticle(title, content, url) {
  const fromUrl = classifyFromDantriUrl(url);
  if (fromUrl) return fromUrl;
  return classifyByKeywords(title, content);
}

app.post("/api/classify", (req, res) => {
  const { title, content, url } = req.body || {};
  res.json({ success: true, ...classifyArticle(title, content, url) });
});

async function start() {
    await initDb();
    app.listen(PORT, () => {
        console.log(`Tracker Server running at http://localhost:${PORT}`);
    });
}

start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});