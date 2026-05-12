const sql = require('mssql');
require('dotenv').config();

const config = {
  server: 'localhost',
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  port: 1433,
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('[SQL Server] Connected successfully');
    return pool;
  })
  .catch(err => {
    console.error('[SQL Server] Connection failed:', err.message);
    return null;
  });

module.exports = { sql, poolPromise };