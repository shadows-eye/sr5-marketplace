// --- IMPORTS ---
import { ItemBuilderApp } from "../apps/ItemBuilderApp.mjs";
import { inGameMarketplace } from "../apps/inGameMarketplace.mjs";
import { BasketService } from "../services/basketService.mjs";
import { PurchaseService } from "../services/purchaseService.mjs";
import { MODULE_ID, SELECTED_ACTOR } from "../lib/constants.mjs";
import { ActorSelectionService } from "../services/ActorSelectionService.mjs";
import { BuildService } from "../services/buildService.mjs";
import { factoryFlow } from "../services/_module.mjs";


/**
 * Internal class holding all Marketplace-specific API functions.
 * @private
 */
class inGameMarketplaceAPI {
    constructor(){
        this.basketService = new BasketService();
    }

    /**
     * Initializes the In-Game Marketplace API.
     */
    init() {
        //console.log("SR5 Marketplace | In-Game Marketplace API Initialized.");
    }

    /**
     * Adds an item to a user's shopping basket.
     * @param {string} itemUuid - UUID of the Item to be added to the basket.
     * @param {string} actorUuid - UUID of the Actor that wants to purchase the item.
     * @param {object} [options={}] - Optional parameters.
     * @param {string} [options.userId] - The ID of the user to whose basket the item should be added. Defaults to the current user if null.
     * @returns {Promise<void>}
     */
    async addItem(itemUuid, actorUuid, options = {}) {
        if (!itemUuid || !actorUuid) return;
        const { userId = null, ...rest } = options;
        // Pass the (potentially null) userId and options to the basket service
        return await this.basketService.addToBasket(itemUuid, actorUuid, userId, rest);
    }

    /**
     * Adds a compiled custom build to the active shopping cart.
     * @param {object} customData - The compiled item/actor build data.
     * @param {string} actorUuid - The UUID of the actor this basket is for.
     * @param {object} totals - Pre-calculated totals (cost, availability, essence).
     * @returns {Promise<void>}
     */
    async addCustom(customData, actorUuid, totals) {
        return await this.basketService.addCustomToBasket(customData, actorUuid, totals);
    }

    /**
     * Combines multiple availability strings into a single consolidated string.
     * @param {Array<string>} availStrings - Array of availability strings.
     * @returns {string} The combined availability.
     */
    combineAvailabilities(availStrings) {
        return this.basketService._combineAvailabilities(availStrings);
    }

    /**
     * Opens the main Marketplace window.
     * @param {object} [options={}] - Options for opening the marketplace.
     * @param {string} [options.actorUuid] - An Actor UUID to pre-select.
     * @param {string} [options.itemUuid] - An Item UUID to add to the basket (requires actorUuid).
     * @returns {Promise<void>}
     */
    async open(options = {}) {
        const { actorUuid, itemUuid } = options;
        if (actorUuid) {
            await ActorSelectionService.setSelectedActor(actorUuid);
        }
        if (itemUuid && actorUuid) {
            await this.addItemToBasket(itemUuid, actorUuid);
        }
        
        let marketplace = foundry.applications.instances.get("inGameMarketplace");
        if (!marketplace) {
            marketplace = new inGameMarketplace();
        }
        marketplace.render(true);
    }

    /**
     * Closes the in-game marketplace window if it is open.
     * @returns {Promise<void>}
     */
    async close() {

        const marketplace = foundry.applications.instances.get("inGameMarketplace");
        if (marketplace) {
            await marketplace.close();
        }
    }

    /**
     * Sets the currently selected actor for the marketplace and re-renders it.
     * @param {string} actorUuid - The UUID of the Actor to select.
     * @returns {Promise<void>}
     */
    async setActor(actorUuid) {
        if (!actorUuid) return;
        await ActorSelectionService.setSelectedActor(actorUuid);
        
        const marketplace = foundry.applications.instances.get("inGameMarketplace");
        if (marketplace) {
            marketplace.render();
        }
    }

    /**
     * Clears the currently selected actor for the marketplace and re-renders it.
     * @returns {Promise<void>}
     */
    async clearActor() {
        await ActorSelectionService.clearSelectedActor();
        
        const marketplace = foundry.applications.instances.get("inGameMarketplace");
        if (marketplace) {
            marketplace.render();
        }
    }

    /**
     * Gets the current user's shopping cart items.
     * @returns {Promise<Array<object>>} An array of shopping cart item objects.
     */
    async getBasket() {
        const basket = await new BasketService().getBasket();
        return basket.shoppingCartItems || [];
    }

    /**
     * Removes an item from the current user's basket and re-renders the UI.
     * @param {string} basketItemUuid - The unique ID of the item instance in the cart.
     * @returns {Promise<void>}
     */
    async remove(basketItemUuid) {
        if (!basketItemUuid) return;
        await new BasketService().removeFromBasket(basketItemUuid);
        
        const marketplace = foundry.applications.instances.get("inGameMarketplace");
        if (marketplace) {
            marketplace.render();
        }
    }

    /**
     * Submits a user's shopping basket for review.
     * @param {string} userId - The ID of the user whose basket is to be submitted.
     * @returns {Promise<void>}
     */
    async submitForReview(userId) {
        if (!userId) return;
        await PurchaseService.submitForReview(userId);
    }

    /**
     * Rejects an item from a pending request.
     * @param {string} userId - The ID of the user.
     * @param {string} basketUUID - The UUID of the basket.
     * @param {string} basketItemUuid - The UUID of the item to reject.
     * @returns {Promise<void>}
     */
    async rejectItemFromRequest(userId, basketUUID, basketItemUuid) {
        if (!userId || !basketUUID || !basketItemUuid) return;
        await PurchaseService.rejectItemFromRequest(userId, basketUUID, basketItemUuid);
    }

    /**
     * Rejects a pending basket request.
     * @param {string} userId - The ID of the user.
     * @param {string} basketUUID - The UUID of the basket.
     * @returns {Promise<void>}
     */
    async rejectBasket(userId, basketUUID) {
        if (!userId || !basketUUID) return;
        await PurchaseService.rejectBasket(userId, basketUUID);
    }

    /**
     * Directly purchases items for an actor.
     * @param {Actor} actor - The actor document making the purchase.
     * @param {object} basket - The basket or request object containing purchase data.
     * @param {object} [options={}] - Additional options.
     * @returns {Promise<boolean>} Whether the purchase succeeded.
     */
    async directPurchase(actor, basket, options = {}) {
        if (!actor || !basket) return false;
        return await PurchaseService.directPurchase(actor, basket, options);
    }

    /**
     * Gets the count of pending purchase requests.
     * @returns {number} The count of pending requests.
     */
    getPendingRequestCount() {
        return PurchaseService.getPendingRequestCount();
    }

    /**
     * Gets all pending purchase requests across all users.
     * @returns {Promise<Array<object>>} A promise resolving to an array of pending requests.
     */
    async getAllPendingRequests() {
        return await PurchaseService.getAllPendingRequests();
    }

    /**
     * Approves a pending basket request.
     * @param {string} userId - The ID of the user.
     * @param {string} basketUUID - The UUID of the basket.
     * @returns {Promise<void>}
     */
    async approveBasket(userId, basketUUID) {
        if (!userId || !basketUUID) return;
        await PurchaseService.approveBasket(userId, basketUUID);
    }

    /**
     * Updates properties on a pending item.
     * @param {string} userId - The ID of the user.
     * @param {string} basketUUID - The UUID of the basket.
     * @param {string} basketItemUuid - The UUID of the item in the basket.
     * @param {string} property - The property path to update.
     * @param {*} value - The new value.
     * @returns {Promise<void>}
     */
    async updatePendingItem(userId, basketUUID, basketItemUuid, property, value) {
        if (!userId || !basketUUID || !basketItemUuid) return;
        await PurchaseService.updatePendingItem(userId, basketUUID, basketItemUuid, property, value);
    }

    /**
     * Filters a list of items using search tags and a search term.
     * @param {Array<object>} items - The list of items to filter.
     * @param {Array<string>} tags - The active filter tags.
     * @param {string} searchTerm - The live search term.
     * @returns {Array<object>} The filtered list of items.
     */
    filterItems(items, tags = [], searchTerm = "") {
        if (!items) return [];
        let filtered = items;
        if ((tags && tags.length > 0) || searchTerm) {
            const cleanSearch = searchTerm ? searchTerm.trim().toLowerCase() : "";
            const cleanTags = tags ? tags.map(t => t.toLowerCase()) : [];
            filtered = filtered.filter(item => {
                const itemName = item.name ? item.name.toLowerCase() : "";
                const matchesTags = cleanTags.every(tag => itemName.includes(tag));
                const matchesLive = cleanSearch ? itemName.includes(cleanSearch) : true;
                return matchesTags && matchesLive;
            });
        }
        return filtered;
    }
}


/**
 * Internal class holding all Factory/Build-specific API functions.
 * @private
 */
class FactoryAPI {
    constructor() {
        this.buildService = new BuildService();
    }

    /**
     * Initializes the Factory API.
     */
    init() {
        //console.log("SR5 Marketplace | Factory API Initialized.");
    }

    /**
     * Retrieves the planned virtual modifications list from a vehicle actor.
     * @param {Actor} vehicle - The vehicle actor document.
     * @returns {object[]} Planned virtual modifications list.
     */
    getVirtualModifications(vehicle) {
        return this.buildService.getVirtualModifications(vehicle);
    }

    /**
     * Saves the planned virtual modifications list to a vehicle actor.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {object[]} virtualMods - The virtual modifications array.
     * @returns {Promise<void>}
     */
    async saveVirtualModifications(vehicle, virtualMods) {
        return await this.buildService.saveVirtualModifications(vehicle, virtualMods);
    }

    /**
     * Appends a virtual modification to the vehicle actor.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {object} virtualMod - The virtual modification data.
     * @returns {Promise<void>}
     */
    async addVirtualModification(vehicle, virtualMod) {
        return await this.buildService.addVirtualModification(vehicle, virtualMod);
    }

    /**
     * Updates an individual planned virtual modification's properties.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {string} virtualModId - The unique virtual modification ID.
     * @param {object} updateData - Key/value pairs to merge.
     * @returns {Promise<void>}
     */
    async updateVirtualModification(vehicle, virtualModId, updateData) {
        return await this.buildService.updateVirtualModification(vehicle, virtualModId, updateData);
    }

    /**
     * Removes a planned virtual modification from the vehicle actor.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {string} virtualModId - The virtual modification ID.
     * @returns {Promise<void>}
     */
    async removeVirtualModification(vehicle, virtualModId) {
        return await this.buildService.removeVirtualModification(vehicle, virtualModId);
    }

    /**
     * Checks stock status and syncs source metadata.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {Actor} workshopActor - The workshop/factory actor document.
     * @param {Actor} purchasingActor - The selected purchasing actor document.
     * @returns {Promise<boolean>} Whether the flags were updated.
     */
    async syncVirtualModificationsStock(vehicle, workshopActor, purchasingActor) {
        return await this.buildService.syncVirtualModificationsStock(vehicle, workshopActor, purchasingActor);
    }

    /**
     * Checks the inventory stock status for one or more modifications.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {Actor} workshopActor - The workshop/factory actor document.
     * @param {Actor} purchasingActor - The selected purchasing actor document.
     * @param {string|null} [targetModId=null] - Optional target modification ID.
     * @returns {object} Stock results.
     */
    checkInventoryStock(vehicle, workshopActor, purchasingActor, targetModId = null) {
        return factoryFlow.checkInventoryStock(vehicle, workshopActor, purchasingActor, targetModId);
    }

    /**
     * Starts the build test for a planned virtual modification on a vehicle.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {Actor} workshopActor - The workshop/factory actor document.
     * @param {Actor} purchasingActor - The selected purchasing actor document.
     * @param {object} vMod - The virtual modification object.
     * @returns {Promise<string>} The active dialog ID of the created test.
     */
    async startModificationTest(vehicle, workshopActor, purchasingActor, vMod) {
        return await factoryFlow.startModificationTest(vehicle, workshopActor, purchasingActor, vMod);
    }

    /**
     * Installs a modification onto the actual vehicle document.
     * @param {Actor} vehicle - The vehicle actor document.
     * @param {Actor} workshopActor - The workshop/factory actor document.
     * @param {Actor} purchasingActor - The selected purchasing actor document.
     * @param {object} vMod - The virtual modification object.
     * @returns {Promise<boolean>} Whether the modification was successfully installed.
     */
    async installModification(vehicle, workshopActor, purchasingActor, vMod) {
        return await factoryFlow.installModification(vehicle, workshopActor, purchasingActor, vMod);
    }

    /**
     * Resolves the list of eligible character actors owned by the vehicle's player owners.
     * @param {Actor} vehicle - The vehicle actor document.
     * @returns {Actor[]} List of character actors.
     */
    getEligiblePurchasers(vehicle) {
        return factoryFlow.getEligiblePurchasers(vehicle);
    }

    /**
     * Retrieves the current builder state.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The builder state.
     */
    async getBuilderState(userId = null) {
        return await this.buildService.getBuilderState(userId);
    }

    /**
     * Updates properties on the builder state.
     * @param {object} updateData - Properties to update.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    async updateBuilderState(updateData, userId = null) {
        return await this.buildService.updateBuilderState(updateData, userId);
    }

    /**
     * Sets the base item for the builder state.
     * @param {object|null} itemData - The base item data.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    async setBuilderBaseItem(itemData, userId = null) {
        return await this.buildService.setBuilderBaseItem(itemData, userId);
    }

    /**
     * Adds a modification to the builder state.
     * @param {object} modData - The modification data.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    async addBuilderModification(modData, userId = null) {
        return await this.buildService.addBuilderModification(modData, userId);
    }

    /**
     * Adds a change to a specific slot in the builder state.
     * @param {string} slotId - The slot ID.
     * @param {object} itemData - The item data.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    async addBuilderChange(slotId, itemData, userId = null) {
        return await this.buildService.addBuilderChange(slotId, itemData, userId);
    }

    /**
     * Removes a change from a specific slot in the builder state.
     * @param {string} slotId - The slot ID.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    async removeBuilderChange(slotId, userId = null) {
        return await this.buildService.removeBuilderChange(slotId, userId);
    }

    /**
     * Begins effect creation in the builder state.
     * @param {string} sourceUuid - The UUID of the source item.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async startBuilderEffectCreation(sourceUuid, userId = null) {
        return await this.buildService.startBuilderEffectCreation(sourceUuid, userId);
    }

    /**
     * Updates the builder draft effect.
     * @param {object} draftUpdate - Properties to merge.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async updateBuilderDraftEffect(draftUpdate, userId = null) {
        return await this.buildService.updateBuilderDraftEffect(draftUpdate, userId);
    }

    /**
     * Updates draft effect and state simultaneously.
     * @param {object} draftUpdate - Draft updates.
     * @param {object} stateUpdate - State updates.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async updateBuilderDraftAndState(draftUpdate = {}, stateUpdate = {}, userId = null) {
        return await this.buildService.updateBuilderDraftAndState(draftUpdate, stateUpdate, userId);
    }

    /**
     * Saves the draft effect to modifications.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async saveBuilderDraftEffect(userId = null) {
        return await this.buildService.saveBuilderDraftEffect(userId);
    }

    /**
     * Cancels draft effect creation.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async cancelBuilderEffectCreation(userId = null) {
        return await this.buildService.cancelBuilderEffectCreation(userId);
    }

    /**
     * Deletes a custom builder effect.
     * @param {string} effectId - The effect ID.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async deleteBuilderEffect(effectId, userId = null) {
        return await this.buildService.deleteBuilderEffect(effectId, userId);
    }

    /**
     * Starts editing a builder effect.
     * @param {string} sourceUuid - The source item UUID.
     * @param {string} effectId - The effect ID.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async startBuilderEffectEdit(sourceUuid, effectId, userId = null) {
        return await this.buildService.startBuilderEffectEdit(sourceUuid, effectId, userId);
    }

    /**
     * Toggles derived value selector visibility.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async toggleBuilderDerivedValueSelector(userId = null) {
        return await this.buildService.toggleBuilderDerivedValueSelector(userId);
    }

    /**
     * Clears builder state.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    async clearBuilderState(userId = null) {
        return await this.buildService.clearBuilderState(userId);
    }

    /**
     * Helper to get effects from item UUID.
     * @param {string} uuid - The item UUID.
     * @returns {Promise<Array>} The effects.
     */
    async getEffectFromItemUuid(uuid) {
        return await this.buildService.getEffectFromItemUuid(uuid);
    }

    /**
     * Toggles base item editing mode.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async toggleBuilderBaseItemEdit(userId = null) {
        return await this.buildService.toggleBuilderBaseItemEdit(userId);
    }

    /**
     * Updates base item overrides in state.
     * @param {object} updateData - Overrides updates.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    async updateBuilderBaseItemOverrides(updateData, userId = null) {
        return await this.buildService.updateBuilderBaseItemOverrides(updateData, userId);
    }
}


/**
 * Internal class holding all ItemBuilder-specific API functions.
 * @private
 */
class ItemBuilderAPI {
    constructor() {
        this.buildService = new BuildService();
    }

    /**
     * Initializes the Item Builder API.
     */
    init() {
        //console.log("SR5 Marketplace | Item Builder API Initialized.");
    }

    /**
     * Sets the base item for the Item Builder, opening/rendering the app.
     * @param {string} itemUuid - The UUID of the item to set as the base.
     * @returns {Promise<void>}
     */
    async setBaseItem(itemUuid) {
        if (!itemUuid) return;
        const item = await fromUuid(itemUuid);
        if (!item) {
            return ui.notifications.warn("Could not find the selected item.");
        }

        const cleanItemData = {
            uuid: item.uuid, name: item.name, img: item.img, type: item.type,
            system: item.system, technology: item.technology,
            effects: item.effects?.map(e => e.toObject(false)) ?? []
        };

        await this.buildService.setBuilderBaseItem(cleanItemData);
        
        let itemBuilder = foundry.applications.instances.get("itemBuilder");
        if (itemBuilder) {
            itemBuilder.render(true);
        } else {
            new ItemBuilderApp().render(true);
        }
    }

    /**
     * Gets the base item object currently in the Item Builder state.
     * @returns {Promise<object|null>} The base item data or null.
     */
    async getBaseItem() {
        const state = await this.buildService.getBuilderState();
        return state.baseItem;
    }

    /**
     * Opens the Item Builder application window.
     * @returns {Promise<void>}
     */
    async open() {
        let workshopActorUuid = null;
        if (canvas.ready && canvas.tokens?.controlled?.length) {
            // Check regions first
            if (canvas.scene?.regions) {
                for (const controlledToken of canvas.tokens.controlled) {
                    const tokenDoc = controlledToken.document || controlledToken;
                    const shopRegion = canvas.scene.regions.find(r => {
                        const shopUuid = r.flags?.["sr5-marketplace"]?.shopActorUuid;
                        if (!shopUuid) return false;
                        return r.tokens?.has(tokenDoc);
                    });
                    if (shopRegion) {
                        const shopUuid = shopRegion.flags["sr5-marketplace"].shopActorUuid;
                        const shopActor = await fromUuid(shopUuid);
                        if (shopActor?.system?.shop?.isFactory) {
                            workshopActorUuid = shopUuid;
                            break;
                        }
                    }
                }
            }

            // Check token distance if not found via region
            if (!workshopActorUuid) {
                const factoryTokens = canvas.tokens.placeables.filter(t => 
                    t.actor?.type === "sr5-marketplace.shop" && 
                    t.actor?.system?.shop?.isFactory
                );
                for (const controlledToken of canvas.tokens.controlled) {
                    for (const factoryToken of factoryTokens) {
                        const radius = factoryToken.actor.system.shop.shopRadius.value ?? 0;
                        const p1 = controlledToken.center || { x: controlledToken.x, y: controlledToken.y };
                        const p2 = factoryToken.center || { x: factoryToken.x, y: factoryToken.y };
                        const distance = canvas.grid.measurePath([p1, p2]).distance;
                        if (distance <= radius) {
                            workshopActorUuid = factoryToken.actor.uuid;
                            break;
                        }
                    }
                    if (workshopActorUuid) break;
                }
            }
        }

        if (!workshopActorUuid && canvas.ready && canvas.tokens) {
            const factoryTokens = canvas.tokens.placeables.filter(t => 
                t.actor?.type === "sr5-marketplace.shop" && 
                t.actor?.system?.shop?.isFactory
            );
            if (factoryTokens.length > 0) {
                workshopActorUuid = factoryTokens[0].actor.uuid;
            }
        }

        if (!game.user.isGM && !workshopActorUuid) {
            ui.notifications.warn("You must be near a workshop/factory to open the Item Builder.");
            return;
        }

        let itemBuilder = foundry.applications.instances.get("itemBuilder");
        if (itemBuilder) {
            if (workshopActorUuid) {
                itemBuilder.workshopActorUuid = workshopActorUuid;
            }
            if (!game.user.isGM) {
                itemBuilder.tabGroups.main = "workshop";
            }
            itemBuilder.render(true);
        } else {
            const options = {};
            if (workshopActorUuid) {
                options.workshopActorUuid = workshopActorUuid;
            }
            if (!game.user.isGM) {
                options.initialTab = "workshop";
            }
            itemBuilder = new ItemBuilderApp(options);
            itemBuilder.render(true);
        }
    }

    /**
     * Clears the Item Builder state and re-renders the application if it's open.
     * @returns {Promise<void>}
     */
    async clear() {
        await this.buildService.clearBuilderState();
        

        const itemBuilder = foundry.applications.instances.get("itemBuilder");
        if (itemBuilder) {
            itemBuilder.render(); 
        }
    }

    /**
     * Closes the Item Builder window if it is open.
     * @param {object} [options={}] - Optional settings.
     * @param {boolean} [options.clearState=false] - If true, also clears the builder state.
     * @returns {Promise<void>}
     */
    async close(options = {}) {
        const { clearState = false } = options;

        if (clearState) {
            await this.clear();
        }
        

        const itemBuilder = foundry.applications.instances.get("itemBuilder");
        if (itemBuilder) {
            await itemBuilder.close();
        }
    }
}


/**
 * Public-facing API Container.
 */
export class MarketplaceAPI {
    
    /**
     * The API for the in-game marketplace, shopping cart, and actor selection.
     * @type {typeof inGameMarketplaceAPI}
     */
    static Marketplace = inGameMarketplaceAPI;
    
    /**
     * The API for the Item Builder, including setting/clearing its state.
     * @type {typeof ItemBuilderAPI}
     */
    static ItemBuilder = ItemBuilderAPI;

    /**
     * The API for factory, workshop, and vehicle building modification tasks.
     * @type {typeof FactoryAPI}
     */
    static Factory = FactoryAPI;

    constructor() {}

    /**
     * Initializes the root Marketplace API container.
     */
    init() {
        console.log("SR5 Marketplace | MarketplaceAPI Initialized.");
    }
}