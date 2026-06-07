import fs from 'fs';
import path from 'path';

export function mergeLocales() {
    console.log('🚀 Merging split localization files...');
    const languagesDir = path.join(process.cwd(), 'languages');
    
    if (!fs.existsSync(languagesDir)) {
        console.error(`❌ Languages directory not found: ${languagesDir}`);
        return;
    }

    const subdirs = fs.readdirSync(languagesDir).filter(file => {
        return fs.statSync(path.join(languagesDir, file)).isDirectory();
    });

    for (const lang of subdirs) {
        const langPath = path.join(languagesDir, lang);
        const files = fs.readdirSync(langPath).filter(file => file.endsWith('.json'));
        
        const merged = {};
        for (const file of files) {
            const key = path.basename(file, '.json');
            const filePath = path.join(langPath, file);
            try {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                merged[key] = content;
            } catch (err) {
                console.error(`❌ Error parsing JSON in file ${filePath}:`, err);
            }
        }

        // Sort keys alphabetically
        const sortedData = Object.keys(merged).sort().reduce((acc, k) => {
            acc[k] = merged[k];
            return acc;
        }, {});

        // Write to languages/en.json or de.json
        const outputPath = path.join(languagesDir, `${lang}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(sortedData, null, 4), 'utf8');
        console.log(`✅ Merged languages/${lang}/*.json -> languages/${lang}.json`);

        // Also write to dist/languages/ if it exists
        const distLanguagesDir = path.join(process.cwd(), 'dist', 'languages');
        if (fs.existsSync(distLanguagesDir)) {
            const distOutputPath = path.join(distLanguagesDir, `${lang}.json`);
            fs.writeFileSync(distOutputPath, JSON.stringify(sortedData, null, 4), 'utf8');
            console.log(`✅ Written to dist/languages/${lang}.json`);
        }
    }
}

// Run immediately if this script is executed directly
try {
    const mainScriptPath = process.argv[1] ? fs.realpathSync(process.argv[1]) : '';
    const currentScriptPath = import.meta.url ? fs.realpathSync(new URL(import.meta.url).pathname) : '';
    if (mainScriptPath && currentScriptPath && mainScriptPath === currentScriptPath) {
        mergeLocales();
    }
} catch (e) {
    // Fallback if URL or realpathSync fails in certain environments
    if (process.argv[1] && process.argv[1].endsWith('merge-locales.js')) {
        mergeLocales();
    }
}