const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME, // Correctly referencing DB_NAME from .env
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

console.log("PostgreSQL Pool Initialized for DB:", process.env.DB_NAME);

module.exports = pool;
