import { verifyNoImportant } from './verify-no-important.js';

try {
    verifyNoImportant(['styles/marketshouter.css']);
    console.log('✅ [CSS Specificity Test] Passed: zero !important statements in styles/marketshouter.css');
    process.exit(0);
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
