// reset.js - clears the JSON "database" to an empty state
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const empty = { users: [], posts: [] };

try {
  fs.writeFileSync(DATA_FILE, JSON.stringify(empty, null, 2));
  console.log('data.json reset to empty database.');
} catch (e) {
  console.error('failed to reset database:', e);
}
