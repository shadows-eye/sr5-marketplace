import fs from 'fs';
import path from 'path';

/**
 * Verifies that the specified CSS file(s) do not contain any '!important' statements.
 * Strips comments to avoid false positives.
 * 
 * @param {string[]} targetFiles Relative paths to CSS files to check
 * @param {string} rootDir Root directory of the project
 * @returns {boolean}
 * @throws {Error} If any !important statements are found
 */
export function verifyNoImportant(targetFiles = ['styles/marketshouter.css'], rootDir = process.cwd()) {
    const violations = [];

    for (const relPath of targetFiles) {
        const fullPath = path.resolve(rootDir, relPath);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        
        let inBlockComment = false;
        lines.forEach((line, idx) => {
            const lineNum = idx + 1;
            let strippedLine = line;

            // Handle multi-line block comments /* ... */
            if (inBlockComment) {
                if (strippedLine.includes('*/')) {
                    strippedLine = strippedLine.substring(strippedLine.indexOf('*/') + 2);
                    inBlockComment = false;
                } else {
                    return;
                }
            }

            // Remove inline block comments /* ... */ on the same line
            strippedLine = strippedLine.replace(/\/\*[\s\S]*?\*\//g, '');

            // Check if comment starts and doesn't close on this line
            if (strippedLine.includes('/*')) {
                strippedLine = strippedLine.substring(0, strippedLine.indexOf('/*'));
                inBlockComment = true;
            }

            // Remove single line // comments if any
            if (strippedLine.includes('//')) {
                strippedLine = strippedLine.substring(0, strippedLine.indexOf('//'));
            }

            // Test for !important statement
            if (/!\s*important/i.test(strippedLine)) {
                violations.push({
                    file: relPath,
                    line: lineNum,
                    content: line.trim()
                });
            }
        });
    }

    if (violations.length > 0) {
        const details = violations
            .map(v => `  - ${v.file}:${v.line} -> "${v.content}"`)
            .join('\n');
        throw new Error(
            `\n🚨 [Vite CSS Test Failed] Found forbidden '!important' statement(s):\n${details}\nSolve purely with CSS specificity instead!\n`
        );
    }

    return true;
}
