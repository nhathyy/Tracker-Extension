const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  port: 3306,
  user: "tracker",
  password: "123456",
  database: "tracker",
  waitForConnections: true,
  connectionLimit: 10,
});

async function initDb() {
  const [rows] = await pool.query("SELECT 1 AS ok");
  console.log("MySQL connected:", rows[0]);
}

module.exports = { pool, initDb };