import fs from 'fs';
import path from 'path';

function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] instanceof Object && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

const LANGUAGES_DIR = path.join(process.cwd(), 'languages');
const FILES_TO_PROCESS = [
    { target: 'en.json', source: 'new_en.json' },
    { target: 'de.json', source: 'new_de.json' }
];

function runMerge() {
    console.log('🚀 Starting deep merge of localization files...');

    FILES_TO_PROCESS.forEach(({ target, source }) => {
        const targetPath = path.join(LANGUAGES_DIR, target);
        const sourcePath = path.join(process.cwd(), source);

        if (!fs.existsSync(targetPath)) return console.error(`❌ Target file missing: ${targetPath}`);
        if (!fs.existsSync(sourcePath)) return console.error(`❌ Source file missing: ${sourcePath}`);

        try {
            const targetData = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
            const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

            const merged = deepMerge(targetData, sourceData);

            // Sort alphabetically for clean JSON
            const sortedData = Object.keys(merged).sort().reduce((acc, k) => {
                acc[k] = merged[k]; return acc;
            }, {});

            fs.writeFileSync(targetPath, JSON.stringify(sortedData, null, 4), 'utf8');
            console.log(`✅ Successfully merged ${source} into languages/${target}`);
        } catch (err) {
            console.error(`❌ Error processing ${target}:`, err);
        }
    });
}
runMerge();