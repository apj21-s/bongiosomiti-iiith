import fs from 'fs';

const filePath = '/run/media/arco/Windows/Users/arka2/mahalaya/bongiosomiti-iiith/utils/email.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove css overrides
content = content.replace(/ *\.bg-parchment \{ background-color: #F5EBD8 !important; \}\n/, '');
content = content.replace(/ *\.bg-panel \{ background-color: #FFF8EA !important; \}\n/, '');

// 2. Remove body background
content = content.replace(/background-color: #F5EBD8;" bgcolor="#F5EBD8"/g, '\"');

// 3. Remove outer table background
content = content.replace(/style="background-color: #F5EBD8;" bgcolor="#F5EBD8"/g, '');

// 4. Remove inner table background
content = content.replace(/background-color: #F5EBD8; /g, '');
content = content.replace(/ bgcolor="#F5EBD8"/g, '');

// 5. Remove panel backgrounds
content = content.replace(/background-color: #FFF8EA; /g, '');
content = content.replace(/ bgcolor="#FFF8EA"/g, '');

// 6. Remove white backgrounds
content = content.replace(/background-color: #ffffff; /g, '');

fs.writeFileSync(filePath, content);
