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