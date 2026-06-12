// --- IMPORTS ---
import { BuilderStateService } from "../services/builderStateService.mjs";
import { ItemBuilderApp } from "../apps/ItemBuilderApp.mjs";
import { inGameMarketplace } from "../apps/inGameMarketplace.mjs";
import { BasketService } from "../services/basketService.mjs";
import { PurchaseService } from "../services/purchaseService.mjs";
import { MODULE_ID, SELECTED_ACTOR } from "../lib/constants.mjs";
import { ActorSelectionService } from "../services/ActorSelectionService.mjs";

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
        await this.basketService.addToBasket(itemUuid, actorUuid, userId, rest);
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
 * Internal class holding all ItemBuilder-specific API functions.
 * @private
 */
class ItemBuilderAPI {
    constructor() {}

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

        await BuilderStateService.setBaseItem(cleanItemData);
        
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
        const state = await BuilderStateService.getState();
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

        let itemBuilder = foundry.applications.instances.get("itemBuilder");
        if (itemBuilder) {
            if (workshopActorUuid) {
                itemBuilder.workshopActorUuid = workshopActorUuid;
            }
            itemBuilder.render(true);
        } else {
            const options = {};
            if (workshopActorUuid) {
                options.workshopActorUuid = workshopActorUuid;
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
        await BuilderStateService.clearState();
        

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
            await this.clearBuilderState();
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

    constructor() {}

    /**
     * Initializes the root Marketplace API container.
     */
    init() {
        console.log("SR5 Marketplace | MarketplaceAPI Initialized.");
    }
}