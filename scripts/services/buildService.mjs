import { MODULE_ID } from "../lib/constants.mjs";
import { DefaultEffect } from "../lib/DefaultEffect.mjs";
import { SystemDataMapperService } from "./SystemDataMapperService.mjs";
import { FactoryFlow } from "./factoryFlow.mjs";

const FLAG_SCOPE = MODULE_ID;
const FLAG_KEY = "itemBuilderState";

/**
 * Service to manage virtual modifications flags on vehicle actors.
 */
export class BuildService {
    /**
     * Helper to resolve base actor and current virtual modifications.
     * @param {Actor} vehicle - The vehicle actor document.
     * @returns {object} Base actor and virtual modifications.
     * @private
     */
    _getVirtualModsInfo(vehicle) {
        const baseVehicle = game.actors.get(vehicle.id) || vehicle;
        const isLinked = vehicle.token ? vehicle.token.actorLink : true;
        const shouldUpdateBase = isLinked && (baseVehicle !== vehicle);
        const virtualMods = vehicle.getFlag(MODULE_ID, "virtualModifications") ||
            (shouldUpdateBase ? baseVehicle.getFlag(MODULE_ID, "virtualModifications") : []) || [];
        return { baseVehicle, shouldUpdateBase, virtualMods };
    }

    /**
     * Retrieves the planned virtual modifications list from a vehicle actor.
     * @param {Actor} vehicle - The vehicle actor document.
     * @returns {object[]} Planned virtual modifications list.
     */
    getVirtualModifications(vehicle) {
        if (!vehicle) return [];
        const { virtualMods } = this._getVirtualModsInfo(vehicle);
        return virtualMods;
    }

    /**
     * Saves the virtual modifications list back to the vehicle actor's flags.
     * Handles standard actor updates and GM socket fallback when the user is not owner.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {object[]} virtualMods - The virtual modifications array.
     * @returns {Promise<void>}
     */
    async saveVirtualModifications(vehicle, virtualMods) {
        if (!vehicle) return;

        const { baseVehicle, shouldUpdateBase } = this._getVirtualModsInfo(vehicle);
        const targetActor = shouldUpdateBase ? baseVehicle : vehicle;

        if (targetActor.isOwner) {
            if (virtualMods && virtualMods.length > 0) {
                await targetActor.setFlag(MODULE_ID, "virtualModifications", virtualMods);
            } else {
                await targetActor.unsetFlag(MODULE_ID, "virtualModifications");
            }
        } else if (game.users.activeGM) {
            const hasMods = virtualMods && virtualMods.length > 0;
            const updateKey = hasMods 
                ? `flags.${MODULE_ID}.virtualModifications` 
                : `flags.${MODULE_ID}.-=virtualModifications`;
            const updateVal = hasMods ? virtualMods : null;

            game.socket.emit("module.sr5-marketplace", {
                action: "update_actor_field",
                actorUuid: targetActor.uuid,
                updateData: {
                    [updateKey]: updateVal
                }
            });
        }
    }

    /**
     * Appends a virtual modification to the vehicle actor.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {object} virtualMod - The virtual modification data.
     * @returns {Promise<void>}
     */
    async addVirtualModification(vehicle, virtualMod) {
        if (!vehicle || !virtualMod) return;
        const virtualMods = this.getVirtualModifications(vehicle);
        virtualMods.push(virtualMod);
        await this.saveVirtualModifications(vehicle, virtualMods);
    }

    /**
     * Updates an individual virtual modification's properties.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {string} virtualModId - The unique virtual modification ID.
     * @param {object} updateData - Key/value pairs to merge.
     * @returns {Promise<void>}
     */
    async updateVirtualModification(vehicle, virtualModId, updateData) {
        if (!vehicle || !virtualModId) return;
        const virtualMods = this.getVirtualModifications(vehicle);
        const vMod = virtualMods.find(m => m.id === virtualModId);
        if (!vMod) return;
        foundry.utils.mergeObject(vMod, updateData);
        await this.saveVirtualModifications(vehicle, virtualMods);
    }

    /**
     * Filters out and removes a planned virtual modification from the vehicle actor.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {string} virtualModId - The virtual modification ID.
     * @returns {Promise<void>}
     */
    async removeVirtualModification(vehicle, virtualModId) {
        if (!vehicle || !virtualModId) return;
        const virtualMods = this.getVirtualModifications(vehicle);
        const updatedMods = virtualMods.filter(m => m.id !== virtualModId);
        await this.saveVirtualModifications(vehicle, updatedMods);
    }

    /**
     * Checks inventory stock status and syncs source metadata.
     * Exposes stock checking and sync parameters.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {Actor} workshopActor - The workshop/factory actor document.
     * @param {Actor} purchasingActor - The selected purchasing actor document.
     * @returns {Promise<boolean>} Whether the flags were updated.
     */
    async syncVirtualModificationsStock(vehicle, workshopActor, purchasingActor) {
        if (!vehicle) return false;

        const virtualMods = this.getVirtualModifications(vehicle);
        if (virtualMods.length === 0) return false;

        // Instantiate FactoryFlow statically imported to prevent dynamic import warning
        const factoryFlow = new FactoryFlow();

        let flagUpdated = false;
        for (const vMod of virtualMods) {
            const stockResult = factoryFlow.checkInventoryStock(vehicle, workshopActor, purchasingActor, vMod.id);
            if (stockResult.allInStock) {
                const detail = stockResult.details?.[0];
                if (detail) {
                    const hasOwnerStock = detail.purchasingQty > 0 && detail.purchasingItems.length > 0;
                    const hasWorkshopStock = detail.workshopQty > 0 && detail.workshopEntryId;

                    let resolvedSource = vMod.installSource || "workshop";
                    let resolvedSourceId = vMod.installSourceId || null;

                    if (hasOwnerStock) {
                        resolvedSource = "owner";
                        resolvedSourceId = detail.purchasingItems[0].id;
                    } else if (hasWorkshopStock) {
                        resolvedSource = "workshop";
                        resolvedSourceId = detail.workshopEntryId;
                    }

                    if (!vMod.inStock || vMod.installSource !== resolvedSource || vMod.installSourceId !== resolvedSourceId || vMod.inBasket || vMod.basketItemId) {
                        vMod.inStock = true;
                        vMod.installSource = resolvedSource;
                        vMod.installSourceId = resolvedSourceId;
                        delete vMod.inBasket;
                        delete vMod.basketItemId;
                        flagUpdated = true;
                    }
                }
            } else {
                if (vMod.inStock) {
                    vMod.inStock = false;
                    vMod.installSourceId = null;
                    flagUpdated = true;
                }
            }
        }

        if (flagUpdated) {
            await this.saveVirtualModifications(vehicle, virtualMods);
        }

        return flagUpdated;
    }

    /**
     * Converts a changes array or object into a normalized array of objects.
     * @param {Array|object} changes - The changes to normalize.
     * @returns {Array<object>} A normalized array.
     */
    _changesToArray(changes) {
        if (!changes) return [];
        if (Array.isArray(changes)) return changes.filter(c => c !== null);
        if (typeof changes === 'object') {
            // Sort keys numerically to preserve order
            const keys = Object.keys(changes).sort((a, b) => Number(a) - Number(b));
            return keys.map(k => changes[k]).filter(c => c !== null);
        }
        return [];
    }

    /**
     * Converts a changes array or object into an indexed object.
     * @param {Array|object} changes - The changes to convert.
     * @returns {object} An indexed object.
     */
    _changesToObject(changes) {
        if (!changes) return {};
        if (typeof changes === 'object' && !Array.isArray(changes)) return changes;
        const obj = {};
        if (Array.isArray(changes)) {
            changes.forEach((c, idx) => {
                if (c !== null) obj[String(idx)] = c;
            });
        }
        return obj;
    }

    /**
     * Gets the default, empty state for the builder.
     * @returns {object} The default state object.
     * @private
     */
    _getDefaultBuilderState() {
        return {
            title: null,
            baseItem: null,
            modifications: [],
            changes: {}, // later a {object with changes.modslot1 to modslot5 and changes.bottomSlot1 to 4 but can be expanded}
            itemTypeImage: null,
            draftEffect: null,
            isDerivedValueSelectorVisible: false,
            isEditingBaseItem: false,
            baseItemOverrides: {}
        };
    }

    /**
     * Retrieves the current builder state from the user's flags.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The builder state.
     */
    async getBuilderState(userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return this._getDefaultBuilderState();
        const state = user.getFlag(FLAG_SCOPE, FLAG_KEY);
        return foundry.utils.mergeObject(this._getDefaultBuilderState(), state || {});
    }

    /**
     * Updates one or more properties in the builder state flag.
     * @param {object} updateData - An object with the properties to update.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    async updateBuilderState(updateData, userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return;
        const currentState = await this.getBuilderState(userId);
        const newState = foundry.utils.mergeObject(currentState, updateData);
        await user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
    }

    /**
     * Sets the base item, its image, and the dynamic title.
     * If the new item is DIFFERENT from the current base item, this clears any previous build state.
    /**
     * Resolves a default icon path for a modification based on its mount point.
     * @param {string} [mountKey=""]
     * @returns {string}
     * @private
     */
    _getDefaultModImage(mountKey = "") {
        const key = String(mountKey).toLowerCase().trim();
        const validMounts = ["top", "under", "barrel", "stock", "side"];
        if (validMounts.includes(key)) {
            return `systems/shadowrun5e/dist/icons/importer/modification/${key}.svg`;
        }
        return "icons/svg/item-bag.svg";
    }

    /**
     * Extracts existing modifications from an item or actor document/data and maps
     * them into builder slots.
     * @param {object} itemOrData - Item document or plain data object.
     * @returns {Promise<object>} Map of slotId -> modification item data.
     */
    async extractItemModifications(itemOrData) {
        if (!itemOrData) return {};

        // If it's a data object with a uuid, attempt to fetch the full document
        let doc = null;
        if (typeof itemOrData.getFlag === "function") {
            doc = itemOrData;
        } else if (itemOrData.uuid) {
            try {
                doc = await fromUuid(itemOrData.uuid);
            } catch (err) {
                console.warn(`SR5 Marketplace | Could not fetch document for UUID: ${itemOrData.uuid}`, err);
            }
        }

        const changes = {};
        const slottedIds = new Set();
        const slottedUuids = new Set();
        const slottedNameCounts = new Map();

        const baseType = doc?.type || itemOrData.type || "";
        const isWeapon = ['rangedWeapon', 'meleeWeapon', 'weapon'].includes(baseType);

        const MOUNT_SLOT_MAP = {
            top: "topLeft",
            under: "bottomLeft",
            barrel: "topRight",
            stock: "middleRight",
            side: "bottomRight"
        };

        const BOTTOM_SLOTS = ["bottomSlot1", "bottomSlot2", "bottomSlot3", "bottomSlot4"];
        const PERIMETER_SLOTS = ["topLeft", "bottomLeft", "topRight", "middleRight", "bottomRight"];
        const ALL_SLOTS = [...BOTTOM_SLOTS, ...PERIMETER_SLOTS];

        const markSlotted = (slotId, mod) => {
            changes[slotId] = mod;
            if (mod._id) slottedIds.add(String(mod._id));
            if (mod.id) slottedIds.add(String(mod.id));
            if (mod.uuid) slottedUuids.add(String(mod.uuid));
            if (mod.flags?.core?.sourceId) slottedUuids.add(String(mod.flags.core.sourceId));
            if (mod.name) {
                const n = String(mod.name).toLowerCase().trim();
                slottedNameCounts.set(n, (slottedNameCounts.get(n) || 0) + 1);
            }
        };

        const isAlreadySlotted = (mod) => {
            if (!mod) return true;
            const id = mod._id || mod.id;
            if (id && slottedIds.has(String(id))) return true;
            if (mod.uuid && slottedUuids.has(String(mod.uuid))) return true;
            if (mod.flags?.core?.sourceId && slottedUuids.has(String(mod.flags.core.sourceId))) return true;
            const name = String(mod.name || "").toLowerCase().trim();
            if (name && (slottedNameCounts.get(name) || 0) > 0) {
                slottedNameCounts.set(name, slottedNameCounts.get(name) - 1);
                return true;
            }
            return false;
        };

        // 1. Existing Marketplace Changes (if previously customized in builder)
        const savedChanges = doc?.getFlag?.("sr5-marketplace", "changes") ||
            doc?.flags?.["sr5-marketplace"]?.changes ||
            itemOrData?.flags?.["sr5-marketplace"]?.changes;

        if (savedChanges && typeof savedChanges === "object") {
            for (const [slotId, rawModData] of Object.entries(savedChanges)) {
                if (rawModData && ALL_SLOTS.includes(slotId)) {
                    const modData = foundry.utils.deepClone(rawModData);
                    if (modData.system) {
                        const mount = modData.system.mod_weapon?.mount_point || modData.system.mount_point;
                        if (mount) {
                            modData.system.mount_point = mount;
                            if (modData.system.mod_weapon && !modData.system.mod_weapon.mount_point) {
                                modData.system.mod_weapon.mount_point = mount;
                            }
                        }
                    }
                    markSlotted(slotId, modData);
                }
            }
        }

        // 2. Existing Marketplace Linked Items (if any links were recorded)
        const linkedItems = doc?.getFlag?.("sr5-marketplace", "linkedItems") ||
            doc?.flags?.["sr5-marketplace"]?.linkedItems ||
            itemOrData?.flags?.["sr5-marketplace"]?.linkedItems;

        if (Array.isArray(linkedItems) && linkedItems.length > 0) {
            for (const link of linkedItems) {
                const { slotId, uuid } = link || {};
                if (!slotId || !uuid || changes[slotId]) continue;
                try {
                    const linkedDoc = await fromUuid(uuid);
                    if (linkedDoc && !isAlreadySlotted(linkedDoc)) {
                        const linkedData = {
                            uuid: linkedDoc.uuid,
                            name: linkedDoc.name,
                            img: linkedDoc.img || "icons/svg/item-bag.svg",
                            type: linkedDoc.type,
                            system: foundry.utils.deepClone(linkedDoc.system || {}),
                            effects: linkedDoc.effects ? (Array.isArray(linkedDoc.effects) ? linkedDoc.effects.map(e => typeof e?.toObject === 'function' ? e.toObject(false) : foundry.utils.deepClone(e)) : []) : []
                        };
                        if (linkedData.system?.mod_weapon?.mount_point) {
                            linkedData.system.mount_point = linkedData.system.mod_weapon.mount_point;
                        }
                        markSlotted(slotId, linkedData);
                    }
                } catch (err) {
                    console.warn(`SR5 Marketplace | Could not resolve linked item ${uuid}:`, err);
                }
            }
        }

        // 3. Collect all embedded and attached modifications
        const rawModsToProcess = [];

        // 3a. System embeddedItems on weapons/armor (flags.shadowrun5e.embeddedItems)
        const embeddedItems = doc?.getFlag?.("shadowrun5e", "embeddedItems") ||
            doc?.flags?.shadowrun5e?.embeddedItems ||
            itemOrData?.flags?.shadowrun5e?.embeddedItems;

        if (Array.isArray(embeddedItems)) {
            for (const mod of embeddedItems) {
                if (mod && (mod.type === "modification" || !mod.type)) {
                    rawModsToProcess.push(mod);
                }
            }
        }

        // 3b. Nested items if provided by system helper
        if (typeof doc?.getNestedItems === "function") {
            try {
                const nested = doc.getNestedItems();
                if (Array.isArray(nested)) {
                    for (const n of nested) {
                        if (n && n.type === "modification") rawModsToProcess.push(n);
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        // 3c. Actor items (e.g. for Vehicles / Drones)
        if (doc?.items) {
            const vehicleMods = doc.items.filter(i => i.type === "modification");
            for (const m of vehicleMods) {
                rawModsToProcess.push(typeof m.toObject === "function" ? m.toObject(false) : m);
            }
        } else if (Array.isArray(itemOrData.items)) {
            for (const m of itemOrData.items) {
                if (m && m.type === "modification") rawModsToProcess.push(m);
            }
        }

        // 3d. Virtual modifications on vehicles
        const virtualMods = doc?.getFlag?.("sr5-marketplace", "virtualModifications") ||
            doc?.flags?.["sr5-marketplace"]?.virtualModifications ||
            itemOrData?.flags?.["sr5-marketplace"]?.virtualModifications;

        if (Array.isArray(virtualMods)) {
            for (const vm of virtualMods) {
                if (vm) rawModsToProcess.push(vm);
            }
        }

        // 4. Assign each unprocessed modification to an appropriate slot
        for (const rawMod of rawModsToProcess) {
            if (isAlreadySlotted(rawMod)) continue;

            const modObj = typeof rawMod.toObject === 'function' ? rawMod.toObject(false) : rawMod;
            const mount = modObj.system?.mod_weapon?.mount_point || modObj.system?.mount_point || "";
            const mountKey = String(mount).toLowerCase().trim();

            let modUuid = modObj.uuid || modObj.flags?.core?.sourceId || "";
            if (!modUuid && doc?.uuid) {
                modUuid = `${doc.uuid}#${modObj._id || modObj.id || foundry.utils.randomID()}`;
            }

            const cleanModData = {
                _id: modObj._id || modObj.id || foundry.utils.randomID(),
                uuid: modUuid,
                name: modObj.name || "Modification",
                img: modObj.img || this._getDefaultModImage(mountKey),
                type: modObj.type || "modification",
                system: foundry.utils.deepClone(modObj.system || {}),
                effects: modObj.effects ? (Array.isArray(modObj.effects) ? modObj.effects.map(e => typeof e?.toObject === 'function' ? e.toObject(false) : foundry.utils.deepClone(e)) : []) : []
            };

            if (cleanModData.system?.mod_weapon?.mount_point) {
                cleanModData.system.mount_point = cleanModData.system.mod_weapon.mount_point;
            } else if (cleanModData.system?.mount_point && cleanModData.system.mod_weapon) {
                cleanModData.system.mod_weapon.mount_point = cleanModData.system.mount_point;
            }

            let assignedSlot = null;

            // Weapon mount logic
            if (isWeapon && mountKey && MOUNT_SLOT_MAP[mountKey]) {
                const preferredSlot = MOUNT_SLOT_MAP[mountKey];
                if (!changes[preferredSlot]) {
                    assignedSlot = preferredSlot;
                }
            }

            // Fallback placement:
            if (!assignedSlot) {
                assignedSlot = BOTTOM_SLOTS.find(s => !changes[s]) || PERIMETER_SLOTS.find(s => !changes[s]);
            }

            if (assignedSlot) {
                markSlotted(assignedSlot, cleanModData);
            } else {
                console.warn(`SR5 Marketplace | No empty slot available for modification "${cleanModData.name}"`);
            }
        }

        return changes;
    }

    /**
     * Sets the base item, its image, and the dynamic title.
     * Automatically extracts and populates any pre-existing modifications into slots.
     * If the new item is the SAME as the current one, the state is preserved unless forceReset is true.
     * @param {object|null} itemData - The data object for the base item.
     * @param {string|null} [userId=null] - The ID of the user.
     * @param {object} [options={}] - Optional configuration (document, forceReset).
     * @returns {Promise<void>}
     */
    async setBuilderBaseItem(itemData, userId = null, options = {}) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return;
        const currentState = await this.getBuilderState(userId);
        const newBaseItemUuid = itemData?.uuid || null;
        const oldBaseItemUuid = currentState.baseItem?.uuid || null;

        if (newBaseItemUuid === oldBaseItemUuid && !options.forceReset) {
            return; 
        }

        // --- IT'S A DIFFERENT ITEM (or null, or forceReset) ---
        await user.unsetFlag(FLAG_SCOPE, FLAG_KEY);

        if (itemData) {
            const newState = this._getDefaultBuilderState();
            newState.baseItem = itemData;
            
            let itemTypeImagePath = game.sr5marketplace?.api?.itemData?.getRepresentativeImage(itemData) || itemData.img;
            newState.itemTypeImage = itemTypeImagePath;

            const typeLabel = itemData.type ? (itemData.type.charAt(0).toUpperCase() + itemData.type.slice(1)) : "Item";
            newState.title = `${typeLabel}: ${itemData.name}`;

            // Extract and map all pre-existing modifications into builder slots
            newState.changes = await this.extractItemModifications(options.document || itemData);

            await user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
        }
    }

    /**
     * Adds a modification to the list.
     * @param {object} modData - The data object for the modification item.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    async addBuilderModification(modData, userId = null) {
        const state = await this.getBuilderState(userId);
        state.modifications.push(modData);
        await this.updateBuilderState({ modifications: state.modifications }, userId);
    }

    /**
     * Adds or updates a change for a specific mod slot.
     * @param {string} slotId - The ID of the slot (e.g., "bottomSlot1").
     * @param {object} itemData - The data object of the item being dropped.
     * @param {string|null} [userId=null] - The ID of the user.
     */
    async addBuilderChange(slotId, itemData, userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return;
        const state = await this.getBuilderState(userId);
        state.changes[slotId] = itemData;
        await user.setFlag(FLAG_SCOPE, FLAG_KEY, state);
    }
    
    /**
     * Removes a change for a specific mod slot using a direct database update.
     * @param {string} slotId - The ID of the slot to clear (e.g., "bottomSlot1").
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    async removeBuilderChange(slotId, userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return;
        const path = `flags.${FLAG_SCOPE}.${FLAG_KEY}.changes.-=${slotId}`;
        await user.update({ [path]: null });
    }

    /**
     * Begins the effect creation process by creating a default draft effect in the state.
     * @param {string} sourceUuid - The UUID of the item the effect will belong to.
    /**
     * Normalizes an ActiveEffect object (innate, custom, or legacy) to the SR5 0.38+ / Foundry v14 schema.
     * Delegates to the authoritative SystemDataMapperService.
     * @param {object} effect - The raw or partially updated effect object.
     * @returns {object} The normalized effect object.
     */
    _normalizeEffect(effect) {
        return SystemDataMapperService.normalizeActiveEffect(effect);
    }

    /**
     * Begins the effect creation process by creating a default draft effect in the state.
     * @param {string} sourceUuid - The UUID of the item the effect will belong to.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    async startBuilderEffectCreation(sourceUuid, userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return this._getDefaultBuilderState();
        const state = await this.getBuilderState(userId);
        
        state.draftEffect = await DefaultEffect.create(sourceUuid);
        
        await user.setFlag(FLAG_SCOPE, FLAG_KEY, state);
        return state;
    }

    /**
     * Updates the current draft effect with new data.
     * @param {object} draftUpdate - An object containing the new data for the draft effect.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    async updateBuilderDraftEffect(draftUpdate, userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return this._getDefaultBuilderState();
        const state = await this.getBuilderState(userId);
        if (!state.draftEffect) return state;

        let draft = this._normalizeEffect(state.draftEffect);

        // Handle target conditions / applyTo / changes if provided in legacy or nested format
        if (draftUpdate.changes) {
            const rawChanges = this._changesToArray(draftUpdate.changes);
            const targetId = draft.system?.targets?.[0]?.id || "actor";
            const modeMap = { 0: 'add', 1: 'multiply', 2: 'add', 3: 'downgrade', 4: 'upgrade', 5: 'override' };
            const normalizedChanges = rawChanges.map((c, i) => {
                const prevChange = draft.system.changes[i] || draft.system.changes[0] || {};
                return {
                    key: c.key !== undefined ? c.key : (prevChange.key || ""),
                    type: typeof c.type === 'string' ? c.type : (c.mode !== undefined && modeMap[c.mode] ? modeMap[c.mode] : (prevChange.type || "add")),
                    value: c.value !== undefined ? String(c.value) : (prevChange.value ?? ""),
                    priority: c.priority !== undefined ? c.priority : (prevChange.priority ?? null),
                    target: c.target || prevChange.target || targetId
                };
            });
            draft.system.changes = normalizedChanges;
            delete draftUpdate.changes;
        }

        // Handle flat system condition updates if coming from multi-selects
        if (draftUpdate.system?.selection_tests !== undefined ||
            draftUpdate.system?.selection_categories !== undefined ||
            draftUpdate.system?.selection_skills !== undefined ||
            draftUpdate.system?.selection_attributes !== undefined ||
            draftUpdate.system?.selection_limits !== undefined) {
            
            const target = draft.system.targets[0];
            if (target) {
                const conditionMap = {
                    tests: draftUpdate.system.selection_tests,
                    categories: draftUpdate.system.selection_categories,
                    skills: draftUpdate.system.selection_skills,
                    attributes: draftUpdate.system.selection_attributes,
                    limits: draftUpdate.system.selection_limits
                };
                
                target.conditions = target.conditions.filter(c => conditionMap[c.type] === undefined);
                for (const [type, values] of Object.entries(conditionMap)) {
                    if (Array.isArray(values) && values.length > 0) {
                        target.conditions.push({ type, mode: "include", values: [...values] });
                    }
                }
            }
            delete draftUpdate.system.selection_tests;
            delete draftUpdate.system.selection_categories;
            delete draftUpdate.system.selection_skills;
            delete draftUpdate.system.selection_attributes;
            delete draftUpdate.system.selection_limits;
        }

        // Handle system.applyTo update
        if (draftUpdate.system?.applyTo) {
            if (draft.system.targets[0]) {
                draft.system.targets[0].applyTo = draftUpdate.system.applyTo;
            }
            draft.targetType = draftUpdate.system.applyTo;
            delete draftUpdate.system.applyTo;
        }

        draft = foundry.utils.mergeObject(draft, draftUpdate);
        state.draftEffect = this._normalizeEffect(draft);
        
        await user.setFlag(FLAG_SCOPE, FLAG_KEY, state);
        return state;
    }

    /**
     * A specialized updater that merges data into the draftEffect AND the top-level state simultaneously.
     * @param {object} draftUpdate - Data to merge into `state.draftEffect`.
     * @param {object} stateUpdate - Data to merge into the top-level `state`.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The fully updated state object.
     */
    async updateBuilderDraftAndState(draftUpdate = {}, stateUpdate = {}, userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return this._getDefaultBuilderState();
        const state = await this.getBuilderState(userId);
        if (!state.draftEffect) return state;

        await this.updateBuilderDraftEffect(draftUpdate, userId);
        const updatedState = await this.getBuilderState(userId);
        const finalState = foundry.utils.mergeObject(updatedState, stateUpdate);

        await user.setFlag(FLAG_SCOPE, FLAG_KEY, finalState);
        return finalState;
    }

    /**
     * Finalizes the effect by moving it from draft into the 'modifications' array.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    async saveBuilderDraftEffect(userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return this._getDefaultBuilderState();
        const state = await this.getBuilderState(userId);
        if (!state.draftEffect) return state;

        const newState = foundry.utils.deepClone(state);
        const draft = this._normalizeEffect(newState.draftEffect);

        if (!newState.modifications) newState.modifications = [];

        delete draft.wasCustom; 
        const existingIndex = newState.modifications.findIndex(m => m._id === draft._id);

        if (existingIndex > -1) newState.modifications[existingIndex] = draft;
        else newState.modifications.push(draft);
        
        newState.draftEffect = null; 
        await user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
        return newState;
    }

    /**
     * Cancels the effect creation. If editing a custom mod, moves it back.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    async cancelBuilderEffectCreation(userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return this._getDefaultBuilderState();
        const state = await this.getBuilderState(userId);
        if (!state.draftEffect) return state;
        const newState = foundry.utils.deepClone(state);

        if (state.draftEffect.wasCustom) {
            delete state.draftEffect.wasCustom;
            newState.modifications.push(this._normalizeEffect(state.draftEffect));
        }
        
        newState.draftEffect = null;
        await user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
        return newState;
    }

    /**
     * Deletes a custom effect from the 'modifications' array.
     * @param {string} effectId - The ID of the effect.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    async deleteBuilderEffect(effectId, userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return this._getDefaultBuilderState();
        const state = await this.getBuilderState(userId);
        if (state.modifications) {
            state.modifications = state.modifications.filter(m => m._id !== effectId);
            await user.setFlag(FLAG_SCOPE, FLAG_KEY, state);
        }
        return state;
    }

    /**
     * Prepares an effect for editing.
     * If it's a custom mod, it's MOVED from 'modifications' to 'draftEffect'.
     * If it's an innate effect, a COPY is created in 'draftEffect'.
     * @param {string} sourceUuid - The UUID of the source item.
     * @param {string} effectId - The ID of the effect.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    async startBuilderEffectEdit(sourceUuid, effectId, userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return this._getDefaultBuilderState();
        const state = await this.getBuilderState(userId);
        const newState = foundry.utils.deepClone(state);
        let effectToEdit = null;

        const customModIndex = newState.modifications?.findIndex(m => m._id === effectId);
        if (customModIndex > -1) {
            effectToEdit = newState.modifications.splice(customModIndex, 1)[0];
            effectToEdit.wasCustom = true;
        } else {
            let itemSource = (newState.baseItem?.uuid === sourceUuid) 
                ? newState.baseItem 
                : Object.values(newState.changes).find(c => c.uuid === sourceUuid);

            const sourceEffect = itemSource?.effects?.find(e => e._id === effectId);

            if (sourceEffect) {
                effectToEdit = foundry.utils.deepClone(sourceEffect);
                effectToEdit.originalId = sourceEffect._id; 
                effectToEdit._id = foundry.utils.randomID();
            }
        }

        if (effectToEdit) {
            const draft = this._normalizeEffect(effectToEdit);
            draft.sourceUuid = sourceUuid;
            draft.isEdit = true;

            newState.draftEffect = draft;
            await user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
            return newState;
        }
        return state;
    }

    /**
     * Toggles the visibility of the derived value selector UI.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    async toggleBuilderDerivedValueSelector(userId = null) {
        const state = await this.getBuilderState(userId);
        const newStateData = { isDerivedValueSelectorVisible: !state.isDerivedValueSelectorVisible };
        await this.updateBuilderState(newStateData, userId);
        return foundry.utils.mergeObject(state, newStateData);
    }

    /**
     * Clears the entire builder state.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    async clearBuilderState(userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return;
        await user.unsetFlag(FLAG_SCOPE, FLAG_KEY);
    }

    /**
     * Retrieves effects from an item UUID.
     * @param {string} uuid - The item UUID.
     * @returns {Promise<Array>} The effects list.
     */
    async getEffectFromItemUuid(uuid) {
        let item = await fromUuid(uuid);
        let effects = item?.effects ?? [];
        return effects;
    }

    /**
     * Toggles the edit mode for the base item.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async toggleBuilderBaseItemEdit(userId = null) {
        const state = await this.getBuilderState(userId);
        const isEditing = !state.isEditingBaseItem;
        
        await this.updateBuilderState({ isEditingBaseItem: isEditing }, userId);
        return foundry.utils.mergeObject(state, { isEditingBaseItem: isEditing });
    }

    /**
     * Updates the baseItemOverrides property in the state.
     * @param {object} updateData - An object with properties to update.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async updateBuilderBaseItemOverrides(updateData, userId = null) {
        const state = await this.getBuilderState(userId);
        if (!state.baseItem) return state;

        const expandedUpdate = foundry.utils.expandObject(updateData);
        
        const newState = foundry.utils.deepClone(state);
        newState.baseItemOverrides = foundry.utils.mergeObject(newState.baseItemOverrides, expandedUpdate);
        
        await this.updateBuilderState({ baseItemOverrides: newState.baseItemOverrides }, userId);
        return newState;
    }
}
