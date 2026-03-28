import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
// STRICT PATH: It will ONLY look in the /languages/ folder now.
const LOCALE_FILE_PATH = path.join(process.cwd(), 'languages', 'en.json');
const TEMPLATES_DIR = path.join(process.cwd(), 'templates');
const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');

// Regex to find Handlebars {{localize "KEY"}} and {{localize 'KEY'}}
const HBS_REGEX = /\{\{\s*localize\s+['"]([^'"]+)['"]\s*\}\}/g;

// Regex to find JS game.i18n.localize("KEY") and game.i18n.localize('KEY')
const JS_REGEX = /game\.i18n\.localize\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Recursively flattens a nested JSON object into dot-notation strings.
 */
function flattenObject(ob, prefix = '', result = {}) {
    for (const i in ob) {
        if (Object.prototype.hasOwnProperty.call(ob, i)) {
            if (typeof ob[i] === 'object' && ob[i] !== null && !Array.isArray(ob[i])) {
                flattenObject(ob[i], prefix + i + '.', result);
            } else {
                result[prefix + i] = ob[i];
            }
        }
    }
    return result;
}

/**
 * Recursively gets all files in a directory with a specific extension.
 */
function getFilesRecursive(dir, extensions, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        if (stat.isDirectory()) {
            getFilesRecursive(filepath, extensions, fileList);
        } else if (extensions.some(ext => file.endsWith(ext))) {
            fileList.push(filepath);
        }
    }
    return fileList;
}

/**
 * Main execution function
 */
function runCheck() {
    console.log('🔍 Starting Localization Check...\n');
    
    // Explicitly print the exact file path it is trying to read
    console.log(`📁 Reading locale file from: ${LOCALE_FILE_PATH}`);

    // 1. Load and parse the language file (No Fallbacks!)
    if (!fs.existsSync(LOCALE_FILE_PATH)) {
        console.error(`\n❌ ERROR: Cannot find locale file exactly at ${LOCALE_FILE_PATH}`);
        console.error(`Please make sure your en.json is inside the 'languages' folder!`);
        return;
    }

    const rawLocaleData = JSON.parse(fs.readFileSync(LOCALE_FILE_PATH, 'utf8'));
    const flatLocales = flattenObject(rawLocaleData);
    const definedKeys = new Set(Object.keys(flatLocales));
    console.log(`✅ Loaded ${definedKeys.size} translation keys from en.json.`);

    // 2. Gather all files to check
    const templateFiles = getFilesRecursive(TEMPLATES_DIR, ['.html', '.hbs']);
    const scriptFiles = getFilesRecursive(SCRIPTS_DIR, ['.js', '.mjs']);
    
    const usedKeys = new Map(); // Tracks key -> array of files it was found in

    // Helper to process files
    const processFiles = (files, regex) => {
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            let match;
            while ((match = regex.exec(content)) !== null) {
                const key = match[1];
                if (!usedKeys.has(key)) usedKeys.set(key, new Set());
                usedKeys.get(key).add(path.basename(file));
            }
        }
    };

    // 3. Scan files
    processFiles(templateFiles, HBS_REGEX);
    processFiles(scriptFiles, JS_REGEX);

    console.log(`✅ Scanned ${templateFiles.length} templates and ${scriptFiles.length} scripts.`);
    console.log(`✅ Found ${usedKeys.size} unique localization keys used in code.\n`);

    // 4. Compare
    const missingKeys = [];
    const unusedKeys = [];

    // Check for missing keys (used in code, not in JSON)
    for (const [key, files] of usedKeys.entries()) {
        if (!definedKeys.has(key)) {
            // Ignore dynamic keys that contain variables (e.g., concatenations that regex picked up weirdly)
            // AND explicitly ignore SR5 core keys so they don't bloat the missing list!
            if (!key.includes('${') && !key.includes(' ') && !key.endsWith('.') && !key.startsWith('SR5.')) {
                 missingKeys.push({ key, files: Array.from(files).join(', ') });
            }
        }
    }

    // Check for unused keys (in JSON, not used in code)
    for (const key of definedKeys) {
        if (!usedKeys.has(key)) {
            unusedKeys.push(key);
        }
    }

    // 5. Print Results
    if (missingKeys.length > 0) {
        console.log('🚨 MISSING LOCALIZATIONS (Found in code, missing in en.json):');
        console.log('--------------------------------------------------------------');
        missingKeys.forEach(({ key, files }) => {
            console.log(`❌ "${key}"`);
            console.log(`   └─ Used in: ${files}`);
        });
        console.log('');
    } else {
        console.log('🎉 No missing localizations found! Great job!\n');
    }

    if (unusedKeys.length > 0) {
        console.log('⚠️  POTENTIALLY UNUSED LOCALIZATIONS (In en.json, not found in code via static regex):');
        console.log('--------------------------------------------------------------------------------------');
        console.log('Note: These might be used dynamically (e.g., game.i18n.localize("Key." + var)). Do not delete blindly!');
        unusedKeys.forEach(key => console.log(` - "${key}"`));
    }
}

runCheck();