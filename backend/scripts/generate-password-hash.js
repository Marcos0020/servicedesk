/**
 * Utility script: generate a bcrypt hash for a password.
 *
 * Usage:
 *   node scripts/generate-password-hash.js "YourPassword123!"
 *
 * Useful for manually resetting a user's password_hash in the database
 * or seeding the initial admin user (see database/schema.sql).
 */
const bcrypt = require('bcrypt');

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error('Usage: node scripts/generate-password-hash.js "YourPassword123!"');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  console.log('\nBcrypt hash (rounds=12):');
  console.log(hash);
  console.log('\nExample SQL to update a user:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'user@example.com';\nCOMMIT;`);
}

main();
