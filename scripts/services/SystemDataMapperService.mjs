import { systemDataModel } from "./systemDataModel.mjs";

/**
 * A service to introspect the game system's data models and provide
 * structured lists of keys for use in effect builders, as well as authoritative
 * DataModel mappings for Items, Actors, and Active Effects in Shadowrun 5e.
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
     * Tries to find a localized label for a data model group key using the system's localization.
     * @param {string} key The key from the data model.
     * @returns {string} The localized label or a formatted fallback.
     * @private
     */
    static #createGroupLabel(key) {
        // Prioritize specific, known system localization keys from Shadowrun 5e
        const keyMap = {
            skills: "SR5.ActiveSkills",
            movement: "SR5.Movement",
            armor: "SR5.ItemTypes.Armor",
            matrix: "SR5.Labels.ActorSheet.Matrix",
            limits: "SR5.Limit",
            attributes: "SR5.Attributes",
            initiative: "SR5.Initiative",
            modifiers: "SR5.Modifiers"
        };

        const specificKey = keyMap[key];
        if (specificKey) {
            const localized = game.i18n.localize(specificKey);
            if (localized && localized !== specificKey) return localized;
        }

        if (key === 'armor') {
            const altArmor = game.i18n.localize("SR5.ArmorValue") || game.i18n.localize("SR5.Vehicle.Armor");
            if (altArmor && !altArmor.startsWith("SR5.")) return altArmor;
        }

        // Fallback for other keys, e.g., 'movement'
        const fallbackKey = `SR5.${key.charAt(0).toUpperCase() + key.slice(1)}`;
        const fallbackLocalized = game.i18n.localize(fallbackKey);
        if (fallbackLocalized && fallbackLocalized !== fallbackKey) return fallbackLocalized;

        return this.#createFallbackLabel(key); // Final fallback if nothing else is found
    }
    
    /**
     * Resolves a localized label for a field key and path, using system localization keys.
     * @param {string} key The field key.
     * @param {string} path The full field path.
     * @param {object} localizedMap An optional lookup map.
     * @returns {string} The localized label.
     */
    static _resolveFieldLabel(key, path = "", localizedMap = {}) {
        if (localizedMap && localizedMap[key]) return localizedMap[key];

        // Specific system mappings for movement, armor, tracks, and attributes
        const pathLookup = {
            // Movement
            "system.movement.walk": "SR5.Walk",
            "system.movement.run": "SR5.MovementTypes.Run",
            "system.movement.sprint": "SR5.MovementTypes.Sprint",
            "system.movement.swimming": "SR5.Skill.Swimming",

            // Actor Armor
            "system.armor.rating": "SR5.ArmorValue",
            "system.armor.hardened": "SR5.Armor.FIELDS.armor.hardened.label",
            "system.armor.elements.acid": "SR5.Armor.FIELDS.armor.acid.label",
            "system.armor.elements.cold": "SR5.Armor.FIELDS.armor.cold.label",
            "system.armor.elements.electricity": "SR5.Armor.FIELDS.armor.electricity.label",
            "system.armor.elements.fire": "SR5.Armor.FIELDS.armor.fire.label",
            "system.armor.elements.pollutant": "SR5.Armor.FIELDS.armor.pollutant.label",
            "system.armor.elements.radiation": "SR5.Armor.FIELDS.armor.radiation.label",
            "system.armor.elements.water": "SR5.Armor.FIELDS.armor.water.label",
            "system.armor.immunities.acid": "SR5.Element.Acid",
            "system.armor.immunities.cold": "SR5.Element.Cold",
            "system.armor.immunities.electricity": "SR5.Element.Electricity",
            "system.armor.immunities.fire": "SR5.Element.Fire",
            "system.armor.immunities.pollutant": "SR5.Element.Pollutant",
            "system.armor.immunities.radiation": "SR5.Element.Radiation",
            "system.armor.immunities.water": "SR5.Element.Water",
            "system.armor.immunities.normal_weapons": "SR5.Armor.Immunity.NormalWeapons",
            "system.armor.mod": "SR5.ModifiedArmor",
            "system.armor.label": "SR5.Armor.label",

            // Item Armor (system.armor.armor.*)
            "system.armor.armor.base": "SR5.Base",
            "system.armor.armor.value": "SR5.Armor.FIELDS.armor.value.label",
            "system.armor.armor.accessory": "SR5.Armor.FIELDS.armor.accessory.label",
            "system.armor.armor.hardened": "SR5.Armor.FIELDS.armor.hardened.label",
            "system.armor.armor.is_hardened": "SR5.Armor.FIELDS.armor.is_hardened.label",
            "system.armor.armor.elements.acid": "SR5.Armor.FIELDS.armor.acid.label",
            "system.armor.armor.elements.cold": "SR5.Armor.FIELDS.armor.cold.label",
            "system.armor.armor.elements.electricity": "SR5.Armor.FIELDS.armor.electricity.label",
            "system.armor.armor.elements.fire": "SR5.Armor.FIELDS.armor.fire.label",
            "system.armor.armor.elements.pollutant": "SR5.Armor.FIELDS.armor.pollutant.label",
            "system.armor.armor.elements.radiation": "SR5.Armor.FIELDS.armor.radiation.label",
            "system.armor.armor.elements.water": "SR5.Armor.FIELDS.armor.water.label",
            "system.armor.armor.immunities.base": "SR5.Armor.FIELDS.armor.immunities.label",
            "system.armor.armor.immunities.value": "SR5.Armor.FIELDS.armor.immunities.label",

            // Knowledge Skills
            "system.skills.knowledge.street": "SR5.KnowledgeSkillStreet",
            "system.skills.knowledge.academic": "SR5.KnowledgeSkillAcademic",
            "system.skills.knowledge.professional": "SR5.KnowledgeSkillProfessional",
            "system.skills.knowledge.interests": "SR5.KnowledgeSkillInterests"
        };

        const cleanPath = path.replace(/\.value$/, '');
        if (pathLookup[cleanPath]) {
            const loc = typeof game !== 'undefined' && game.i18n ? game.i18n.localize(pathLookup[cleanPath]) : null;
            if (loc && !loc.startsWith("SR5.")) return loc;
        }
        if (pathLookup[path]) {
            const loc = typeof game !== 'undefined' && game.i18n ? game.i18n.localize(pathLookup[path]) : null;
            if (loc && !loc.startsWith("SR5.")) return loc;
        }

        // Active skills path matching: system.skills.active.<skillKey>
        if (path.includes('skills.active.') || key in (typeof CONFIG !== 'undefined' && CONFIG.SR5?.activeSkills ? CONFIG.SR5.activeSkills : {})) {
            const skillMatch = path.match(/skills\.active\.([^.]+)/);
            const skillKey = (skillMatch ? skillMatch[1] : key).toLowerCase();
            const locKey = (typeof CONFIG !== 'undefined' && CONFIG.SR5?.activeSkills?.[skillKey]) || `SR5.Skill.${skillKey.charAt(0).toUpperCase() + skillKey.slice(1)}`;
            const loc = typeof game !== 'undefined' && game.i18n ? game.i18n.localize(locKey) : null;
            if (loc && !loc.startsWith("SR5.Skill.")) return loc;
        }

        // Check key-based system localizations
        const keyLookup = {
            walk: "SR5.Walk",
            run: "SR5.MovementTypes.Run",
            sprint: "SR5.MovementTypes.Sprint",
            swimming: "SR5.Skill.Swimming",
            rating: "SR5.ArmorValue",
            hardened: "SR5.Armor.FIELDS.armor.hardened.label",
            is_hardened: "SR5.Armor.FIELDS.armor.is_hardened.label",
            accessory: "SR5.Armor.FIELDS.armor.accessory.label",
            acid: "SR5.Armor.FIELDS.armor.acid.label",
            cold: "SR5.Armor.FIELDS.armor.cold.label",
            electricity: "SR5.Armor.FIELDS.armor.electricity.label",
            fire: "SR5.Armor.FIELDS.armor.fire.label",
            pollutant: "SR5.Armor.FIELDS.armor.pollutant.label",
            radiation: "SR5.Armor.FIELDS.armor.radiation.label",
            water: "SR5.Armor.FIELDS.armor.water.label",
            normal_weapons: "SR5.Armor.Immunity.NormalWeapons",
            elements: "SR5.Elements",
            immunities: "SR5.Armor.FIELDS.armor.immunities.label",
            street: "SR5.KnowledgeSkillStreet",
            academic: "SR5.KnowledgeSkillAcademic",
            professional: "SR5.KnowledgeSkillProfessional",
            interests: "SR5.KnowledgeSkillInterests"
        };

        if (keyLookup[key]) {
            const loc = typeof game !== 'undefined' && game.i18n ? game.i18n.localize(keyLookup[key]) : null;
            if (loc && !loc.startsWith("SR5.")) return loc;
        }

        const armorFieldLoc = typeof game !== 'undefined' && game.i18n ? game.i18n.localize(`SR5.Armor.FIELDS.armor.${key}.label`) : null;
        if (armorFieldLoc && !armorFieldLoc.startsWith("SR5.Armor.")) return armorFieldLoc;

        const elementLoc = typeof game !== 'undefined' && game.i18n ? game.i18n.localize(`SR5.Element.${key.charAt(0).toUpperCase() + key.slice(1)}`) : null;
        if (elementLoc && !elementLoc.startsWith("SR5.Element.")) return elementLoc;

        const skillLoc = typeof game !== 'undefined' && game.i18n ? game.i18n.localize(`SR5.Skill.${key.charAt(0).toUpperCase() + key.slice(1)}`) : null;
        if (skillLoc && !skillLoc.startsWith("SR5.Skill.")) return skillLoc;

        const genericLoc = typeof game !== 'undefined' && game.i18n ? game.i18n.localize(`SR5.${key.charAt(0).toUpperCase() + key.slice(1)}`) : null;
        if (genericLoc && !genericLoc.startsWith("SR5.")) return genericLoc;

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
            const label = this._resolveFieldLabel(key, newPath, localizedMap);

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
     * Recursively walks a schema fields object to find all valid data paths.
     * @param {object} fields The schema fields object to walk.
     * @param {string} path The current path prefix.
     * @param {Array<object>} results The array to push results into.
     * @param {object} localizedMap A map of keys to their localized labels.
     * @private
     */
    static _walkSchema(fields, path, results, localizedMap = {}) {
        for (const [key, field] of Object.entries(fields)) {
            if (key.startsWith("_") || key === "flags") continue;
            const newPath = path ? `${path}.${key}` : key;
            const label = this._resolveFieldLabel(key, newPath, localizedMap);

            if (field && typeof field === 'object') {
                if (field.fields) {
                    if ("value" in field.fields) {
                        results.push({ label: label, path: `${newPath}.value` });
                    } else {
                        this._walkSchema(field.fields, newPath, results, localizedMap);
                    }
                } else if (field.model) {
                    const subModel = field.model;
                    const subSchema = subModel.schema?.fields || subModel._schema?.fields || subModel._shema?.fields;
                    if (subSchema) {
                        if ("value" in subSchema) {
                            results.push({ label: label, path: `${newPath}.value` });
                        } else {
                            this._walkSchema(subSchema, newPath, results, localizedMap);
                        }
                    }
                } else {
                    results.push({ label: label, path: newPath });
                }
            }
        }
    }

    /**
     * Dynamically resolves all active skill keys from the system configured skills compendium,
     * respecting the 'SkillsPack' system setting (whether standard or custom compendium).
     * @returns {Array<{label: string, path: string}>}
     */
    static _resolveActiveSkillsKeys() {
        const results = [];
        const seenKeys = new Set();
        const SYSTEM_NAME = 'shadowrun5e';

        // 1. First populate canonical active skills from CONFIG.SR5.activeSkills using system localization
        const activeSkills = (typeof CONFIG !== 'undefined' && CONFIG.SR5?.activeSkills) || (typeof game !== 'undefined' && game.sr5marketplace?.api?.system?.activeSkills_l) || {};
        for (const [key, labelKey] of Object.entries(activeSkills)) {
            const normalizedKey = key.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
            const localizedLabel = (typeof game !== 'undefined' && game.i18n ? game.i18n.localize(labelKey) : labelKey) || labelKey;
            seenKeys.add(normalizedKey);
            results.push({
                label: localizedLabel,
                path: `system.skills.active.${normalizedKey}.value`
            });
        }

        // 2. Supplement with any custom skills from system configured SkillsPack
        try {
            let packName = null;
            if (typeof game !== 'undefined' && game.settings) {
                try {
                    packName = game.settings.get(SYSTEM_NAME, 'SkillsPack');
                } catch (e) {}
            }
            if (!packName && typeof CONFIG !== 'undefined' && CONFIG.SR5?.packNames?.['SkillsPack']) {
                packName = CONFIG.SR5.packNames['SkillsPack'];
            }
            if (!packName) {
                packName = 'sr5e-skills';
            }

            let pack = null;
            if (typeof game !== 'undefined' && game.packs) {
                pack = game.packs.get(packName) || 
                       game.packs.find(p => p.metadata?.name === packName || p.collection === packName);
                
                // Fallback to any active skill compendium if configured pack is not found
                if (!pack) {
                    pack = game.packs.find(p => 
                        p.metadata?.type === 'Item' && 
                        (p.metadata?.name === 'sr5e-skills' || p.metadata?.name === 'aktionsfertigkeiten' || p.metadata?.name === 'sr5e-skill-sets')
                    ) || game.packs.find(p => 
                        p.metadata?.type === 'Item' && 
                        (p.metadata?.name?.includes('skill') || p.metadata?.name?.includes('fertigkeit'))
                    );
                }
            }

            if (pack?.index) {
                for (const item of pack.index) {
                    const rawKey = item.system?.key || item.name || "";
                    const itemKey = rawKey.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
                    
                    if (!seenKeys.has(itemKey)) {
                        seenKeys.add(itemKey);
                        const locKey = (typeof CONFIG !== 'undefined' && CONFIG.SR5?.activeSkills?.[itemKey]) || `SR5.Skill.${itemKey.charAt(0).toUpperCase() + itemKey.slice(1)}`;
                        const loc = typeof game !== 'undefined' && game.i18n ? game.i18n.localize(locKey) : null;
                        const label = (loc && !loc.startsWith("SR5.Skill.")) ? loc : (typeof game !== 'undefined' && game.i18n ? game.i18n.localize(item.name) : item.name) || item.name;
                        results.push({
                            label: label,
                            path: `system.skills.active.${itemKey}.value`
                        });
                    }
                }
            }
        } catch (e) {
            console.warn("SystemDataMapperService | Could not load skills from compendium:", e);
        }

        // 3. Supplement with world skill items if present
        if (typeof game !== 'undefined' && game.items) {
            for (const item of game.items) {
                if (item.type === 'skill' || item.type === 'activeSkill') {
                    const rawKey = item.system?.key || item.name || "";
                    const itemKey = rawKey.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
                    if (!seenKeys.has(itemKey)) {
                        seenKeys.add(itemKey);
                        const locKey = (typeof CONFIG !== 'undefined' && CONFIG.SR5?.activeSkills?.[itemKey]) || `SR5.Skill.${itemKey.charAt(0).toUpperCase() + itemKey.slice(1)}`;
                        const loc = typeof game !== 'undefined' && game.i18n ? game.i18n.localize(locKey) : null;
                        const label = (loc && !loc.startsWith("SR5.Skill.")) ? loc : (typeof game !== 'undefined' && game.i18n ? game.i18n.localize(item.name) : item.name) || item.name;
                        results.push({
                            label: label,
                            path: `system.skills.active.${itemKey}.value`
                        });
                    }
                }
            }
        }

        results.sort((a, b) => a.label.localeCompare(b.label));
        return results;
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
                const actorModelClass = CONFIG.Actor.dataModels?.[type] || CONFIG.Actor.dataModels;
                const schema = actorModelClass?._schema || actorModelClass?.schema || actorModelClass?._shema;
                const fields = schema?.fields;

                const typeResults = {};

                if (fields) {
                    for (const groupKey in fields) {
                        if (this.#EXCLUDED_GROUPS.has(groupKey)) continue;
                        if (groupKey === 'skills') continue; // Handled authoritatively via _resolveActiveSkillsKeys below
                        const groupField = fields[groupKey];
                        
                        let subFields = null;
                        if (groupField && typeof groupField === 'object') {
                            if (groupField.fields) {
                                subFields = groupField.fields;
                            } else if (groupField.model) {
                                subFields = groupField.model.schema?.fields || groupField.model._schema?.fields || groupField.model._shema?.fields;
                            }
                        }

                        if (!subFields) continue;

                        const groupLabel = this.#createGroupLabel(groupKey);
                        const localMap = systemApi.getLocalizationMapForKey(groupKey);
                        let results = [];

                        this._walkSchema(subFields, `system.${groupKey}`, results, localMap);
                        
                        if (results.length > 0) {
                            if (groupKey === 'armor' && subFields.mod !== undefined) {
                                const modPath = 'system.armor.mod';
                                if (!results.some(r => r.path === modPath)) {
                                    results.push({ label: game.i18n.localize('SR5.ModifiedArmor') || "Mod. Armor", path: modPath });
                                }
                            }
                            
                            typeResults[groupLabel] = results;
                        }
                    }

                    // Ensure Aktionsfertigkeiten / Active Skills are fully populated from system compendium
                    const skillsGroupName = game.i18n.localize("SR5.ActiveSkills") || "Active Skills";
                    const resolvedSkills = this._resolveActiveSkillsKeys();
                    if (resolvedSkills.length > 0) {
                        typeResults[skillsGroupName] = resolvedSkills;
                    }

                    // Manually build and localize the Condition Tracks group
                    const tracksGroupName = game.i18n.localize("SR5.ConditionMonitor") || "Condition Monitor";
                    const tracks = [];
                    if (fields.physical_track) tracks.push({ label: game.i18n.localize("SR5.DmgTypePhysical"), path: "system.physical_track.value" });
                    if (fields.stun_track) tracks.push({ label: game.i18n.localize("SR5.DmgTypeStun"), path: "system.stun_track.value" });
                    if (fields.matrix_track) tracks.push({ label: game.i18n.localize("SR5.DmgTypeMatrix"), path: "system.matrix_track.value" });
                    
                    if (tracks.length > 0) {
                        typeResults[tracksGroupName] = tracks;
                    }
                } else {
                    // Fallback to temporary instance method
                    const model = new CONFIG.Actor.documentClass({ name: "temp-mapper", type: type }, { temporary: true });
                    if (model?.system) {
                        for (const groupKey in model.system) {
                            if (this.#EXCLUDED_GROUPS.has(groupKey)) continue;
                            if (groupKey === 'skills') continue; // Handled authoritatively via _resolveActiveSkillsKeys below
                            const groupData = model.system[groupKey];
                            if (typeof groupData !== 'object' || groupData === null) continue;

                            const groupLabel = this.#createGroupLabel(groupKey);
                            const localMap = systemApi.getLocalizationMapForKey(groupKey);
                            let results = [];

                            this._walkObject(groupData, `system.${groupKey}`, results, localMap);
                            
                            if (results.length > 0) {
                                if (groupKey === 'armor' && model.system.armor?.mod !== undefined) {
                                    const modPath = 'system.armor.mod';
                                    if (!results.some(r => r.path === modPath)) {
                                        results.push({ label: game.i18n.localize('SR5.ModifiedArmor') || "Mod. Armor", path: modPath });
                                    }
                                }
                                typeResults[groupLabel] = results;
                            }
                        }

                        const skillsGroupName = game.i18n.localize("SR5.ActiveSkills") || "Active Skills";
                        const resolvedSkills = this._resolveActiveSkillsKeys();
                        if (resolvedSkills.length > 0) {
                            typeResults[skillsGroupName] = resolvedSkills;
                        }

                        const tracksGroupName = game.i18n.localize("SR5.ConditionMonitor") || "Condition Monitor";
                        const tracks = [];
                        if (model.system.physical_track) tracks.push({ label: game.i18n.localize("SR5.DmgTypePhysical"), path: "system.physical_track.value" });
                        if (model.system.stun_track) tracks.push({ label: game.i18n.localize("SR5.DmgTypeStun"), path: "system.stun_track.value" });
                        if (model.system.matrix_track) tracks.push({ label: game.i18n.localize("SR5.DmgTypeMatrix"), path: "system.matrix_track.value" });
                        if (tracks.length > 0) {
                            typeResults[tracksGroupName] = tracks;
                        }
                    }
                }

                if (Object.keys(typeResults).length > 0) allActorKeys[type] = typeResults;
            } catch (e) { console.warn(`Could not map Actor type "${type}".`, e); }
        }

        // --- ITEMS ---
        const allItemKeys = {};
        const itemConfig = CONFIG.Item || CONFIG.Items;
        for (const type in systemApi.documentTypes.Item) {
            if (type === "base" || type.includes("sr5-marketplace")) continue;
            try {
                const itemModelClass = itemConfig?.dataModels?.[type];
                const schema = itemModelClass?._schema || itemModelClass?.schema || itemModelClass?._shema;
                const fields = schema?.fields;

                const groupResults = [];

                if (fields) {
                    this._walkSchema(fields, "system", groupResults, {});
                } else {
                    const model = new CONFIG.Item.documentClass({ name: "temp-mapper", type: type }, { temporary: true });
                    if (model?.system) {
                        SystemDataMapperService._walkObject(model.system, "system", groupResults, {});
                    }
                }

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

    /**
     * Normalizes a suffix to a restriction string ('none', 'restricted', 'forbidden').
     * @param {string} suffix
     * @returns {'none'|'restricted'|'forbidden'}
     */
    static restrictionFromSuffix(suffix) {
        if (!suffix) return "none";
        const upper = String(suffix).trim().toUpperCase();
        if (upper.endsWith("F") || upper.endsWith("V")) return "forbidden";
        if (upper.endsWith("R") || upper.endsWith("E")) return "restricted";
        return "none";
    }

    /**
     * Composes numeric value and restriction into display label (e.g. 12 + "restricted" -> "12R").
     * @param {number} value
     * @param {string} restriction
     * @returns {string}
     */
    static composeAvailabilityValue(value, restriction) {
        const val = Math.ceil(Number(value) || 0);
        if (restriction === "forbidden") return `${val}F`;
        if (restriction === "restricted") return `${val}R`;
        return `${val}`;
    }

    /**
     * Parses an availability representation into the system's standard availability structure:
     * { base: number, value: number, restriction: 'none' | 'restricted' | 'forbidden', label: string }
     * @param {string|number|object} avail
     * @returns {{base: number, value: number, restriction: string, label: string}}
     */
    static parseAvailability(avail) {
        if (avail === null || avail === undefined || avail === "" || avail === "0" || avail === 0) {
            return { base: 0, value: 0, restriction: "none", label: "0" };
        }

        if (typeof avail === "object") {
            const base = Number(avail.base ?? avail.value) || 0;
            const value = Number(avail.value ?? avail.base) || 0;
            let restriction = avail.restriction || "none";
            if (!["none", "restricted", "forbidden"].includes(restriction)) {
                restriction = this.restrictionFromSuffix(String(restriction));
            }
            const label = avail.label || this.composeAvailabilityValue(value, restriction);
            return { base, value, restriction, label };
        }

        const availStr = String(avail).trim();
        const cleaned = availStr.replace(/\([+-]\d{1,2}\)$/, "");
        const match = /^(\d+)(.*)$/.exec(cleaned);
        if (!match) {
            return { base: 0, value: 0, restriction: "none", label: availStr };
        }

        const num = parseInt(match[1], 10);
        const suffix = match[2]?.trim() || "";
        const restriction = this.restrictionFromSuffix(suffix);
        const label = this.composeAvailabilityValue(num, restriction);

        return {
            base: num,
            value: num,
            restriction: restriction,
            label: label
        };
    }

    /**
     * Converts a changes array or object into a normalized array of objects.
     * @param {Array|object} changes
     * @returns {Array<object>}
     */
    static changesToArray(changes) {
        if (!changes) return [];
        if (Array.isArray(changes)) return changes.filter(c => c !== null);
        if (typeof changes === 'object') {
            const keys = Object.keys(changes).sort((a, b) => Number(a) - Number(b));
            return keys.map(k => changes[k]).filter(c => c !== null);
        }
        return [];
    }

    /**
     * Normalizes an ActiveEffect object to the SR5 0.38+ / Foundry v14 ActiveEffect DataModel schema.
     * Migrates legacy flat properties (applyTo, effect.changes) into system.targets and system.changes.
     * @param {object} effect - Raw or partially updated effect object.
     * @returns {object} The normalized, schema-compliant effect object.
     */
    static normalizeActiveEffect(effect) {
        if (!effect || typeof effect !== 'object') return effect;

        effect._id = effect._id || foundry.utils.randomID();
        effect.type = effect.type || "base";
        effect.name = effect.name || "New Effect";
        effect.img = effect.img || "icons/svg/aura.svg";
        effect.disabled = effect.disabled ?? false;
        effect.transfer = effect.transfer ?? true;
        effect.statuses = Array.isArray(effect.statuses) ? effect.statuses : [];
        effect.duration = effect.duration || { startTime: null, combat: null };

        effect.system = effect.system || {};
        effect.system.appliedByTest = effect.system.appliedByTest ?? false;
        effect.system.onlyForEquipped = effect.system.onlyForEquipped ?? true;
        effect.system.onlyForWireless = effect.system.onlyForWireless ?? false;
        effect.system.expiryAction = effect.system.expiryAction || "default";

        // 1. Normalize Targets
        let targets = effect.system.targets;
        if (!Array.isArray(targets) || targets.length === 0) {
            const legacyApplyTo = effect.system.applyTo || effect.targetType || "actor";
            const conditions = [];

            if (Array.isArray(effect.system.selection_tests) && effect.system.selection_tests.length) {
                conditions.push({ type: "tests", mode: "include", values: [...effect.system.selection_tests] });
            }
            if (Array.isArray(effect.system.selection_categories) && effect.system.selection_categories.length) {
                conditions.push({ type: "categories", mode: "include", values: [...effect.system.selection_categories] });
            }
            if (Array.isArray(effect.system.selection_skills) && effect.system.selection_skills.length) {
                conditions.push({ type: "skills", mode: "include", values: [...effect.system.selection_skills] });
            }
            if (Array.isArray(effect.system.selection_attributes) && effect.system.selection_attributes.length) {
                conditions.push({ type: "attributes", mode: "include", values: [...effect.system.selection_attributes] });
            }
            if (Array.isArray(effect.system.selection_limits) && effect.system.selection_limits.length) {
                conditions.push({ type: "limits", mode: "include", values: [...effect.system.selection_limits] });
            }

            const targetId = foundry.utils.randomID();
            targets = [{
                id: targetId,
                name: "Target",
                applyTo: legacyApplyTo,
                conditions: conditions,
                onlyForItemTest: legacyApplyTo === "modifier" ? !!effect.system.onlyForItemTest : false
            }];
            effect.system.targets = targets;
        } else {
            effect.system.targets = targets.map((t, idx) => ({
                id: t.id || foundry.utils.randomID(),
                name: t.name || `Target ${idx + 1}`,
                applyTo: t.applyTo || "actor",
                conditions: Array.isArray(t.conditions) ? t.conditions : [],
                onlyForItemTest: !!t.onlyForItemTest
            }));
        }

        const primaryTargetId = effect.system.targets[0]?.id || foundry.utils.randomID();
        const primaryApplyTo = effect.system.targets[0]?.applyTo || "actor";
        effect.targetType = primaryApplyTo;

        // 2. Normalize Changes (from system.changes or legacy top-level changes)
        let rawChanges = effect.system.changes;
        if (!rawChanges && effect.changes) {
            rawChanges = effect.changes;
        }

        const changesList = this.changesToArray(rawChanges);
        const modeMap = { 0: 'add', 1: 'multiply', 2: 'add', 3: 'downgrade', 4: 'upgrade', 5: 'override' };

        if (changesList.length === 0) {
            effect.system.changes = [{
                key: "",
                type: "add",
                value: "",
                phase: "normal",
                priority: null,
                target: primaryTargetId
            }];
        } else {
            effect.system.changes = changesList.map(c => {
                let changeType = "add";
                if (typeof c.type === "string" && c.type) {
                    changeType = c.type === "custom" ? "add" : c.type;
                } else if (c.mode !== undefined && modeMap[c.mode]) {
                    changeType = modeMap[c.mode];
                }
                return {
                    key: c.key || "",
                    type: changeType,
                    value: c.value !== undefined && c.value !== null ? String(c.value) : "",
                    phase: c.phase || "normal",
                    priority: c.priority !== undefined ? c.priority : null,
                    target: c.target || primaryTargetId
                };
            });
        }

        // Clean up legacy flat keys
        delete effect.system.applyTo;
        delete effect.system.selection_tests;
        delete effect.system.selection_categories;
        delete effect.system.selection_skills;
        delete effect.system.selection_attributes;
        delete effect.system.selection_limits;
        delete effect.changes;

        return effect;
    }

    /**
     * Maps an item's build data according to the Shadowrun 5e DataModel schema.
     * @param {object} baseItemData - Raw or cloned item data object.
     * @param {object} totals - Precalculated totals (totalCost, combinedAvailability, totalEssence).
     * @param {object} [options={}]
     * @param {Array<object>} [options.embeddedMods=[]] - Slotted modification items to embed in the item.
     * @param {Array<object>} [options.linkedItems=[]] - Linked items metadata.
     * @param {Array<object>} [options.effects=[]] - Active effects to attach.
     * @returns {object} The mutated and schema-compliant item data.
     */
    static mapItemData(baseItemData, totals = {}, { embeddedMods = [], linkedItems = [], effects = [] } = {}) {
        if (!baseItemData || typeof baseItemData !== "object") return baseItemData;

        if (!baseItemData.system) baseItemData.system = {};

        // 1. Cost & Technology Cost
        const totalCost = Math.max(0, Number(totals.totalCost) || 0);
        const costPath = systemDataModel.getCostPath(baseItemData);
        const currentCost = foundry.utils.getProperty(baseItemData, costPath);
        if (currentCost !== null && typeof currentCost === "object" && "value" in currentCost) {
            foundry.utils.setProperty(baseItemData, `${costPath}.value`, totalCost);
            if ("base" in currentCost) {
                foundry.utils.setProperty(baseItemData, `${costPath}.base`, totalCost);
            }
        } else {
            foundry.utils.setProperty(baseItemData, costPath, totalCost);
        }

        // 2. Availability
        const parsedAvail = this.parseAvailability(totals.combinedAvailability);
        const availPath = systemDataModel.getAvailabilityPath(baseItemData);
        const currentAvail = foundry.utils.getProperty(baseItemData, availPath);
        if (currentAvail !== null && typeof currentAvail === "object") {
            foundry.utils.setProperty(baseItemData, availPath, {
                ...currentAvail,
                base: parsedAvail.base,
                value: parsedAvail.value,
                restriction: parsedAvail.restriction,
                label: parsedAvail.label
            });
        } else {
            const schema = systemDataModel.getItemSchema(baseItemData);
            const isObjectSchema = schema && (
                schema.fields?.technology?.fields?.availability ||
                schema.fields?.availability
            );
            if (isObjectSchema) {
                foundry.utils.setProperty(baseItemData, availPath, {
                    base: parsedAvail.base,
                    value: parsedAvail.value,
                    restriction: parsedAvail.restriction,
                    label: parsedAvail.label
                });
            } else {
                foundry.utils.setProperty(baseItemData, availPath, parsedAvail.label);
            }
        }

        // 3. Essence
        if (totals.totalEssence !== undefined && totals.totalEssence !== null) {
            const totalEssence = Number(totals.totalEssence) || 0;
            const essencePath = systemDataModel.hasTechnology(baseItemData)
                ? "system.technology.essence"
                : "system.essence";
            const currentEssence = foundry.utils.getProperty(baseItemData, essencePath);
            if (currentEssence !== null && typeof currentEssence === "object" && "value" in currentEssence) {
                foundry.utils.setProperty(baseItemData, `${essencePath}.value`, totalEssence);
            } else if (currentEssence !== undefined) {
                foundry.utils.setProperty(baseItemData, essencePath, totalEssence);
            }
        }

        // 4. Embedded Modifications (Flags container for Shadowrun 5e items)
        if (!baseItemData.flags) baseItemData.flags = {};
        if (!baseItemData.flags.shadowrun5e) baseItemData.flags.shadowrun5e = {};
        if (Array.isArray(embeddedMods) && embeddedMods.length > 0) {
            baseItemData.flags.shadowrun5e.embeddedItems = embeddedMods.map(mod => {
                const modClone = foundry.utils.deepClone(mod);
                modClone._id = modClone._id || foundry.utils.randomID();
                if (modClone.system) {
                    modClone.system.equipped = true;
                }
                return modClone;
            });
        } else {
            baseItemData.flags.shadowrun5e.embeddedItems = [];
        }

        // 5. Active Effects
        const rawEffects = effects && effects.length > 0 ? effects : (baseItemData.effects || []);
        baseItemData.effects = rawEffects.map(e => this.normalizeActiveEffect(foundry.utils.deepClone(e)));

        return baseItemData;
    }

    /**
     * Maps a vehicle actor's build data according to the Shadowrun 5e DataModel schema.
     * @param {object} vehicleData - Raw or cloned actor data of type vehicle.
     * @param {object} totals - Precalculated totals (totalCost, combinedAvailability).
     * @param {object} [options={}]
     * @param {Array<object>} [options.embeddedItems=[]] - Installed modifications/items.
     * @param {Array<object>} [options.effects=[]] - Active effects to attach.
     * @returns {object} The mutated and schema-compliant vehicle data.
     */
    static mapVehicleData(vehicleData, totals = {}, { embeddedItems = [], effects = [] } = {}) {
        if (!vehicleData || typeof vehicleData !== "object") return vehicleData;

        if (!vehicleData.system) vehicleData.system = {};

        // 1. Cost
        const totalCost = Math.max(0, Number(totals.totalCost) || 0);
        if (typeof vehicleData.system.cost === "object" && vehicleData.system.cost !== null) {
            vehicleData.system.cost.value = totalCost;
            if ("base" in vehicleData.system.cost) {
                vehicleData.system.cost.base = totalCost;
            }
        } else {
            vehicleData.system.cost = totalCost;
        }

        // 2. Availability
        const parsedAvail = this.parseAvailability(totals.combinedAvailability);
        if (typeof vehicleData.system.availability === "object" && vehicleData.system.availability !== null) {
            vehicleData.system.availability = {
                ...vehicleData.system.availability,
                base: parsedAvail.base,
                value: parsedAvail.value,
                restriction: parsedAvail.restriction,
                label: parsedAvail.label
            };
        } else {
            vehicleData.system.availability = parsedAvail.label;
        }

        // 3. Embedded Items (installed modifications)
        const priorNonMods = (vehicleData.items || []).filter(i => i.type !== "modification");
        vehicleData.items = [...priorNonMods, ...embeddedItems.map(item => {
            const itemClone = foundry.utils.deepClone(item);
            itemClone._id = itemClone._id || foundry.utils.randomID();
            if (itemClone.system) {
                itemClone.system.equipped = true;
            }
            return itemClone;
        })];

        // 4. Active Effects
        const rawEffects = effects && effects.length > 0 ? effects : (vehicleData.effects || []);
        vehicleData.effects = rawEffects.map(e => this.normalizeActiveEffect(foundry.utils.deepClone(e)));

        return vehicleData;
    }

    // Instance method bridges for ease of consumption on singletons
    parseAvailability(avail) {
        return SystemDataMapperService.parseAvailability(avail);
    }

    normalizeActiveEffect(effect) {
        return SystemDataMapperService.normalizeActiveEffect(effect);
    }

    mapItemData(baseItemData, totals, options) {
        return SystemDataMapperService.mapItemData(baseItemData, totals, options);
    }

    mapVehicleData(vehicleData, totals, options) {
        return SystemDataMapperService.mapVehicleData(vehicleData, totals, options);
    }

    getMappableKeys() {
        return SystemDataMapperService.getMappableKeys();
    }
}