import path from 'path';
import { verifyThemeColors } from './verify-theme-colors.js';

// Support optional file arguments from CLI: node helpers/test_theme_colors.mjs [file1] [file2]
const cliArgs = process.argv.slice(2);
const targetFiles = cliArgs.length > 0 ? cliArgs : null;

console.log('🔍 Running CSS Theme Color Compliance Test...\n');

const { success, results, totalViolations } = verifyThemeColors(targetFiles);

if (!success) {
    const fileCount = Object.keys(results).length;
    console.error(`🚨 [CSS Theme Test FAILED] Found ${totalViolations} raw color statement(s) across ${fileCount} file(s)!\n`);
    console.error('All colors must be defined in "styles/variables.css" and consumed via theme variables (var(--...)).\n');

    for (const [file, violations] of Object.entries(results)) {
        console.error(`📁 ${file} (${violations.length} violations):`);
        for (const v of violations.slice(0, 15)) {
            console.error(`   Line ${v.line} [${v.type}]: "${v.match}"`);
            console.error(`   > ${v.snippet}`);
        }
        if (violations.length > 15) {
            console.error(`   ... and ${violations.length - 15} more violation(s) in this file.`);
        }
        console.error('');
    }

    console.error(`❌ Total: ${totalViolations} raw color violation(s). Move them to styles/variables.css and use theme classes.`);
    process.exit(1);
} else {
    console.log('✅ [CSS Theme Test PASSED] All checked CSS files are strictly using theme-based CSS variables with zero raw colors!');
    process.exit(0);
}
