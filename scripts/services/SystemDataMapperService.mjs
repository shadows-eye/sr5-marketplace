/**
 * A service to introspect the game system's data models and provide
 * structured lists of keys for use in effect builders.
 */
export class SystemDataMapperService {
    /** 
     * @private A set of top-level system keys to completely ignore. 
     *
     */
    static #EXCLUDED_GROUPS = new Set([
        "inventories", "npc", "values", "category_visibility", 
        "description", "importFlags", "visibilityChecks"
    ]);

    /** 
     * @private 
     * A mapping for renaming specific group labels. 
    */
    static #LABEL_OVERRIDES = {
        "modificationCategories": "Vehicle Modifiers"
    };

    /** 
     * @private 
    */
    static _createLabel(str) {
        return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Recursively walks an object to find all valid data paths.
     * @private
     */
    static _walkObject(obj, path, results) {
        for (const key in obj) {
            if (key.startsWith("_") || key === "flags") continue;
            const newPath = path ? `${path}.${key}` : key;
            const value = obj[key];
            if (typeof value === 'object' && value !== null && "value" in value) {
                results.push({ label: this._createLabel(key), path: `${newPath}.value` });
            }
            else if (typeof value !== 'object' || value === null) {
                results.push({ label: this._createLabel(key), path: newPath });
            } 
            else if (typeof value === 'object' && !Array.isArray(value)) {
                this._walkObject(value, newPath, results);
            }
        }
    }

    /**
     * Gets a single, structured object containing all mappable keys for all document types,
     * plus special keys for rolls and modifiers. This version is updated to use the
     * centralized system API for safer data access.
     * @returns {{actors: object, items: object, rolls: object, modifiers: object}}
     */
    static getMappableKeys() {
        const systemApi = game.sr5marketplace.api.system;

        if (!systemApi?.documentTypes || !systemApi.config) {
            console.error("SystemDataMapperService | System API not initialized. Cannot map keys.");
            return { actors: {}, items: {}, rolls: {}, modifiers: {} };
        }

        // --- ACTORS & ITEMS (This logic remains correct) ---
        const allActorKeys = {};
        // ... (The existing code for walking actor models is correct and should remain here) ...
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
                    this._walkObject(groupData, `system.${groupKey}`, groupResults);
                    if (groupResults.length > 0) {
                        const groupLabel = this.#LABEL_OVERRIDES[groupKey] ?? this._createLabel(groupKey);
                        typeResults[groupLabel] = groupResults;
                    }
                }
                if (Object.keys(typeResults).length > 0) allActorKeys[type] = typeResults;
            } catch (e) { console.warn(`Could not map Actor type "${type}".`, e); }
        }

        const allItemKeys = {};
        // ... (The existing code for walking item models is correct and should remain here) ...
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


        // --- ROLLS (DYNAMICALLY MAPPED) ---
        const allRollKeys = {};
        try {
            const rollClass = game.shadowrun5e.SR5Roll;
            // Check if the class and its static schema definition method exist.
            if (rollClass?.defineSchema) {
                const schema = rollClass.defineSchema();
                const groupResults = [];
                // The root path for roll modifications is "data", not "system".
                this._walkObject(schema, "data", groupResults);
                if (groupResults.length > 0) allRollKeys["Roll Data"] = groupResults;
            }
        } catch (e) {
            console.error("SystemDataMapperService | Failed to dynamically map Roll keys.", e);
        }

        // --- MODIFIERS (CORRECTLY FOCUSED) ---
        // For the 'modifier' applyTo type, the goal is to add a new situational modifier object.
        // The only valid key for this is the path to the modifiers array itself.
        const allModifierKeys = {
            "Modifiers": [
                { label: "Add Situational Modifier", path: "system.modifiers" }
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
