import { verifyNoImportant } from './verify-no-important.js';

try {
    verifyNoImportant();
    console.log('✅ [CSS Specificity Test] Passed: zero !important statements across all stylesheets in styles/');
    process.exit(0);
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
