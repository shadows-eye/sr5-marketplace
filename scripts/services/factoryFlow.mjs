import { ActorSelectionService } from "./ActorSelectionService.mjs";
import { BasketService } from "./basketService.mjs";

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
    checkInventoryStock(vehicle, workshopActor, purchasingActor, onlyFirst = true) {
        const baseVehicle = game.actors.get(vehicle.id) || vehicle;
        const virtualMods = vehicle.getFlag("sr5-marketplace", "virtualModifications") || 
                            baseVehicle.getFlag("sr5-marketplace", "virtualModifications") || [];
        if (virtualMods.length === 0) return { allInStock: false, details: [] };

        const targetMods = onlyFirst ? [virtualMods[0]] : virtualMods;

        const requiredQty = {};
        for (const vMod of targetMods) {
            requiredQty[vMod.uuid] = (requiredQty[vMod.uuid] || 0) + 1;
        }

        let allInStock = true;
        const details = [];

        for (const [itemUuid, reqQty] of Object.entries(requiredQty)) {
            let workshopQty = 0;
            let workshopEntryId = null;
            if (workshopActor) {
                const entry = typeof workshopActor.findInventoryItem === "function" 
                    ? workshopActor.findInventoryItem(itemUuid) 
                    : null;
                if (entry) {
                    workshopEntryId = entry[0];
                    workshopQty = entry[1].qty || 0;
                }
            }

            let purchasingQty = 0;
            const purchasingItems = [];
            if (purchasingActor) {
                const characterMods = purchasingActor.items.filter(i => 
                    i.type === "modification" && 
                    (i.flags?.core?.sourceId === itemUuid || i.uuid === itemUuid)
                );
                purchasingQty = characterMods.reduce((sum, i) => sum + (i.system.quantity || 1), 0);
                purchasingItems.push(...characterMods);
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
    async runModificationFlow(vehicle, workshopActor, purchasingActor) {
        if (!vehicle) return false;

        const baseVehicle = game.actors.get(vehicle.id) || vehicle;
        const virtualMods = vehicle.getFlag("sr5-marketplace", "virtualModifications") || 
                            baseVehicle.getFlag("sr5-marketplace", "virtualModifications") || [];
        if (virtualMods.length === 0) return false;

        const vMod = virtualMods[0];

        // Verify stock using the new consolidated stock check (checking only the first mod)
        const { allInStock } = this.checkInventoryStock(vehicle, workshopActor, purchasingActor, true);
        if (!allInStock) {
            ui.notifications.error(game.i18n.format("SR5Marketplace.ItemBuilder.ErrorModNotAvailable", { name: vMod.name }));
            return false;
        }
        const item = await fromUuid(vMod.uuid);
        if (!item) {
            ui.notifications.error("Could not resolve source modification item.");
            return false;
        }

        // Close any existing build test dialogs
        const buildTestApp = Object.values(ui.windows).find(w => w.constructor.name === "BuildTestApp");
        if (buildTestApp) {
            buildTestApp.close();
        }

        const rating = Number(item.system.rating ?? item.system.technology?.rating ?? 1);
        const threshold = rating > 0 ? rating * 2 : 12;

        console.log(`SR5 Marketplace | Starting modification build test for: ${vMod.name}`);
        const runResult = await game.shadowrun5e.tests.BuildTest.run(vehicle.uuid, {
            buildData: item.toObject(),
            threshold: threshold,
            installSource: vMod.installSource || "workshop",
            installSourceId: vMod.installSourceId || null,
            vehicle: vehicle,
            workshop: workshopActor
        }, {
            isWorkshopMod: true
        });

        console.log("SR5 Marketplace | Modification build test resolved. Result:", runResult);

        if (runResult && runResult.resolved) {
            // Consume the item from either the purchasing actor or the workshop actor
            let consumed = false;
            if (purchasingActor) {
                const charItem = purchasingActor.items.find(i => 
                    i.type === "modification" && 
                    (i.flags?.core?.sourceId === vMod.uuid || i.uuid === vMod.uuid)
                );
                if (charItem) {
                    const qty = charItem.system.quantity || 1;
                    if (qty > 1) {
                        await charItem.update({ "system.quantity": qty - 1 });
                        console.log(`SR5 Marketplace | Decremented installed modification ${charItem.name} quantity to ${qty - 1} on character ${purchasingActor.name}`);
                    } else {
                        await purchasingActor.deleteEmbeddedDocuments("Item", [charItem.id]);
                        console.log(`SR5 Marketplace | Deleted installed modification ${charItem.name} from character ${purchasingActor.name}`);
                    }
                    consumed = true;
                }
            }

            if (!consumed && workshopActor) {
                const entry = typeof workshopActor.findInventoryItem === "function" 
                    ? workshopActor.findInventoryItem(vMod.uuid) 
                    : null;
                if (entry) {
                    const entryId = entry[0];
                    const entryObj = entry[1];
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
                    consumed = true;
                }
            }

            // Create modification item on the vehicle (and base actor if owned)
            await vehicle.createEmbeddedDocuments("Item", [item.toObject()]);
            if (baseVehicle !== vehicle && baseVehicle.isOwner) {
                await baseVehicle.createEmbeddedDocuments("Item", [item.toObject()]);
            }
            ui.notifications.info(game.i18n.format("SR5Marketplace.ItemBuilder.SuccessBuildCreated", { name: item.name }));

            // Remove virtual mod from flags of the vehicle and base actor
            const updatedMods = virtualMods.filter(m => m.id !== vMod.id);
            if (updatedMods.length > 0) {
                if (vehicle.isOwner) await vehicle.setFlag("sr5-marketplace", "virtualModifications", updatedMods);
                if (baseVehicle !== vehicle && baseVehicle.isOwner) {
                    await baseVehicle.setFlag("sr5-marketplace", "virtualModifications", updatedMods);
                }
            } else {
                if (vehicle.isOwner) await vehicle.unsetFlag("sr5-marketplace", "virtualModifications");
                if (baseVehicle !== vehicle && baseVehicle.isOwner) {
                    await baseVehicle.unsetFlag("sr5-marketplace", "virtualModifications");
                }
            }

            // Force re-render of the builder app if open
            const builderApp = Object.values(ui.windows).find(w => w.constructor.name === "ItemBuilderApp");
            if (builderApp) {
                builderApp.tabGroups.main = "workshop";
                builderApp.render(true);
            }

            return true;
        }

        return false;
    }
}
