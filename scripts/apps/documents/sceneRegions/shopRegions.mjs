/**
 * Automatically creates, moves, and manages Scene Regions linked to Shop Actor tokens.
 * Uses Foundry's native 'flags' system to safely link Regions to Tokens.
 */
export function registerShopRegionHooks() {
    
    // ==========================================================
    // DETERMINISTIC VISIBILITY EVALUATOR (Zero-Lag Math Check)
    // ==========================================================
    
    /**
     * Mathematically predicts if a token is in the zone using the raw hook 'changes' data,
     * bypassing canvas rendering lag entirely.
     */
    function getTargetVisibility(region, movedToken = null, changes = {}, deletedTokenId = null, controlOverride = null) {
        const shopTokenId = region.flags?.["sr5-marketplace"]?.shopTokenId;
        const shopToken = region.parent.tokens.get(shopTokenId);
        if (!shopToken) return region.visibility || 0;

        const grid = region.parent.grid;
        const radiusUnits = shopToken.actor?.system?.shop?.shopRadius?.value || 1;
        const radiusPx = radiusUnits * grid.size;
        
        // 1. Calculate Shop Center (Inject new coordinates if the Shop itself is moving)
        let scx, scy;
        if (movedToken?.id === shopTokenId) {
            scx = (changes.x ?? shopToken.x) + ((changes.width ?? shopToken.width ?? 1) * grid.size) / 2;
            scy = (changes.y ?? shopToken.y) + ((changes.height ?? shopToken.height ?? 1) * grid.size) / 2;
        } else {
            scx = shopToken.x + ((shopToken.width || 1) * grid.size) / 2;
            scy = shopToken.y + ((shopToken.height || 1) * grid.size) / 2;
        }

        let tokenInside = false;

        // Build a reliable list of tokens (add the new token if it was just created)
        const tokenList = Array.from(region.parent.tokens);
        if (movedToken && !tokenList.some(t => t.id === movedToken.id)) tokenList.push(movedToken);

        // 2. Check all other tokens
        for (const t of tokenList) {
            if (t.id === shopTokenId) continue;
            if (t.id === deletedTokenId) continue; // Ignore if it's currently being deleted
            if (t.actor?.type === "sr5-marketplace.shop") continue; // Ignore other shops

            // Inject new coordinates if this specific token is the one moving
            let tx = t.x, ty = t.y, tw = t.width ?? 1, th = t.height ?? 1;
            if (movedToken?.id === t.id) {
                tx = changes.x ?? t.x;
                ty = changes.y ?? t.y;
                tw = changes.width ?? t.width ?? 1;
                th = changes.height ?? t.height ?? 1;
            }

            const tcx = tx + (tw * grid.size) / 2;
            const tcy = ty + (th * grid.size) / 2;

            // Mathematical distance (Center to Center)
            const distance = Math.sqrt(Math.pow(tcx - scx, 2) + Math.pow(tcy - scy, 2));
            
            // Allow token to trigger if its edge touches the radius, not just its exact center
            const tokenRadius = (tw * grid.size) / 2;
            if (distance <= (radiusPx + tokenRadius)) {
                tokenInside = true;
                break;
            }
        }

        if (tokenInside) return 2; // Always for anyone

        // 3. Check GM Control state (Inject explicit control state if it's currently changing)
        let isControlled = false;
        if (controlOverride && controlOverride.id === shopTokenId) {
            isControlled = controlOverride.controlled;
        } else {
            const canvasToken = canvas.tokens?.get(shopTokenId);
            isControlled = canvasToken?.controlled || false;
        }

        if (isControlled) return 1; // Always for Gamemaster

        return 0; // Normal (Hidden)
    }


    // ==========================================================
    // CORE REGION HOOKS
    // ==========================================================

    Hooks.on("createToken", async (tokenDoc, options, userId) => {
        if (!game.user.isGM) return;

        if (tokenDoc.actor?.type === "sr5-marketplace.shop") {
            setTimeout(async () => {
                const radiusUnits = tokenDoc.actor.system.shop?.shopRadius?.value || 1;
                const grid = tokenDoc.parent.grid;
                const radiusPx = radiusUnits * grid.size;
                const cx = tokenDoc.x + ((tokenDoc.width || 1) * grid.size) / 2;
                const cy = tokenDoc.y + ((tokenDoc.height || 1) * grid.size) / 2;

                // Build a fake region object just to test initial visibility before saving
                const pseudoRegion = { flags: { "sr5-marketplace": { shopTokenId: tokenDoc.id } }, parent: tokenDoc.parent };
                const initialVisibility = getTargetVisibility(pseudoRegion);

                const regionData = {
                    name: `${tokenDoc.actor.name} - Shop Area`,
                    color: "#8b0000",
                    visibility: initialVisibility,
                    shapes: [{ type: "ellipse", x: cx, y: cy, radiusX: radiusPx, radiusY: radiusPx, rotation: 0 }],
                    flags: { "sr5-marketplace": { shopActorUuid: tokenDoc.actor.uuid, shopTokenId: tokenDoc.id } }
                };
                await tokenDoc.parent.createEmbeddedDocuments("Region", [regionData]);
            }, 100);
        } else {
            // A non-shop token was dropped, re-evaluate all regions using the new token's data
            const shopRegions = tokenDoc.parent.regions.filter(r => r.flags?.["sr5-marketplace"]?.shopTokenId);
            for (const region of shopRegions) {
                const tv = getTargetVisibility(region, tokenDoc, { x: tokenDoc.x, y: tokenDoc.y });
                if (region.visibility !== tv) await region.update({ visibility: tv });
            }
        }
    });

    Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
        if (!game.user.isGM) return;

        if (tokenDoc.actor?.type === "sr5-marketplace.shop") {
            // Shop token moved
            if (changes.x !== undefined || changes.y !== undefined || changes.width !== undefined || changes.height !== undefined) {
                const region = tokenDoc.parent.regions.find(r => r.flags?.["sr5-marketplace"]?.shopTokenId === tokenDoc.id);
                if (region) {
                    const radiusUnits = tokenDoc.actor.system.shop?.shopRadius?.value || 1;
                    const grid = tokenDoc.parent.grid;
                    const radiusPx = radiusUnits * grid.size;
                    const cx = (changes.x ?? tokenDoc.x) + ((changes.width ?? tokenDoc.width ?? 1) * grid.size) / 2;
                    const cy = (changes.y ?? tokenDoc.y) + ((changes.height ?? tokenDoc.height ?? 1) * grid.size) / 2;

                    // Combine Region move and visibility update into a single flawless database call
                    const tv = getTargetVisibility(region, tokenDoc, changes);
                    await region.update({
                        shapes: [{ type: "ellipse", x: cx, y: cy, radiusX: radiusPx, radiusY: radiusPx, rotation: 0 }],
                        visibility: tv
                    });
                }
            }
        } else {
            // A character or NPC moved
            if (changes.x !== undefined || changes.y !== undefined) {
                const shopRegions = tokenDoc.parent.regions.filter(r => r.flags?.["sr5-marketplace"]?.shopTokenId);
                for (const region of shopRegions) {
                    const tv = getTargetVisibility(region, tokenDoc, changes);
                    if (region.visibility !== tv) await region.update({ visibility: tv });
                }
            }
        }
    });

    Hooks.on("deleteToken", async (tokenDoc, options, userId) => {
        if (!game.user.isGM) return;
        
        if (tokenDoc.actor?.type === "sr5-marketplace.shop") {
            const region = tokenDoc.parent.regions.find(r => r.flags?.["sr5-marketplace"]?.shopTokenId === tokenDoc.id);
            if (region) await region.delete();
        } else {
            const shopRegions = tokenDoc.parent.regions.filter(r => r.flags?.["sr5-marketplace"]?.shopTokenId);
            for (const region of shopRegions) {
                const tv = getTargetVisibility(region, null, {}, tokenDoc.id);
                if (region.visibility !== tv) await region.update({ visibility: tv });
            }
        }
    });

    Hooks.on("updateActor", async (actor, changes, options, userId) => {
        if (!game.user.isGM) return;
        if (actor.type !== "sr5-marketplace.shop") return;
        
        if (foundry.utils.hasProperty(changes, "system.shop.shopRadius.value")) {
            const radiusUnits = foundry.utils.getProperty(changes, "system.shop.shopRadius.value");
            const tokens = actor.getActiveTokens(false, true); 
            
            for (const tokenDoc of tokens) {
                const region = tokenDoc.parent.regions.find(r => r.flags?.["sr5-marketplace"]?.shopTokenId === tokenDoc.id);
                if (region) {
                    const grid = tokenDoc.parent.grid;
                    const radiusPx = radiusUnits * grid.size;
                    const cx = tokenDoc.x + ((tokenDoc.width || 1) * grid.size) / 2;
                    const cy = tokenDoc.y + ((tokenDoc.height || 1) * grid.size) / 2;
                    
                    await region.update({ shapes: [{ type: "ellipse", x: cx, y: cy, radiusX: radiusPx, radiusY: radiusPx, rotation: 0 }] });
                    
                    // Re-evaluate in case the radius expanded over a token!
                    const tv = getTargetVisibility(region);
                    if (region.visibility !== tv) await region.update({ visibility: tv });
                }
            }
        }
    });

    // ==========================================================
    // SELECTION VISIBILITY TRIGGERS
    // ==========================================================

    Hooks.on("controlToken", (token, controlled) => {
        if (!game.user.isGM) return;
        
        if (token.actor?.type === "sr5-marketplace.shop") {
            const region = token.scene?.regions.find(r => r.flags?.["sr5-marketplace"]?.shopTokenId === token.id);
            if (region) {
                // Pass the exact control override so it doesn't rely on canvas lag
                const tv = getTargetVisibility(region, null, {}, null, { id: token.id, controlled: controlled });
                if (region.visibility !== tv) region.update({ visibility: tv });
            }
        }
    });
}