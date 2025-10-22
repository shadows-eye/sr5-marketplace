/**
 * A service to introspect the game system's data models and provide
 * structured lists of keys for use in effect builders.
 */
export class SystemDataMapperService {
    /** * @private A set of top-level system keys to completely ignore. 
     */
    static #EXCLUDED_GROUPS = new Set([
        "inventories", "npc", "values", "category_visibility", 
        "description", "importFlags", "visibilityChecks",
        // These are now handled manually
        "physical_track", "stun_track", "matrix_track", "track"
    ]);

    /**
     * Creates a title-cased label from a camelCase string as a fallback.
     * @private
     */
    static #createFallbackLabel(str) {
        return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Tries to find a localized label for a data model group key.
     * @param {string} key The key from the data model.
     * @returns {string} The localized label or a formatted fallback.
     * @private
     */
    static #createGroupLabel(key) {
        // Prioritize specific, known localization keys
        const keyMap = {
            skills: "SR5.ActiveSkills",
            matrix: "SR5.Labels.ActorSheet.Matrix",
            limits: "SR5.Limit",
            attributes: "SR5.Attributes",
            initiative: "SR5.Initiative",
            modifiers: "SR5.Modifiers"
        };

        const specificKey = keyMap[key];
        if (specificKey) {
            const localized = game.i18n.localize(specificKey);
            if (localized !== specificKey) return localized;
        }

        // Fallback for other keys, e.g., 'movement'
        const fallbackKey = `SR5.${key.charAt(0).toUpperCase() + key.slice(1)}`;
        const fallbackLocalized = game.i18n.localize(fallbackKey);
        if (fallbackLocalized !== fallbackKey) return fallbackLocalized;

        return this.#createFallbackLabel(key); // Final fallback if nothing else is found
    }
    
    /**
     * Recursively walks an object to find all valid data paths.
     * @param {object} obj The object to walk.
     * @param {string} path The current path prefix.
     * @param {Array<object>} results The array to push results into.
     * @param {object} localizedMap A map of keys to their localized labels.
     * @private
     */
    static _walkObject(obj, path, results, localizedMap = {}) {
        for (const key in obj) {
            if (key.startsWith("_") || key === "flags") continue;
            const newPath = path ? `${path}.${key}` : key;
            const value = obj[key];
            const label = localizedMap[key] || this.#createFallbackLabel(key);

            if (typeof value === 'object' && value !== null) {
                if ("value" in value) {
                    results.push({ label: label, path: `${newPath}.value` });
                }
                else if (!Array.isArray(value)) {
                    // Pass the same map down for nested objects to find deeper localizations
                    this._walkObject(value, newPath, results, localizedMap);
                }
            } else if (value !== null) {
                results.push({ label: label, path: newPath });
            }
        }
    }

    /**
     * Gets a structured object of all mappable keys.
     * @returns {{actors: object, items: object, rolls: object, modifiers: object}}
     */
    static getMappableKeys() {
        const systemApi = game.sr5marketplace.api.system;
        if (!systemApi?.documentTypes) return { actors: {}, items: {}, rolls: {}, modifiers: {} };

        // --- ACTORS ---
        const allActorKeys = {};
        for (const type in systemApi.documentTypes.Actor) {
            if (type === "base" || type.includes("sr5-marketplace")) continue;
            try {
                const model = new CONFIG.Actor.documentClass({ name: "temp-mapper", type: type }, { temporary: true });
                if (!model?.system) continue;
                
                const typeResults = {};

                for (const groupKey in model.system) {
                    if (this.#EXCLUDED_GROUPS.has(groupKey)) continue;
                    const groupData = model.system[groupKey];
                    if (typeof groupData !== 'object' || groupData === null) continue;

                    const groupLabel = this.#createGroupLabel(groupKey);
                    const localMap = systemApi.getLocalizationMapForKey(groupKey);
                    let results = [];

                    this._walkObject(groupData, `system.${groupKey}`, results, localMap);
                    
                    if (results.length > 0) {
                        // Post-filter for skills to ensure we only get relevant paths
                        if (groupKey === 'skills') {
                            results = results.filter(r => r.path.includes('.active.') || r.path.includes('.knowledge.') || r.path.includes('.language.'));
                        }

                        // Augment armor to ensure '.mod' is always included if it exists
                        if (groupKey === 'armor' && model.system.armor.mod !== undefined) {
                            const modPath = 'system.armor.mod';
                            if (!results.some(r => r.path === modPath)) {
                                results.push({ label: game.i18n.localize('SR5.Armor.FIELDS.armor.mod.label'), path: modPath });
                            }
                        }
                        
                        if (results.length > 0) {
                           typeResults[groupLabel] = results;
                        }
                    }
                }

                // Manually build and localize the Condition Tracks group
                const tracksGroupName = game.i18n.localize("SR5.ConditionMonitor") || "Condition Monitor";
                const tracks = [];
                if (model.system.physical_track) tracks.push({ label: game.i18n.localize("SR5.DmgTypePhysical"), path: "system.physical_track.value" });
                if (model.system.stun_track) tracks.push({ label: game.i18n.localize("SR5.DmgTypeStun"), path: "system.stun_track.value" });
                if (model.system.matrix_track) tracks.push({ label: game.i18n.localize("SR5.DmgTypeMatrix"), path: "system.matrix_track.value" });
                
                if (tracks.length > 0) {
                    typeResults[tracksGroupName] = tracks;
                }

                if (Object.keys(typeResults).length > 0) allActorKeys[type] = typeResults;
            } catch (e) { console.warn(`Could not map Actor type "${type}".`, e); }
        }

        // --- ITEMS, ROLLS, MODIFIERS (Unchanged) ---
        const allItemKeys = {};
        for (const type in systemApi.documentTypes.Item) {
            if (type === "base" || type.includes("sr5-marketplace")) continue;
            try {
                const model = new CONFIG.Item.documentClass({ name: "temp-mapper", type: type }, { temporary: true });
                if (!model?.system) continue;
                const groupResults = [];
                SystemDataMapperService._walkObject(model.system, "system", groupResults, {});
                if (groupResults.length > 0) allItemKeys[type] = groupResults;
            } catch (e) { console.warn(`Could not map Item type "${type}".`, e); }
        }

        const allRollKeys = {};
        try {
            const TestClass = game.shadowrun5e.tests.SuccessTest;
            if (TestClass) {
                const tempRoll = new TestClass({});
                if (tempRoll.data) {
                    const groupResults = [];
                    SystemDataMapperService._walkObject(tempRoll.data, "data", groupResults, {});
                    if (groupResults.length > 0) {
                        allRollKeys[game.i18n.localize("SR5.Test")] = groupResults;
                    }
                }
            }
        } catch (e) { console.error("SystemDataMapperService | Failed to dynamically map Roll keys.", e); }

        const allModifierKeys = {
            [game.i18n.localize("SR5.Modifiers")]: [
                { label: game.i18n.localize("SR5.SituationalModifier"), path: "system.modifiers" }
            ]
        };
        
        return { actors: allActorKeys, items: allItemKeys, rolls: allRollKeys, modifiers: allModifierKeys };
    }
}
