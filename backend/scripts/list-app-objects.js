/**
 * Utility script: list application-owned tables, views and triggers,
 * filtering out common Oracle system-generated object prefixes.
 *
 * Reads connection info from environment variables (see .env.example) —
 * never hardcode credentials in this file.
 *
 * Usage:
 *   ORACLE_USER=... ORACLE_PASSWORD=... ORACLE_CONNECTION_STRING=... \
 *     node scripts/list-app-objects.js
 */
require('dotenv').config();
const oracledb = require('oracledb');

const SYSTEM_PREFIXES = ['AQ$', 'LOGMNR', 'LOGSTDBY$', 'MVIEW_', 'SCHEDULER_', 'PRODUCT_PRIVS', 'HELP'];

function isAppObject(name) {
  return !SYSTEM_PREFIXES.some((p) => name.startsWith(p));
}

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING,
  });

  try {
    const owner = process.env.ORACLE_USER.toUpperCase();

    const tabs = await conn.execute(
      `SELECT table_name FROM all_tables WHERE owner = :owner ORDER BY table_name`,
      { owner },
    );
    console.log('=== APPLICATION TABLES ===');
    console.log(tabs.rows.flat().filter(isAppObject).join('\n'));

    const views = await conn.execute(
      `SELECT view_name FROM all_views WHERE owner = :owner ORDER BY view_name`,
      { owner },
    );
    console.log('\n=== APPLICATION VIEWS ===');
    console.log(views.rows.flat().filter(isAppObject).join('\n'));

    const trigs = await conn.execute(
      `SELECT trigger_name FROM all_triggers WHERE owner = :owner ORDER BY trigger_name`,
      { owner },
    );
    console.log('\n=== APPLICATION TRIGGERS ===');
    console.log(trigs.rows.flat().join('\n'));
  } finally {
    await conn.close();
  }
}

main().catch(console.error);
