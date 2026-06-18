import { ActorSelectionService } from "./ActorSelectionService.mjs";
import { BasketService } from "./basketService.mjs";
import { BuildService } from "./buildService.mjs";

const buildService = new BuildService();


/**
 * Service to handle internal workshop modification and installation flow logic.
 */
export class FactoryFlow {
    /**
     * Resolves the list of eligible character actors owned by the vehicle's player owners.
     * Fallback to character actors owned by the current user.
     * @param {Actor} vehicle - The vehicle actor document.
     * @returns {Actor[]} List of character actors.
     */
    getEligiblePurchasers(vehicle) {
        if (!vehicle) return [];
        const ownerUsers = game.users.filter(u => !u.isGM && vehicle.testUserPermission(u, "OWNER"));
        
        const charactersMap = new Map();

        // 1. Prioritize assigned character actors (selected as their actor) of the vehicle's player owners
        for (const u of ownerUsers) {
            if (u.character && u.character.type === "character") {
                charactersMap.set(u.character.uuid, u.character);
            }
        }

        // 2. Add other character actors owned by those users
        const ownedCharacters = game.actors.filter(a => 
            a.type === "character" && 
            ownerUsers.some(u => a.testUserPermission(u, "OWNER"))
        );
        for (const a of ownedCharacters) {
            if (!charactersMap.has(a.uuid)) {
                charactersMap.set(a.uuid, a);
            }
        }

        // 3. Fallback if no characters were found for vehicle owners
        if (charactersMap.size === 0) {
            if (game.user.character && game.user.character.type === "character") {
                charactersMap.set(game.user.character.uuid, game.user.character);
            }
            const userOwned = game.actors.filter(a => 
                a.type === "character" && 
                (game.user.isGM || a.testUserPermission(game.user, "OWNER"))
            );
            for (const a of userOwned) {
                if (!charactersMap.has(a.uuid)) {
                    charactersMap.set(a.uuid, a);
                }
            }
        }

        return Array.from(charactersMap.values());
    }

    /**
     * Verifies if all virtual modifications queued on the vehicle are in stock
     * in either the workshop/factory actor inventory OR the purchasing actor's inventory.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {Actor} workshopActor - The workshop/factory actor document.
     * @param {Actor} purchasingActor - The selected purchasing actor document.
     * @param {boolean} onlyFirst - If true, only checks the first queued modification.
     * @returns {object} { allInStock: boolean, details: Array }
     */
    checkInventoryStock(vehicle, workshopActor, purchasingActor, targetModId = null) {
        const virtualMods = buildService.getVirtualModifications(vehicle);
        if (virtualMods.length === 0) return { allInStock: false, details: [] };

        let targetMods = [];
        if (targetModId && typeof targetModId === "string") {
            const found = virtualMods.find(m => m.id === targetModId);
            targetMods = found ? [found] : [];
        } else {
            // Default to the first untested modification
            const untested = virtualMods.find(m => !m.inBasket && !m.basketItemId);
            targetMods = untested ? [untested] : [virtualMods[0]];
        }

        if (targetMods.length === 0) return { allInStock: false, details: [] };

        const requiredQty = {};
        for (const vMod of targetMods) {
            requiredQty[vMod.uuid] = (requiredQty[vMod.uuid] || 0) + 1;
        }

        let allInStock = true;
        const details = [];

        // Synchronously resolve owner actor of workshop/factory if available
        let ownerActor = null;
        if (workshopActor?.system?.shop?.owner) {
            try {
                ownerActor = fromUuidSync(workshopActor.system.shop.owner);
            } catch (e) {
                console.error("SR5 Marketplace | Error in fromUuidSync for workshop owner:", e);
            }
        }

        for (const [itemUuid, reqQty] of Object.entries(requiredQty)) {
            // Synchronously resolve canonical source UUID for comparison
            let resolvedSourceUuid = itemUuid;
            try {
                const itemDoc = fromUuidSync(itemUuid);
                if (itemDoc) {
                    resolvedSourceUuid = itemDoc.flags?.core?.sourceId || itemDoc.uuid || itemUuid;
                }
            } catch (e) {
                // ignore
            }

            let workshopQty = 0;
            let workshopEntryId = null;
            if (workshopActor) {
                let entry = null;
                if (workshopActor.system?.shop?.inventory) {
                    const norm1 = _normalizeUuid(itemUuid);
                    const norm2 = _normalizeUuid(resolvedSourceUuid);
                    entry = Object.entries(workshopActor.system.shop.inventory).find(([id, item]) => {
                        const shopUuidNorm = _normalizeUuid(item.itemUuid);
                        return shopUuidNorm === norm1 || shopUuidNorm === norm2;
                    });
                }
                if (entry) {
                    workshopEntryId = entry[0];
                    workshopQty = entry[1].qty || 0;
                }
            }

            let purchasingQty = 0;
            const purchasingItems = [];

            const checkActor = (actor) => {
                if (!actor || actor.type !== "character" || actor.id === vehicle.id || actor.uuid === vehicle.uuid) return 0;
                const norm1 = _normalizeUuid(itemUuid);
                const norm2 = _normalizeUuid(resolvedSourceUuid);
                const characterMods = actor.items.filter(i => {
                    if (i.type !== "modification") return false;
                    const uuidNorm = _normalizeUuid(i.uuid);
                    const sourceIdNorm = _normalizeUuid(i.flags?.core?.sourceId);
                    return uuidNorm === norm1 || uuidNorm === norm2 || sourceIdNorm === norm1 || sourceIdNorm === norm2;
                });
                purchasingItems.push(...characterMods);
                return characterMods.reduce((sum, i) => sum + (i.system.quantity || 1), 0);
            };

            if (purchasingActor) {
                purchasingQty += checkActor(purchasingActor);
            }
            if (ownerActor && ownerActor.uuid !== purchasingActor?.uuid) {
                purchasingQty += checkActor(ownerActor);
            }

            const totalAvailable = workshopQty + purchasingQty;
            const itemInStock = totalAvailable >= reqQty;
            if (!itemInStock) {
                allInStock = false;
            }

            details.push({
                itemUuid,
                required: reqQty,
                workshopQty,
                workshopEntryId,
                purchasingQty,
                purchasingItems,
                inStock: itemInStock
            });
        }

        return { allInStock, details };
    }

    /**
     * Executes the workshop modification build test for the first virtual modification in the queue.
     * Upon success, installs the modification onto the actual vehicle document,
     * and decrements/consumes the item from the appropriate inventory.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {Actor} workshopActor - The workshop/factory actor document.
     * @param {Actor} purchasingActor - The selected purchasing actor document.
     * @returns {Promise<boolean>} Whether the modification was successfully installed.
     */
    /**
     * Starts the build test for a planned virtual modification on a vehicle.
     * Unlike runModificationFlow, this does NOT return a pending promise/block.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {Actor} workshopActor - The workshop/factory actor document.
     * @param {Actor} purchasingActor - The selected purchasing actor document.
     * @param {object} vMod - The virtual modification object.
     * @returns {Promise<string>} The active dialog ID of the created test.
     */
    async startModificationTest(vehicle, workshopActor, purchasingActor, vMod) {
        if (!vehicle || !vMod) return null;

        const { AppTestFlagService } = await import("./AppTestFlagService.mjs");
        const { BuildTestApp } = await import("../apps/documents/dialog/BuildTestApp.mjs");

        const item = await fromUuid(vMod.uuid);
        if (!item) {
            ui.notifications.error("Could not resolve source modification item.");
            return null;
        }

        // Get stock details for dynamic source mapping
        const { details } = this.checkInventoryStock(vehicle, workshopActor, purchasingActor, vMod.id);
        let installSource = vMod.installSource || "workshop";
        let installSourceId = vMod.installSourceId || null;

        if (details && details.length > 0) {
            const detail = details[0];
            const hasOwnerStock = detail.purchasingQty > 0 && detail.purchasingItems.length > 0;
            const hasWorkshopStock = detail.workshopQty > 0 && detail.workshopEntryId;

            if (!installSourceId) {
                if (hasOwnerStock) {
                    installSource = "owner";
                    installSourceId = detail.purchasingItems[0].id;
                } else if (hasWorkshopStock) {
                    installSource = "workshop";
                    installSourceId = detail.workshopEntryId;
                }
            } else {
                if (installSource === "owner" && !hasOwnerStock && hasWorkshopStock) {
                    installSource = "workshop";
                    installSourceId = detail.workshopEntryId;
                } else if (installSource === "workshop" && !hasWorkshopStock && hasOwnerStock) {
                    installSource = "owner";
                    installSourceId = detail.purchasingItems[0].id;
                }
            }
        }

        // Close any existing build test dialogs
        const buildTestApp = foundry.applications.instances.get("build-test-dialog-app");
        if (buildTestApp) {
            buildTestApp.close();
        }

        // Determine default skill to use
        let defaultSkill = "AutomotiveMechanic";
        const isDrone = vehicle.system?.isDrone || vehicle.system?.isdrone || false;
        const category = isDrone
            ? (vehicle.importFlags?.category?.toLowerCase() || "")
            : (vehicle.system?.category?.toLowerCase() || "");
        if (category.includes("rotorcraft") || category.includes("aircraft") || category.includes("aeronautics")) {
            defaultSkill = "AeronauticsMechanic";
        } else if (category.includes("nautical") || category.includes("watercraft")) {
            defaultSkill = "NauticalMechanic";
        } else {
            defaultSkill = "AutomotiveMechanic";
        }

        const rating = Number(item.system.rating ?? item.system.technology?.rating ?? 1);
        const threshold = rating > 0 ? rating * 2 : 12;

        const logicVal = purchasingActor?.system?.attributes?.logic?.value ?? 0;
        const initialModifiers = [];
        if (logicVal > 0 && logicVal < 5) {
            const penaltyVal = -(5 - logicVal);
            initialModifiers.push({
                label: "SR5Marketplace.ItemBuilder.LogicMemoryPenalty",
                value: penaltyVal
            });
        }

        if (workshopActor) {
            const rating = workshopActor.system.shop?.factoryRating ?? 5;
            const cond = rating - 5;
            let tools = 0;
            if (rating === 6) tools = 1;
            else if (rating === 5) tools = 0;
            else if (rating === 3 || rating === 4) tools = -2;
            else if (rating === 1 || rating === 2) tools = -4;

            if (cond !== 0) {
                initialModifiers.push({ label: "SR5Marketplace.ItemBuilder.WorkingConditions", value: cond });
            }
            if (tools !== 0) {
                initialModifiers.push({ label: "SR5Marketplace.ItemBuilder.ToolsParts", value: tools });
            }
        }

        const initialData = {
            testType: "BuildTest",
            actorUuid: purchasingActor.uuid,
            vehicleUuid: vehicle.uuid,
            workshopUuid: workshopActor?.uuid || null,
            buildData: item.toObject(),
            threshold: threshold,
            skill: defaultSkill,
            attribute: "logic",
            appliedModifiers: initialModifiers,
            isWorkshopMod: true,
            virtualModId: vMod.id,
            itemName: item.name,
            itemUuid: item.uuid,
            installSource: installSource,
            installSourceId: installSourceId
        };

        const activeDialogId = await AppTestFlagService.createTest(initialData);
        new BuildTestApp().render(true);

        return activeDialogId;
    }

    /**
     * Installs a modification onto the actual vehicle document,
     * decrements/consumes the item from the appropriate inventory,
     * and removes it from the virtual modifications queue.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {Actor} workshopActor - The workshop/factory actor document.
     * @param {Actor} purchasingActor - The selected purchasing actor document.
     * @param {object} vMod - The virtual modification object.
     * @returns {Promise<boolean>} Whether the modification was successfully installed.
     */
    async installModification(vehicle, workshopActor, purchasingActor, vMod) {
        if (!vehicle || !vMod) return false;

        const baseVehicle = game.actors.get(vehicle.id) || vehicle;
        const isLinked = vehicle.token ? vehicle.token.actorLink : true;
        const shouldUpdateBase = isLinked && (baseVehicle !== vehicle);
        const item = await fromUuid(vMod.uuid);
        if (!item) {
            console.error("SR5 Marketplace | Could not resolve source modification item.");
            return false;
        }

        // Consume the item from either the purchasing actor or the workshop actor based on installSource
        let consumed = false;
        const preferOwner = vMod.installSource === "owner";

        const consumeFromOwner = async () => {
            if (!purchasingActor) return false;
            const itemId = vMod.installSourceId;
            let charItem = itemId ? purchasingActor.items.get(itemId) : null;
            if (!charItem) {
                const targetNorm = _normalizeUuid(vMod.uuid);
                charItem = purchasingActor.items.find(i => 
                    i.type === "modification" && 
                    (_normalizeUuid(i.flags?.core?.sourceId) === targetNorm || _normalizeUuid(i.uuid) === targetNorm)
                );
            }
            if (charItem) {
                const qty = charItem.system.quantity || 1;
                if (qty > 1) {
                    await charItem.update({ "system.quantity": qty - 1 });
                    console.log(`SR5 Marketplace | Decremented installed modification ${charItem.name} quantity to ${qty - 1} on character ${purchasingActor.name}`);
                } else {
                    await purchasingActor.deleteEmbeddedDocuments("Item", [charItem.id]);
                    console.log(`SR5 Marketplace | Deleted installed modification ${charItem.name} from character ${purchasingActor.name}`);
                }
                return true;
            }
            return false;
        };

        const consumeFromWorkshop = async () => {
            if (!workshopActor) return false;
            let entryId = vMod.installSource === "workshop" ? vMod.installSourceId : null;
            if (!entryId) {
                const entry = typeof workshopActor.findInventoryItem === "function" 
                    ? workshopActor.findInventoryItem(vMod.uuid) 
                    : null;
                if (entry) entryId = entry[0];
            }
            if (entryId) {
                const entryObj = workshopActor.system.shop?.inventory?.[entryId];
                if (entryObj) {
                    const newQty = (entryObj.qty || 1) - 1;
                    if (newQty <= 0) {
                        await workshopActor.removeItemFromInventory(entryId);
                        console.log(`SR5 Marketplace | Removed installed modification ${entryId} from workshop inventory`);
                    } else {
                        if (typeof workshopActor.updateInventoryItem === "function") {
                            await workshopActor.updateInventoryItem(entryId, { qty: newQty });
                        } else {
                            await workshopActor.update({ [`system.shop.inventory.${entryId}.qty`]: newQty });
                        }
                        console.log(`SR5 Marketplace | Decremented installed modification ${entryId} quantity to ${newQty} in workshop inventory`);
                    }
                    return true;
                }
            }
            return false;
        };

        if (preferOwner) {
            consumed = await consumeFromOwner();
            if (!consumed) consumed = await consumeFromWorkshop();
        } else {
            consumed = await consumeFromWorkshop();
            if (!consumed) consumed = await consumeFromOwner();
        }

        // Create modification item on the vehicle
        const created = await vehicle.createEmbeddedDocuments("Item", [item.toObject()]);


        // Update the ItemBuilder state if this vehicle is currently loaded as the builder's base item
        try {
            const builderState = await buildService.getBuilderState();
            if (builderState.baseItem && (builderState.baseItem.uuid === vehicle.uuid || builderState.baseItem.uuid === baseVehicle.uuid)) {
                const freshVehicle = game.actors.get(baseVehicle.id) || baseVehicle;
                const cleanItemData = {
                    uuid: freshVehicle.uuid,
                    name: freshVehicle.name,
                    img: freshVehicle.img,
                    type: freshVehicle.type,
                    system: freshVehicle.system,
                    technology: freshVehicle.technology,
                    effects: freshVehicle.effects?.map(e => e.toObject(false)) ?? []
                };
                await buildService.updateBuilderState({ baseItem: cleanItemData });
                console.log(`SR5 Marketplace | Updated builderState baseItem for modified vehicle: ${freshVehicle.name}`);
            }
        } catch (err) {
            console.error("SR5 Marketplace | Failed to update builderState baseItem:", err);
        }

        // Remove virtual mod from flags of the vehicle and base actor
        await buildService.removeVirtualModification(vehicle, vMod.id);

        // Force re-render of the builder app if open
        const builderApp = foundry.applications.instances.get("itemBuilder");
        if (builderApp) {
            builderApp.tabGroups.main = "workshop";
            builderApp.render(true);
        }

        return true;
    }
}

function _normalizeUuid(uuid) {
    if (!uuid) return "";
    let clean = String(uuid).trim().toLowerCase();
    if (clean.startsWith("compendium.")) {
        clean = clean.replace(/\.(item|actor)\./g, ".");
    }
    return clean;
}
