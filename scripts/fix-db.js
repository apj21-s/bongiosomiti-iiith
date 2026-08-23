const fs = require('fs');
const dbFile = '/home/sagar/Desktop/bengali/bongiosomiti-iiith2/local_db.json';
const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));

const evt1 = data.events.find(e => e.id === 'evt-001');
if (evt1) {
  evt1.image_url = 'assets/mahalaya-bhoj.webp';
  evt1.category = 'Food & Dining';
  evt1.status = 'OPEN';
  evt1.created_at = evt1.created_at || '2026-08-10T20:10:46.594Z';
}

const evt2 = data.events.find(e => e.id === 'evt-002');
if (evt2) {
  evt2.image_url = 'assets/saraswati-puja.webp';
  evt2.category = 'Religious';
  evt2.status = 'OPEN';
  evt2.created_at = evt2.created_at || '2026-08-10T20:10:46.594Z';
}

fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
console.log('Fixed local_db.json');
