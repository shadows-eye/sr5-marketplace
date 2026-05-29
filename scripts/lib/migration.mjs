/**
 * Migration Script: Migrate Shop Actor Stored Skills to Embedded Skill Items
 * 
 * Identifies all shop actors (in the actor directory and active scenes),
 * scans for legacy skill data stored in 'actor.system.skills.active', and migrates
 * them into embedded 'skill' items in accordance with the new system architecture.
 */

const SHOP_ACTOR_TYPE = 'sr5-marketplace.shop';

// Normalize names for safe matches
const normalizeName = name => String(name ?? '').trim().toLowerCase();

// Get the correct active skills localized names mapping if available
const getSkillLabel = (key) => {
    if (typeof CONFIG !== 'undefined' && CONFIG.SR5?.activeSkills?.[key]) {
        return game.i18n.localize(CONFIG.SR5.activeSkills[key]) || key;
    }
    // Fallback capitalizing basic names
    return key.charAt(0).toUpperCase() + key.slice(1);
};

// Retrieve all actors in the world and on active/inactive scenes
const collectShopActors = () => {
    const actors = [...game.actors.contents].filter(actor => actor.type === SHOP_ACTOR_TYPE);
    const seen = new Set(actors.map(actor => actor.uuid));

    for (const scene of game.scenes.contents) {
        for (const tokenDocument of scene.tokens.contents) {
            const actor = tokenDocument.actor;
            if (!actor || actor.type !== SHOP_ACTOR_TYPE) continue;
            if (seen.has(actor.uuid)) continue;

            seen.add(actor.uuid);
            actors.push(actor);
        }
    }
    return actors;
};

// Execute Migration
export async function migrateShopSkills() {
    // Only run if the game is ready
    if (typeof game === 'undefined' || !game.ready) return;

    // 1. Attempt to find the configured skills compendium
    const SYSTEM_ID = 'shadowrun5e';
    const SKILLS_PACK_SETTING = 'SkillsPack';
    
    let pack = null;
    if (game.packs) {
        // Try getting configured pack from system settings
        try {
            const configuredPackName = game.settings.get(SYSTEM_ID, SKILLS_PACK_SETTING);
            if (configuredPackName) {
                pack = game.packs.find(p => p.metadata.system === SYSTEM_ID && p.metadata.name === configuredPackName);
            }
        } catch (e) {
            // Settings read failed, proceed to fallback search
        }

        // Fallback search by matching pack names
        if (!pack) {
            pack = game.packs.find(p => 
                p.metadata.system === SYSTEM_ID && 
                (p.metadata.name === 'sr5e-skills' || p.metadata.name === 'sr5e-skill-sets')
            ) || game.packs.find(p => p.metadata.name === 'sr5e-skills' || p.metadata.name === 'sr5e-skill-sets');
        }
    }

    // 2. Fetch all documents from the pack if found
    let compendiumSkills = [];
    if (pack) {
        try {
            compendiumSkills = await pack.getDocuments();
            console.log(`SR5 Marketplace | Loaded ${compendiumSkills.length} skills from compendium: ${pack.collection}`);
        } catch (err) {
            console.error("SR5 Marketplace | Failed to load compendium documents:", err);
        }
    } else {
        console.warn("SR5 Marketplace | Skills compendium ('sr5e-skills' or 'sr5e-skill-sets') not found. Using generic fallback initialization.");
    }

    // Build lookup map for compendium skills by key or name
    const compendiumSkillMap = new Map();
    for (const item of compendiumSkills) {
        const itemKey = foundry.utils.getProperty(item, 'system.key') || item.name;
        if (itemKey) {
            compendiumSkillMap.set(normalizeName(itemKey), item);
        }
        compendiumSkillMap.set(normalizeName(item.name), item);
    }

    const shopActors = collectShopActors();
    console.log(`SR5 Marketplace | Starting Shop Actor Skills migration for ${shopActors.length} actors...`);

    let migratedActorsCount = 0;
    let createdSkillsCount = 0;

    for (const actor of shopActors) {
        const legacySkills = actor.system.skills?.active;
        if (!legacySkills || typeof legacySkills !== 'object') {
            continue;
        }

        const itemsToCreate = [];
        const actorUpdates = {};
        
        // Scan each legacy skill entry
        for (const [skillKey, skillData] of Object.entries(legacySkills)) {
            const skillValue = skillData?.value ?? skillData ?? 0;
            if (skillValue <= 0) continue; // Skip un-trained skills

            // Check if actor already has an embedded skill item of type 'skill' with matching key or name
            const alreadyExists = actor.items.some(item => 
                item.type === 'skill' && 
                (normalizeName(item.system.key) === normalizeName(skillKey) || 
                 normalizeName(item.name) === normalizeName(skillKey))
            );

            if (alreadyExists) {
                // Legacy field still exists but embedded item is already on actor: delete the legacy field
                actorUpdates[`system.skills.active.-=${skillKey}`] = null;
                continue;
            }

            // Search for matching skill in the compendium
            const compItem = compendiumSkillMap.get(normalizeName(skillKey));
            
            if (compItem) {
                // Clone the exact compendium item structure
                const itemData = compItem.toObject();
                // Override system rating and value to match legacy levels
                if (itemData.system) {
                    if (!itemData.system.skill) itemData.system.skill = {};
                    itemData.system.skill.category = "active";
                    itemData.system.skill.rating = skillValue;
                    itemData.system.skill.value = skillValue;
                    itemData.system.rating = { value: skillValue };
                    itemData.system.value = skillValue;
                }
                itemsToCreate.push(itemData);
            } else {
                // Prepare generic fallback if not found in compendium
                const label = getSkillLabel(skillKey);
                itemsToCreate.push({
                    name: label,
                    type: 'skill',
                    system: {
                        type: 'skill',
                        key: skillKey,
                        rating: {
                            value: skillValue
                        },
                        value: skillValue,
                        skill: {
                            category: "active",
                            rating: skillValue,
                            value: skillValue
                        }
                    }
                });
            }

            // Mark legacy field for deletion
            actorUpdates[`system.skills.active.-=${skillKey}`] = null;
        }

        if (itemsToCreate.length > 0) {
            console.log(`SR5 Marketplace | Migrating ${itemsToCreate.length} skills for Actor ${actor.name}...`, itemsToCreate);
            await actor.createEmbeddedDocuments('Item', itemsToCreate);
            migratedActorsCount += 1;
            createdSkillsCount += itemsToCreate.length;
        }

        if (Object.keys(actorUpdates).length > 0) {
            console.log(`SR5 Marketplace | Cleaning up ${Object.keys(actorUpdates).length} legacy skills from Actor ${actor.name}...`);
            await actor.update(actorUpdates);
        }
    }

    if (migratedActorsCount > 0) {
        console.log('SR5 Marketplace | Shop Actor skills migration finished!', {
            migratedActorsCount,
            createdSkillsCount
        });

        if (typeof ui !== 'undefined' && ui.notifications) {
            ui.notifications.info(`SR5 Marketplace | Migrated ${createdSkillsCount} legacy skills on ${migratedActorsCount} Shop Actors.`);
        }
    }
}
