import fs from 'fs';
import path from 'path';

/**
 * Standard CSS named colors (excluding CSS keywords like 'transparent' and 'currentColor').
 */
const NAMED_COLORS = new Set([
    'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond',
    'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
    'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey',
    'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon',
    'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet',
    'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
    'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey',
    'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen',
    'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgreen',
    'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey',
    'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
    'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen',
    'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite',
    'navy', 'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen',
    'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple',
    'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen',
    'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
    'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat', 'white', 'whitesmoke',
    'yellow', 'yellowgreen'
]);

// Hex colors: #fff, #ffffff, #ffffff80
const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

// Functional colors: rgb, rgba, hsl, hsla, hwb, lab, lch, oklab, oklch, color(...)
const FUNC_COLOR_REGEX = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\([^)]*\)/gi;

/**
 * Checks a single CSS file content for raw colors.
 * 
 * @param {string} filePath Path to CSS file
 * @returns {Array<{ line: number, type: string, match: string, snippet: string }>}
 */
export function checkCssFileForRawColors(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const violations = [];

    let inComment = false;
    let inRule = false;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        let line = rawLine;

        // Strip comments across single and multiple lines
        let cleaned = '';
        for (let c = 0; c < line.length; c++) {
            if (inComment) {
                if (line[c] === '*' && line[c + 1] === '/') {
                    inComment = false;
                    c++;
                }
            } else {
                if (line[c] === '/' && line[c + 1] === '*') {
                    inComment = true;
                    c++;
                } else if (line[c] === '/' && line[c + 1] === '/') {
                    break; // Line comment
                } else {
                    cleaned += line[c];
                }
            }
        }

        // Strip url(...) content (including SVG data URIs)
        cleaned = cleaned.replace(/url\([^)]*\)/gi, '');

        // Track CSS rule braces
        for (const char of cleaned) {
            if (char === '{') inRule = true;
            else if (char === '}') inRule = false;
        }

        // Only evaluate declarations within rules
        if (!inRule && !cleaned.includes('{')) continue;

        // Strip CSS variable references: var(--...) is valid and theme-based
        const withoutVars = cleaned.replace(/var\([^)]*\)/gi, '');

        // Strip quoted strings (e.g. font family names, content strings)
        const withoutStrings = withoutVars.replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');

        // 1. Detect Hex colors
        const hexMatches = withoutStrings.match(HEX_COLOR_REGEX);
        if (hexMatches) {
            violations.push({
                line: i + 1,
                type: 'Hex Color',
                match: hexMatches.join(', '),
                snippet: rawLine.trim()
            });
            continue;
        }

        // 2. Detect Functional colors (rgba, hsla, oklch, etc.)
        const funcMatches = withoutStrings.match(FUNC_COLOR_REGEX);
        if (funcMatches) {
            violations.push({
                line: i + 1,
                type: 'Functional Color',
                match: funcMatches.join(', '),
                snippet: rawLine.trim()
            });
            continue;
        }

        // 3. Detect Named Colors in declaration values
        if (withoutStrings.includes(':') || inRule) {
            const parts = withoutStrings.split(':');
            const val = parts.length > 1 ? parts.slice(1).join(':') : withoutStrings;
            const tokens = val.split(/[^a-zA-Z-]+/);
            for (const token of tokens) {
                const lower = token.toLowerCase();
                if (NAMED_COLORS.has(lower)) {
                    violations.push({
                        line: i + 1,
                        type: 'Named Color',
                        match: lower,
                        snippet: rawLine.trim()
                    });
                    break;
                }
            }
        }
    }

    return violations;
}

/**
 * Verifies that all CSS files (excluding variables.css) use only theme variables
 * and contain zero raw colors.
 * 
 * @param {string[]} [targetFiles] Optional array of file paths. If omitted, scans all styles/*.css
 * @param {string} [stylesDir] Directory containing CSS files (default: 'styles')
 * @returns {{ success: boolean, results: Record<string, any[]>, totalViolations: number }}
 */
export function verifyThemeColors(targetFiles = null, stylesDir = 'styles') {
    const resolvedStylesDir = path.resolve(process.cwd(), stylesDir);
    let filesToCheck = [];

    if (targetFiles && targetFiles.length > 0) {
        filesToCheck = targetFiles.map(f => path.resolve(process.cwd(), f));
    } else {
        if (!fs.existsSync(resolvedStylesDir)) {
            throw new Error(`Styles directory not found: ${resolvedStylesDir}`);
        }
        filesToCheck = fs.readdirSync(resolvedStylesDir)
            .filter(f => f.endsWith('.css') && f !== 'variables.css')
            .map(f => path.join(resolvedStylesDir, f));
    }

    const results = {};
    let totalViolations = 0;

    for (const filePath of filesToCheck) {
        // variables.css is the single source of truth for color definitions and theme classes
        if (path.basename(filePath) === 'variables.css') continue;
        if (!fs.existsSync(filePath)) continue;

        const relPath = path.relative(process.cwd(), filePath);
        const violations = checkCssFileForRawColors(filePath);
        if (violations.length > 0) {
            results[relPath] = violations;
            totalViolations += violations.length;
        }
    }

    return {
        success: totalViolations === 0,
        results,
        totalViolations
    };
}
