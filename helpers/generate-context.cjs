const fs = require('fs');
const path = require('path');

const helperDir = __dirname;
const rootDir = path.resolve(helperDir, '..');
const distDir = path.join(rootDir, 'dist');

// The specific root-level files we want to track for Dev Context
const devFiles = ['module.json', 'package.json', 'vite.config.js', 'src/style.css', 'tailwind.config.js', 'postcss.config.js'];

let devContent = "# 🛠️ Dev Context\n\n";
let distContent = "# 📦 Dist Source & Logic (Minified)\n\n";
let structure = "# 📂 Dist Folder Structure\n\n";

/**
 * Aggressive minification for LLM Context
 */
function minifyForAI(content, ext) {
    if (ext === '.json') {
        try { return JSON.stringify(JSON.parse(content)); } catch { return content; }
    }
    return content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/([^\\:]|^)\/\/.*$/gm, '$1') // Remove single-line comments
        .replace(/console\.log\(.*?\);?/g, '') // Remove console.logs
        .replace(/[ \t]+/g, ' ') // Collapse spaces
        .replace(/^\s*[\r\n]/gm, '') // Remove empty lines
        .trim();
}

// --- PART 1: DEV CONTEXT (Root Files) ---
console.log("🔍 Scanning Root Configs...");
for (const file of devFiles) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
        const ext = path.extname(file);
        const rawContent = fs.readFileSync(fullPath, 'utf8');
        devContent += `### ${file}\n\`\`\`${ext.replace('.', '')}\n${minifyForAI(rawContent, ext)}\n\`\`\`\n\n`;
    }
}

// --- PART 2: DIST CONTEXT (Bundled Output) ---
console.log("🚀 Scanning Dist Folder...");
function walkDist(currentDir) {
    if (!fs.existsSync(currentDir)) {
        console.warn(`⚠️  Warning: ${currentDir} does not exist. Did you run 'npm run build'?`);
        return;
    }

    const files = fs.readdirSync(currentDir);

    for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const relPath = path.relative(distDir, fullPath);

        // Skip binary assets entirely to save processing and tokens
        if (file.match(/\.(png|jpe?g|svg|webp|gif|woff2?|ttf|eot)$/i)) continue;

        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
            structure += `- dist/${relPath}/\n`;
            walkDist(fullPath);
        } else {
            const ext = path.extname(file);
            let rawContent = '';
            try {
                rawContent = fs.readFileSync(fullPath, 'utf8');
            } catch (e) {
                continue; 
            }

            const minified = minifyForAI(rawContent, ext);
            distContent += `### dist/${relPath}\n\`\`\`${ext.replace('.', '')}\n${minified}\n\`\`\`\n\n`;
        }
    }
}

walkDist(distDir);

// --- PART 3: WRITE FILES ---
try {
    fs.writeFileSync(path.join(helperDir, 'dev_context.md'), devContent);
    fs.writeFileSync(path.join(helperDir, 'dist_context.md'), distContent);
    fs.writeFileSync(path.join(helperDir, 'project_structure_context.md'), structure);
    console.log(`✅ Success! Context saved in /helpers`);
} catch (err) {
    console.error("❌ Write Error:", err.message);
}