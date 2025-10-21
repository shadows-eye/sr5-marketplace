/**
 * A service to introspect the game system's data models and provide
 * structured lists of keys for use in effect builders.
 */
export class SystemDataMapperService {
    /** * @private A set of top-level system keys to completely ignore. 
     */
    static #EXCLUDED_GROUPS = new Set([
        "inventories", "npc", "values", "category_visibility", 
        "description", "importFlags", "visibilityChecks"
    ]);

    /**
     * Creates a title-cased label from a camelCase string as a fallback.
     * @param {string} str The string to format.
     * @returns {string} A formatted, title-cased string.
     * @private
     */
    static #createFallbackLabel(str) {
        return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Tries to find a localized label for a data model group key (e.g., 'attributes').
     * @param {string} key The key from the data model (e.g., 'attributes').
     * @returns {string} The localized label or a formatted fallback.
     * @private
     */
    static #createGroupLabel(key) {
        const systemApi = game.sr5marketplace.api.system;

        // Try common localization patterns for group headers
        const potentialKeys = [
            `SR5.${key.charAt(0).toUpperCase() + key.slice(1)}`, // e.g., SR5.Attributes
            `SR5.Tabs.${key.charAt(0).toUpperCase() + key.slice(1)}`, // e.g., SR5.Tabs.Attributes
            `SR5.Skills` // A common specific key
        ];

        for (const pKey of potentialKeys) {
            const localized = game.i18n.localize(pKey);
            if (localized !== pKey) return localized;
        }

        // A special combination for vehicle modifications
        if (key === "modificationCategories") {
            const vehicleLabel = systemApi.modificationTypes_l?.vehicle || "Vehicle";
            const modsLabel = systemApi.itemTypes_l?.modification || "Modifications";
            return `${vehicleLabel} ${modsLabel}`;
        }
        
        // Final fallback to formatting the key itself
        return this.#createFallbackLabel(key);
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

            if (typeof value === 'object' && value !== null && "value" in value) {
                results.push({ label: label, path: `${newPath}.value` });
            }
            else if (typeof value !== 'object' || value === null) {
                results.push({ label: label, path: newPath });
            } 
            else if (typeof value === 'object' && !Array.isArray(value)) {
                this._walkObject(value, newPath, results, value.skill ? localizedMap : {});
            }
        }
    }

    /**
     * Gets a structured object of all mappable keys by combining the best dynamic methods,
     * inspired by the Autocomplete Inline Properties module.
     * @returns {{actors: object, items: object, rolls: object, modifiers: object}}
     */
    static getMappableKeys() {
        const systemApi = game.sr5marketplace.api.system;

        if (!systemApi?.documentTypes) {
            console.error("SystemDataMapperService | System API not initialized.");
            return { actors: {}, items: {}, rolls: {}, modifiers: {} };
        }

        // --- ACTORS (Your stable, working logic for dynamic grouping) ---
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
                    
                    let groupResults = [];
                    // Find the corresponding localized map for the children keys.
                    // Handles special cases like 'skills' -> 'activeSkills_l'.
                    const localizedChildren = systemApi[`${groupKey}_l`] 
                        || systemApi[`active${groupKey.charAt(0).toUpperCase() + groupKey.slice(1)}_l`] 
                        || {};

                    this._walkObject(groupData, `system.${groupKey}`, groupResults, localizedChildren);

                    if (groupResults.length > 0) {
                        const groupLabel = this.#createGroupLabel(groupKey);
                        typeResults[groupLabel] = groupResults;
                    }
                }
                if (Object.keys(typeResults).length > 0) allActorKeys[type] = typeResults;
            } catch (e) { console.warn(`Could not map Actor type "${type}".`, e); }
        }

        // --- ITEMS (Your stable, working logic) ---
        const allItemKeys = {};
        for (const type in systemApi.documentTypes.Item) {
            if (type === "base" || type.includes("sr5-marketplace")) continue;
            try {
                const model = new CONFIG.Item.documentClass({ name: "temp-mapper", type: type }, { temporary: true });
                if (!model?.system) continue;
                const groupResults = [];
                this._walkObject(model.system, "system", groupResults);
                if (groupResults.length > 0) allItemKeys[type] = groupResults;
            } catch (e) { console.warn(`Could not map Item type "${type}".`, e); }
        }

        // --- ROLLS (THE AIP-INSPIRED FIX) ---
        const allRollKeys = {};
        try {
            // Get the SuccessTest class from the system's registered tests.
            const TestClass = game.shadowrun5e.tests.SuccessTest;
            if (TestClass) {
                // Create a temporary instance, passing an empty object to its constructor.
                const tempRoll = new TestClass({});
                if (tempRoll.data) {
                    const groupResults = [];
                    // Walk the resulting .data object, which is the blueprint for all rolls.
                    this._walkObject(tempRoll.data, "data", groupResults);
                    if (groupResults.length > 0) {
                        allRollKeys[game.i18n.localize("SR5.RollData")] = groupResults;
                    }
                }
            }
        } catch (e) {
            console.error("SystemDataMapperService | Failed to dynamically map Roll keys.", e);
        }

        // --- MODIFIERS (Correctly focused) ---
        const allModifierKeys = {
            [game.i18n.localize("SR5.Modifiers")]: [
                { label: game.i18n.localize("SR5.AddSituationalModifier"), path: "system.modifiers" }
            ]
        };
        
        return { actors: allActorKeys, items: allItemKeys, rolls: allRollKeys, modifiers: allModifierKeys };
    }

    /**
     * Gets structured lists of mappable keys for ALL Actor types in the system.
     * @returns {object}
     */
    static getAllMappableActorKeys() {
        const actorTypes = Object.keys(game.system.documentTypes.Actor);
        const allActorKeys = {};

        for (const type of actorTypes) {
            if (type === "base" || type.includes("sr5-marketplace")) continue;

            try {
                // THIS IS THE CORRECT METHOD - Creating a temporary in-memory document.
                const model = new CONFIG.Actor.documentClass({ name: "temp-mapper", type: type }, { temporary: true });
                if (!model?.system) continue;

                const groups = {
                    Attributes: model.system.attributes,
                    Limits: model.system.limits,
                    Skills: model.system.skills?.active
                };

                const typeResults = {};
                for (const groupName in groups) {
                    if (!groups[groupName]) continue;
                    const groupResults = [];
                    const initialPath = `system.${groupName.toLowerCase()}`;
                    this._walkObject(groups[groupName], initialPath, groupResults);
                    if (groupResults.length > 0) typeResults[groupName] = groupResults;
                }
                if (Object.keys(typeResults).length > 0) allActorKeys[type] = typeResults;
            } catch (e) {
                console.warn(`SystemDataMapperService | Could not map Actor type "${type}".`, e);
            }
        }
        return allActorKeys;
    }

    /**
     * Gets structured lists of mappable keys for ALL Item types in the system.
     * @returns {object}
     */
    static getAllMappableItemKeys() {
        const itemTypes = Object.keys(game.system.documentTypes.Item);
        const allItemKeys = {};

        for (const type of itemTypes) {
            if (type === "base" || type.includes("sr5-marketplace")) continue;

            try {
                // THIS IS THE CORRECT METHOD - Creating a temporary in-memory document.
                const model = new CONFIG.Item.documentClass({ name: "temp-mapper", type: type }, { temporary: true });
                if (!model?.system) continue;

                const groupResults = [];
                this._walkObject(model.system, "system", groupResults);
                
                if (groupResults.length > 0) allItemKeys[type] = groupResults;
            } catch (e) {
                console.warn(`SystemDataMapperService | Could not map Item type "${type}".`, e);
            }
        }
        return allItemKeys;
    }
}
