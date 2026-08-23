const fs = require('fs');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./app');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (content.includes('createClient()') && !content.includes('await createClient()')) {
        content = content.replace(/createClient\(\)/g, 'await createClient()');
        changed = true;
    }
    
    if (content.includes('createServiceRoleClient()') && !content.includes('await createServiceRoleClient()')) {
        content = content.replace(/createServiceRoleClient\(\)/g, 'await createServiceRoleClient()');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content);
        console.log('Fixed await in ' + file);
    }
});

