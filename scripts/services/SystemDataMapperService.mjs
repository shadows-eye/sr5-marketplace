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
    /**
     * Recursively walks an object to find all valid, effect-targetable data paths.
     * @private
     */
    static _walkObject(obj, path, results) {
        for (const key in obj) {
            if (key.startsWith("_") || key === "flags") continue;
            
            const newPath = path ? `${path}.${key}` : key;
            const value = obj[key];
            const label = this._createLabel(key);

            if (typeof value === 'object' && value !== null) {
                // Check if this object is a stat block
                const isStatBlock = "value" in value || "mod" in value || "base" in value;

                if (isStatBlock) {
                    // If it's a stat block, find the best property to target and stop searching deeper.
                    if ("value" in value) {
                        results.push({ label: label, path: `${newPath}.value` });
                    } else if ("base" in value) {
                        results.push({ label: label, path: `${newPath}.base` });
                    } else if ("mod" in value) {
                        results.push({ label: label, path: `${newPath}.mod` });
                    }
                } else if (!Array.isArray(value)) {
                    // If it's not a stat block, recurse deeper.
                    this._walkObject(value, newPath, results);
                }
            }
        }
    }

    /**
     * Gets a single, structured object containing all mappable keys for all document types.
     * @returns {{actors: object, items: object, rolls: object, modifiers: object}}
     */
    static getMappableKeys() {
        // --- ACTOR KEYS ---
        const allActorKeys = {};
        for (const type in game.system.documentTypes.Actor) {
            if (type === "base" || type.includes("sr5-marketplace")) continue;
            try {
                const model = new CONFIG.Actor.documentClass({ name: "temp-mapper", type: type }, { temporary: true });
                if (!model?.system) continue;
                const typeResults = {};
                for (const groupKey in model.system) {
                    if (this.#EXCLUDED_GROUPS.has(groupKey)) continue;
                    let groupResults = [];
                    this._walkObject(model.system[groupKey], `system.${groupKey}`, groupResults);
                    if (groupResults.length > 0) {
                        const groupLabel = this.#LABEL_OVERRIDES[groupKey] ?? this._createLabel(groupKey);
                        typeResults[groupLabel] = groupResults;
                    }
                }
                if (Object.keys(typeResults).length > 0) allActorKeys[type] = typeResults;
            } catch (e) { console.warn(`Marketplace Builder | Could not map Actor type "${type}".`, e); }
        }

        // --- ITEM KEYS ---
        const allItemKeys = {};
        for (const type in game.system.documentTypes.Item) {
            if (type === "base" || type.includes("sr5-marketplace")) continue;
            try {
                const model = new CONFIG.Item.documentClass({ name: "temp-mapper", type: type }, { temporary: true });
                if (!model?.system) continue;
                const groupResults = [];
                this._walkObject(model.system, "system", groupResults);
                if (groupResults.length > 0) allItemKeys[type] = groupResults;
            } catch (e) { console.warn(`Marketplace Builder | Could not map Item type "${type}".`, e); }
        }
        
        // --- ROLL KEYS ('data.' prefix) ---
        const allRollKeys = {};
        if (foundry.utils.hasProperty(game.shadowrun5e, "tests.SuccessTest")) {
            try {
                const testInstance = new game.shadowrun5e.tests.SuccessTest({});
                let rollResults = [];
                if (testInstance.data) this._walkObject(testInstance.data, "data", rollResults);
                if (rollResults.length > 0) allRollKeys["Roll Data"] = rollResults;
            } catch (e) { console.warn("Marketplace Builder | Could not map SR5e roll data keys.", e); }
        }

        // --- MODIFIER KEYS ---
        const allModifierKeys = {};
        const modifiersData = {
            environmental: { low_light_vision: '', image_magnification: '', tracer_rounds: '', smartlink: '', ultrasound: '', thermographic_vision: '' }
        };
        let modifierResults = [];
        this._walkObject(modifiersData, "", modifierResults);
        if (modifierResults.length > 0) allModifierKeys["Modifiers"] = modifierResults;
        
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
