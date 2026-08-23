const fs = require('fs');
const glob = require('glob'); // Not available by default, use recursive readdir

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

    // Fix params in route handlers and pages
    if (content.includes('{ params }: { params: {') || content.includes('{ params }: { params: any }')) {
        content = content.replace(/{ params }: { params: ({ [^}]+ }) }/g, (match, p1) => {
            return `{ params }: { params: Promise<${p1}> }`;
        });
        
        // Find what the param name is, typically `slug`, `token`, `id`
        // Inject `const { slug } = await params;` etc.
        if (content.includes('params.slug')) {
            content = content.replace(/\{ params \}: \{ params: Promise<\{ slug: string;? \}> \}\n\) \{/g, 
                `{ params }: { params: Promise<{ slug: string }> }\n) {\n  const { slug } = await params;`);
            content = content.replace(/params\.slug/g, 'slug');
            changed = true;
        }
        if (content.includes('params.token')) {
            content = content.replace(/\{ params \}: \{ params: Promise<\{ token: string;? \}> \}\n\) \{/g, 
                `{ params }: { params: Promise<{ token: string }> }\n) {\n  const { token } = await params;`);
            content = content.replace(/params\.token/g, 'token');
            changed = true;
        }
        if (content.includes('params.id')) {
            content = content.replace(/\{ params \}: \{ params: Promise<\{ id: string;? \}> \}\n\) \{/g, 
                `{ params }: { params: Promise<{ id: string }> }\n) {\n  const { id } = await params;`);
            content = content.replace(/params\.id/g, 'id');
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(file, content);
        console.log('Fixed params in ' + file);
    }
});

