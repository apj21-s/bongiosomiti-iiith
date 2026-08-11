const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = 'C:/Users/arka2/.gemini/antigravity-ide/brain/1dc2b8fd-e52e-4244-b9fc-8381bc24f95c/media__1786452856623.png';
const assetsDir = path.join(__dirname, '../assets');

async function processImage() {
  const metadata = await sharp(inputPath).metadata();
  console.log('Input Image Metadata:', metadata.width, 'x', metadata.height);

  const { width, height } = metadata;
  const colWidth = Math.floor(width / 3);

  // 1. Left Card: Pushpanjali & Vedic Puja
  await sharp(inputPath)
    .extract({ left: 0, top: 0, width: colWidth, height: height })
    .png({ quality: 95 })
    .toFile(path.join(assetsDir, 'saraswati-card-pushpanjali.png'));
  console.log('Saved saraswati-card-pushpanjali.png');

  // 2. Middle Card: Khichuri Prosad
  await sharp(inputPath)
    .extract({ left: colWidth, top: 0, width: colWidth, height: height })
    .png({ quality: 95 })
    .toFile(path.join(assetsDir, 'saraswati-card-khichuri.png'));
  console.log('Saved saraswati-card-khichuri.png');

  // 3. Right Card: Sandhya Aarti & Adda
  await sharp(inputPath)
    .extract({ left: colWidth * 2, top: 0, width: width - (colWidth * 2), height: height })
    .png({ quality: 95 })
    .toFile(path.join(assetsDir, 'saraswati-card-adda.png'));
  console.log('Saved saraswati-card-adda.png');

  console.log('All 3 Saraswati Puja Schedule Cards cropped and saved successfully!');
}

processImage().catch(console.error);
