const fs = require('fs');
const path = require('path');
const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'others', 'pujas-raw-65-finalversion-1.json'), 'utf8'));

let sql = `INSERT INTO puja_locations (name, address, lat, lng, status, sort_order) VALUES\n`;
const values = [];

raw.forEach((puja, i) => {
    const name = puja.puja.replace(/'/g, "''");
    const address = puja.venue.replace(/'/g, "''");
    const lat = puja.lat;
    const lng = puja.lng;
    const status = puja.status || 'active';
    values.push(`('${name}', '${address}', ${lat}, ${lng}, '${status}', ${i})`);
});

sql += values.join(',\n') + `\nON CONFLICT (lower(name), round(lat::numeric, 6), round(lng::numeric, 6)) DO NOTHING;`;

fs.writeFileSync('prod_seed_pujas.sql', sql);
