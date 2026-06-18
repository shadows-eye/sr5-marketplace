import { MODULE_ID, FLAG_KEY_AppTest, FLAGKEY_Basket } from '../lib/constants.mjs';
import { ActorSelectionService } from './ActorSelectionService.mjs';

/**
 * @summary Manages the state of in-app tests via a user flag.
 * @description This service handles creating, reading, updating, and deleting test
 * state objects stored in a user's flags, ensuring a persistent, multi-step
 * test workflow within the application.
 */
export class AppTestFlagService {
    static _inFlightDeletions = new Set();
    static _suppressedDialogIds = new Set();

    /**
     * READS the entire test state object from a specific user's flag.
     * @param {string} [userId] - The ID of the user to get the flag from.
     * @returns {Promise<object>} The test state object, or an empty object if not found.
     */
    static async readState(userId) {
        if (!userId) {
            userId = await game.user.id;
        }
        const user = game.users.get(userId);
        if (!user) return {};
        const state = user.getFlag(MODULE_ID, FLAG_KEY_AppTest);
        return state ? foundry.utils.deepClone(state) : {};
    }

    /**
     * Sanitizes a test state object to remove heavy document references (like Actor/Item objects)
     * before saving it to the user flag database.
     * @param {object} state - The state object to sanitize.
     */
    static _sanitizeState(state) {
        if (!state || typeof state !== "object") return;
        
        for (const t of Object.values(state)) {
            if (!t || typeof t !== "object") continue;
            
            // If there's a result object, clean up deep document references
            if (t.result && typeof t.result === "object") {
                if (t.result.options && typeof t.result.options === "object") {
                    delete t.result.options.vehicle;
                    delete t.result.options.workshop;
                    delete t.result.options.actor;
                    if (t.result.options.buildData) {
                        t.result.options.buildData = {
                            uuid: t.result.options.buildData.uuid || null,
                            name: t.result.options.buildData.name || null,
                            type: t.result.options.buildData.type || null
                        };
                    }
                }
                if (t.result.action && typeof t.result.action === "object") {
                    if (t.result.action.buildData) {
                        t.result.action.buildData = {
                            uuid: t.result.action.buildData.uuid || null,
                            name: t.result.action.buildData.name || null,
                            type: t.result.action.buildData.type || null
                        };
                    }
                }
            }
            
            // Clean up main buildData if present to keep only what is needed for the BuildTestApp
            if (t.isWorkshopMod && t.buildData && typeof t.buildData === "object") {
                t.buildData = {
                    _id: t.buildData._id || null,
                    uuid: t.buildData.uuid || null,
                    name: t.buildData.name || null,
                    img: t.buildData.img || null,
                    type: t.buildData.type || null,
                    system: {
                        slots: t.buildData.system?.slots ?? 0,
                        technology: t.buildData.system?.technology ? {
                            rating: t.buildData.system.technology.rating ?? 0,
                            cost: t.buildData.system.technology.cost ?? 0,
                            availability: t.buildData.system.technology.availability ?? ""
                        } : undefined
                    }
                };
            }
        }
    }

    /**
     * CREATES a new test state for a user, overwriting any previous state.
     * @param {object} initialData - The data to initialize the test with.
     * @param {string} [userId] - The user for whom to create the test.
     * @returns {Promise<string>} The unique ID of the newly created test state.
     */
    static async createTest(initialData, userId) {
        const dialogId = foundry.utils.randomID();
        if (!userId) {
            userId = game.user.id;
        }
        const rule = game.settings.get("sr5-marketplace", "availabilityTestRule");

        const currentState = await this.readState(userId);
        currentState[dialogId] = {
            id: dialogId,
            testType: rule,
            status: 'initial',
            result: null,
            rolls: null,
            resistResult: null,
            rollCount: 0,
            resolved: false,
            skill: 'negotiation', //Default Value
            attribute: 'charisma', //Default Value
            appliedModifiers: [], // Empty array
            showDialog: true,
            ...initialData
        };

        const user = game.users.get(userId);
        if (user) {
            this._sanitizeState(currentState);
            console.log(`Saving new test state to flag for user ${user.name}:`, currentState);
            await user.setFlag(MODULE_ID, FLAG_KEY_AppTest, currentState);
        }
        return dialogId;
    }

    /**
     * UPDATES an existing test entry with new data.
     * @param {string} dialogId - The ID of the test state to update.
     * @param {object} updateData - An object containing the properties to update.
     * @param {string} [userId] - The user whose test to update.
     */
    static async updateTest(dialogId, updateData, userId) {
        if  (!userId) {
        userId = await game.user.id;
        }
        if (updateData && updateData.showDialog === false) {
            this._suppressedDialogIds.add(dialogId);
        } else if (updateData && updateData.showDialog === true) {
            this._suppressedDialogIds.delete(dialogId);
        }
        const user = game.users.get(userId);
        if (!user) return;

        const currentState = await this.readState(userId);
        if (currentState[dialogId]) {
            // Merge the new data into the existing state for that test
            foundry.utils.mergeObject(currentState[dialogId], updateData);
            this._sanitizeState(currentState);
            await user.setFlag(MODULE_ID, FLAG_KEY_AppTest, currentState);
        }
    }

    /**
     * DELETES all test data from a specific user's flag.
     * @param {string} [userId] - The user whose flag to clear.
     */
    static async deleteState(userId) {
        if  (!userId) {
        userId = await game.user.id;
        }
        const user = game.users.get(userId);
        if (user) {
            console.log(`Clearing all test state flags for user ${user.name}.`);
            return user.unsetFlag(MODULE_ID, FLAG_KEY_AppTest);
        }
    }

    /**
     * Deletes a specific test from the user flag state.
     * @param {string} dialogId - The ID of the test state to delete.
     * @param {string} [userId] - The user whose test to delete.
     */
    static async deleteTest(dialogId, userId) {
        if (!userId) {
            userId = game.user.id;
        }
        this._suppressedDialogIds.add(dialogId);
        const user = game.users.get(userId);
        if (!user) return;

        const key = `${userId}_${dialogId}`;
        if (this._inFlightDeletions.has(key)) return;
        this._inFlightDeletions.add(key);

        try {
            const currentState = await this.readState(userId);
            if (currentState[dialogId]) {
                delete currentState[dialogId];
                await user.setFlag(MODULE_ID, FLAG_KEY_AppTest, currentState);
                console.log(`SR5 Marketplace | Deleted test state ${dialogId} for user ${user.name}`);
            }
        } finally {
            this._inFlightDeletions.delete(key);
        }
    }

    /**
     * Clears basket association (inBasket and basketItemId) on both the vehicle's virtual modifications
     * and the user's test state flags when an item is removed, rejected, or completed.
     * @param {string} basketItemUuid - The UUID of the basket item.
     * @param {string} userId - The user ID.
     */
    static async clearBasketAssociation(basketItemUuid, userId) {
        if (!basketItemUuid || !userId) return;
        
        // 1. Clear association on the user's test state
        const testStates = await this.readState(userId);
        const testState = Object.values(testStates).find(t => t.basketItemId === basketItemUuid);
        if (testState) {
            await this.updateTest(testState.id, {
                inBasket: false,
                basketItemId: null
            }, userId);
        }

        // 2. Clear association on the vehicle's virtualModifications flag
        const user = game.users.get(userId);
        const basket = user?.getFlag(MODULE_ID, FLAGKEY_Basket);
        const basketItem = basket?.shoppingCartItems?.find(i => i.basketItemUuid === basketItemUuid) || 
                           basket?.orderReviewItems?.flatMap(r => r.basketItems || []).find(i => i.basketItemUuid === basketItemUuid);
        
        const vehicleActorUuid = basketItem?.vehicleActorUuid || testState?.vehicleUuid;
        if (vehicleActorUuid) {
            const vehicleDoc = await fromUuid(vehicleActorUuid);
            const vehicle = vehicleDoc instanceof Actor ? vehicleDoc : vehicleDoc?.actor || null;
            if (vehicle) {
                const virtualMods = game.sr5marketplace.api.factory.getVirtualModifications(vehicle);
                const normalizeUuid = (uuid) => {
                    if (!uuid) return "";
                    let clean = String(uuid).trim().toLowerCase();
                    if (clean.startsWith("compendium.")) {
                        clean = clean.replace(/\.(item|actor)\./g, ".");
                    }
                    return clean;
                };
                const targetNorm = basketItem?.itemUuid ? normalizeUuid(basketItem.itemUuid) : null;
                const targetVMod = virtualMods.find(m => m.basketItemId === basketItemUuid || (targetNorm && normalizeUuid(m.uuid) === targetNorm));
                if (targetVMod) {
                    delete targetVMod.inBasket;
                    delete targetVMod.basketItemId;
                    await game.sr5marketplace.api.factory.saveVirtualModifications(vehicle, virtualMods);
                }
            }
        }
    }

    /**
     * Reactively synchronizes the user's active tests and vehicle virtual modifications
     * with their current basket contents. If a test or virtual modification is marked
     * as inBasket but is no longer in the shopping cart or order review items,
     * its basket association flags are cleared.
     * @param {User} user - The user document.
     */
    static async syncBasketAssociations(user) {
        if (!user) return;
        const basket = user.getFlag(MODULE_ID, FLAGKEY_Basket);
        if (!basket) return;

        // Get all basketItemUuids currently in the cart or review requests
        const activeBasketItemIds = new Set();
        if (Array.isArray(basket.shoppingCartItems)) {
            for (const item of basket.shoppingCartItems) {
                if (item.basketItemUuid) activeBasketItemIds.add(item.basketItemUuid);
            }
        }
        if (Array.isArray(basket.orderReviewItems)) {
            for (const req of basket.orderReviewItems) {
                if (Array.isArray(req.basketItems)) {
                    for (const item of req.basketItems) {
                        if (item.basketItemUuid) activeBasketItemIds.add(item.basketItemUuid);
                    }
                }
            }
        }

        // 1. Sync User's Test States
        let testStatesUpdated = false;
        const testStates = await this.readState(user.id);
        for (const t of Object.values(testStates)) {
            if (t.inBasket || t.basketItemId) {
                // If it has a basket ID but that ID is no longer in the active basket:
                if (t.basketItemId && !activeBasketItemIds.has(t.basketItemId)) {
                    t.inBasket = false;
                    t.basketItemId = null;
                    testStatesUpdated = true;
                }
            }
        }
        if (testStatesUpdated) {
            this._sanitizeState(testStates);
            await user.setFlag(MODULE_ID, FLAG_KEY_AppTest, testStates);
            console.log(`SR5 Marketplace | Synced test state basket associations for user ${user.name}`);
        }

        // 2. Sync Vehicles' Virtual Modifications
        // Find all actors with virtual modifications
        const vehicles = game.actors.filter(a => {
            const baseVehicle = game.actors.get(a.id) || a;
            return a.getFlag(MODULE_ID, "virtualModifications")?.length > 0 || 
                   baseVehicle.getFlag(MODULE_ID, "virtualModifications")?.length > 0;
        });

        for (const vehicle of vehicles) {
            const virtualMods = game.sr5marketplace.api.factory.getVirtualModifications(vehicle);
            
            let vehicleUpdated = false;
            for (const m of virtualMods) {
                if (m.inBasket || m.basketItemId) {
                    if (m.basketItemId && !activeBasketItemIds.has(m.basketItemId)) {
                        delete m.inBasket;
                        delete m.basketItemId;
                        vehicleUpdated = true;
                    }
                }
            }

            if (vehicleUpdated) {
                await game.sr5marketplace.api.factory.saveVirtualModifications(vehicle, virtualMods);
                console.log(`SR5 Marketplace | Synced virtualModifications basket associations for vehicle ${vehicle.name}`);
            }
        }
        
        // Re-render open builder apps if things changed
        if (testStatesUpdated) {
            const builderApp = foundry.applications.instances.get("itemBuilder");
            if (builderApp) {
                builderApp.render();
            }
            const buildTestApp = foundry.applications.instances.get("build-test-dialog-app");
            if (buildTestApp) {
                buildTestApp.render();
            }
        }
    }

    /**
     * Finds the active unresolved BuildTest for a user, checking for stock
     * and basket presence where necessary.
     * @param {string} userId - The user ID.
     * @param {Actor} [purchasingActor] - The current purchasing actor.
     * @returns {Promise<object|null>} The active unresolved test object, or null.
     */
    static async getActiveBuildTest(userId, purchasingActor) {
        const testStates = await this.readState(userId);
        for (const t of Object.values(testStates)) {
            if (t.resolved || t.testType !== "BuildTest" || t.showDialog === false || this._suppressedDialogIds.has(t.id)) continue;

            // Check if this is a workshop modification test, and if so, validate if it's still queued
            let vehicle = null;
            if (t.isWorkshopMod) {
                const vehicleDoc = t.vehicleUuid ? await fromUuid(t.vehicleUuid) : null;
                vehicle = vehicleDoc instanceof Actor ? vehicleDoc : vehicleDoc?.actor || null;

                if (!vehicle) {
                    // Vehicle no longer exists, delete this stale test
                    const key = `${userId}_${t.id}`;
                    if (!this._inFlightDeletions.has(key)) {
                        console.log(`SR5 Marketplace | Deleting stale test ${t.id} because vehicle ${t.vehicleUuid} was not found.`);
                        await this.deleteTest(t.id, userId);
                    }
                    continue;
                }

                const virtualMods = game.sr5marketplace.api.factory.getVirtualModifications(vehicle);

                let isStillValid = false;
                const normalizeUuid = (uuid) => {
                    if (!uuid) return "";
                    let clean = String(uuid).trim().toLowerCase();
                    if (clean.startsWith("compendium.")) {
                        clean = clean.replace(/\.(item|actor)\./g, ".");
                    }
                    return clean;
                };
                if (t.virtualModId) {
                    isStillValid = virtualMods.some(m => m.id === t.virtualModId);
                } else if (t.buildData?.uuid) {
                    // Fallback for older tests without virtualModId
                    const targetNorm = normalizeUuid(t.buildData.uuid);
                    isStillValid = virtualMods.some(m => normalizeUuid(m.uuid) === targetNorm);
                }

                if (!isStillValid) {
                    const key = `${userId}_${t.id}`;
                    if (!this._inFlightDeletions.has(key)) {
                        console.log(`SR5 Marketplace | Deleting stale test ${t.id} because its corresponding virtual modification was not found on vehicle.`);
                        await this.deleteTest(t.id, userId);
                    }
                    continue;
                }
            } else if (t.vehicleUuid) {
                const vehicleDoc = await fromUuid(t.vehicleUuid);
                vehicle = vehicleDoc instanceof Actor ? vehicleDoc : vehicleDoc?.actor || null;
            }

            // If rolls are not done, we must show the dialog to continue rolling
            if (t.status !== 'resolved') {
                return t;
            }

            // Check if it has been added to the basket already.
            // If so, suppress the dialog (do not show it) until checkout or removal clears this association.
            const hasBasketId = t.basketItemId || t.inBasket || false;
            if (hasBasketId) {
                continue;
            }

            return t;
        }
        return null;
    }
    /**
     * READS the entire shopping basket object from a specific user's flag.
     * @param {string} [userId] - The ID of the user to get the flag from. Defaults to the current user.
     * @returns {Promise<object>} The basket object, or an empty object if not found.
     */
    static async readBasket(userId) {
        if (!userId) {
            userId = game.user.id;
        }
        const user = game.users.get(userId);
        if (!user) return {};
        // Make sure FLAG_KEY_Basket is defined in your constants.mjs as "shoppingBasket"
        return user.getFlag(MODULE_ID, FLAGKEY_Basket) || {};
    }
}

/**
 * CONSOL SCRIPT:
 * Find
 * (async () => {
    const scope = "sr5-marketplace";
    const key = "appTestState";
    const flagData = await game.user.getFlag(scope, key);

    if (flagData) {
        console.log(`Flag '${key}' found for user ${game.user.name}:`, flagData);
        ui.notifications.info("Flag data logged to console (F12).");
    } else {
        console.log(`No flag '${key}' found for user ${game.user.name}.`);
        ui.notifications.warn("No test state flag found.");
    }
})();
 */

/**
 * CONSOL SCRIPT DELTE:
 * 
 * (async () => {
    const scope = "sr5-marketplace";
    const key = "appTestState";

    const confirmed = await Dialog.confirm({
        title: "Delete Test State Flag",
        content: `<p>Are you sure you want to delete the entire <strong>${key}</strong> flag for your user? This is useful for debugging but cannot be undone.</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: false
    });

    if (confirmed) {
        await game.user.unsetFlag(scope, key);
        console.log(`Flag '${scope}.${key}' has been deleted for user ${game.user.name}.`);
        ui.notifications.info("The app test state flag has been deleted.");
    } else {
        console.log("Flag deletion was canceled.");
    }
})();
 */