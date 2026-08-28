import fs from 'fs';
import path from 'path';

async function publishRelease() {
    // Ensure .env variables are loaded (Node 20.6+ native support)
    const token = process.env.FOUNDRY_RELEASE_TOKEN;
    if (!token) {
        console.error('❌ Error: FOUNDRY_RELEASE_TOKEN is not set in your environment variables.');
        process.exit(1);
    }

    // URL to read the current version data
    const fetchUrl = 'https://shadowplays.de/api/sr5-marketplace/latest/module.json';
    console.log(`📡 Fetching latest manifest from: ${fetchUrl}`);

    try {
        // 1. Fetch the remote manifest to ensure we are posting accurate info
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch manifest: ${response.statusText}`);
        }
        const manifest = await response.json();

        const version = manifest.version;
        const minCompatibility = manifest.compatibility?.minimum || "14";
        const verifiedCompatibility = manifest.compatibility?.verified || "14";

        // Construct the version-locked URL that Foundry will save
        const releaseManifestUrl = `https://shadowplays.de/api/sr5-marketplace/${version}/module.json`;

        // 2. Construct the payload matching the official endpoint structure
        const payload = {
            id: "sr5-marketplace",
            "dry-run": false,
            release: {
                version: version,
                manifest: releaseManifestUrl, // Uses the versioned URL here
                notes: `https://shadowplays.de/api/sr5-marketplace/${version}`,
                compatibility: {
                    minimum: minCompatibility,
                    verified: verifiedCompatibility
                }
            }
        };

        console.log(`🚀 Submitting production release v${version} to Foundry VTT...`);
        console.log(`🔗 Archiving manifest link: ${releaseManifestUrl}`);

        // 3. Post to the official Foundry API domain
        const apiResponse = await fetch('https://api.foundryvtt.com/_api/packages/release_version', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token.trim()
            },
            body: JSON.stringify(payload)
        });

        const result = await apiResponse.json();

        if (apiResponse.ok && result.status === 'success') {
            console.log('\n==================================================');
            console.log('🎉 MODULE LISTING UPDATED SUCCESSFULLY!');
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