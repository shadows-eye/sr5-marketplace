import fs from 'fs';
import path from 'path';

/**
 * Universal Foundry VTT Package Release Publisher for shadowplays.de modules.
 * Reads module.json or package.json to determine module ID & version,
 * loads FOUNDRY_RELEASE_TOKEN from .env, and posts to Foundry VTT Release API.
 */
async function publishRelease() {
    // 1. Load environment token
    const token = process.env.FOUNDRY_RELEASE_TOKEN || process.env.PACKAGE_RELEASE_TOKEN;
    if (!token) {
        console.error('❌ Error: FOUNDRY_RELEASE_TOKEN is not set in environment variables or .env file.');
        process.exit(1);
    }

    // 2. Resolve Module ID and Version from local module.json or package.json
    let moduleId = '';
    let version = '';

    const rootDir = process.cwd();
    const moduleJsonPath = fs.existsSync(path.resolve(rootDir, 'src/module.json')) 
        ? path.resolve(rootDir, 'src/module.json') 
        : path.resolve(rootDir, 'module.json');
        
    const packageJsonPath = path.resolve(rootDir, 'package.json');

    if (fs.existsSync(moduleJsonPath)) {
        const modData = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
        moduleId = modData.id;
        if (modData.version && !modData.version.includes('#')) {
            version = modData.version;
        }
    }

    if (!version && fs.existsSync(packageJsonPath)) {
        const pkgData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        moduleId = moduleId || pkgData.name;
        version = pkgData.version;
    }

    if (!moduleId || !version) {
        console.error('❌ Error: Could not determine module ID or version.');
        process.exit(1);
    }

    console.log(`📦 Module ID: ${moduleId} | Target Version: v${version}`);

    // 3. Fetch latest manifest from shadowplays.de API
    const fetchUrl = `https://shadowplays.de/api/${moduleId}/latest/module.json`;
    const fallbackUrl = `https://shadowplays.de/api/${moduleId}/${version}/module.json`;
    console.log(`📡 Fetching manifest from: ${fetchUrl}`);

    try {
        let response = await fetch(fetchUrl);
        if (!response.ok) {
            console.log(`⚠️ Latest endpoint returned ${response.statusText}. Trying fallback URL: ${fallbackUrl}`);
            response = await fetch(fallbackUrl);
        }
        if (!response.ok) {
            throw new Error(`Failed to fetch manifest: ${response.statusText}`);
        }
        const manifest = await response.json();

        const minCompatibility = manifest.compatibility?.minimum || "14";
        const verifiedCompatibility = manifest.compatibility?.verified || "14";

        // Version-locked manifest & release notes URLs on shadowplays.de
        const releaseManifestUrl = `https://shadowplays.de/api/${moduleId}/${version}/module.json`;
        const releaseNotesUrl = `https://shadowplays.de/api/${moduleId}/${version}/release`;

        // Construct official payload
        const payload = {
            id: moduleId,
            release_token: token.trim(),
            "dry-run": false,
            release: {
                version: version,
                manifest: releaseManifestUrl,
                notes: releaseNotesUrl,
                compatibility: {
                    minimum: minCompatibility,
                    verified: verifiedCompatibility
                }
            }
        };

        console.log(`🚀 Submitting production release v${version} for "${moduleId}" to Foundry VTT API...`);

        const apiResponse = await fetch('https://api.foundryvtt.com/_api/packages/release_version', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token.trim()
            },
            body: JSON.stringify(payload)
        });

        const rawText = await apiResponse.text();
        let result;
        try {
            result = JSON.parse(rawText);
        } catch (_) {
            console.error(`❌ Foundry API returned HTTP ${apiResponse.status} ${apiResponse.statusText}:`);
            console.error(rawText);
            process.exit(1);
        }

        if (apiResponse.ok && result.status === 'success') {
            console.log('\n==================================================');
            console.log(`🎉 ${moduleId.toUpperCase()} MODULE LISTING UPDATED SUCCESSFULLY!`);
            console.log(`🔗 Edit Page: ${result.page}`);
            console.log('==================================================\n');
        } else {
            console.error('❌ Foundry API Error:', JSON.stringify(result, null, 2));
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Network or parsing failure:', error.message);
        process.exit(1);
    }
}

publishRelease();