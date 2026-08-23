const fs = require('fs')
const path = require('path')

const DB_FILE = path.join(process.cwd(), 'local_db.json')

if (fs.existsSync(DB_FILE)) {
  fs.unlinkSync(DB_FILE)
  console.log('Deleted existing local_db.json')
} else {
  console.log('No local_db.json found, skipping deletion.')
}

// Running initDB requires TypeScript, but we can just let the app generate it on next load,
// or we can write the default JSON here. For simplicity, just deleting it forces the app to recreate it.
console.log('Dummy database reset successfully! Restart your dev server or trigger an API request to recreate it.')
