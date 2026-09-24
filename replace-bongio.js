const fs = require('fs');
const path = require('path');

const directories = ['app', 'components', 'durga-puja-hyderabad', 'public'];

function replaceInFile(filePath) {
    if (filePath.match(/\.(jpg|jpeg|png|webp|svg|ico|gif|mp4)$/i)) return; // Skip media files
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/BONGIO/g, 'BANGIYA');
    content = content.replace(/Bongio/g, 'Bangiya');
    content = content.replace(/bongio/g, 'bangiya');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated:', filePath);
    }
}

function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else {
            replaceInFile(fullPath);
        }
    }
}

for (const dir of directories) {
    if (fs.existsSync(dir)) {
        processDirectory(dir);
    }
}

console.log('Done.');
