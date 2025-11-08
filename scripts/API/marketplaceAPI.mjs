// --- IMPORTS ---
import { BuilderStateService } from "../services/builderStateService.mjs";
import { ItemBuilderApp } from "../apps/ItemBuilderApp.mjs";
import { inGameMarketplace } from "../apps/inGameMarketplace.mjs";
import { BasketService } from "../services/basketService.mjs";
import { MODULE_ID, SELECTED_ACTOR } from "../lib/constants.mjs";

/**
 * Internal class holding all Marketplace-specific API functions.
 * @private
 */
class inGameMarketplaceAPI {
    constructor(){}

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
        const { userId = null } = options;
        // Pass the (potentially null) userId to the basket service
        await this.basketService.addToBasket(itemUuid, actorUuid, userId);
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
            await game.user.setFlag(MODULE_ID, SELECTED_ACTOR, actorUuid);
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
        await game.user.setFlag(MODULE_ID, SELECTED_ACTOR, actorUuid);
        
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
        await game.user.unsetFlag(MODULE_ID, SELECTED_ACTOR);
        
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

        let itemBuilder = foundry.applications.instances.get("itemBuilder");
        if (!itemBuilder) {
            itemBuilder = new ItemBuilderApp();
        }
        itemBuilder.render(true);
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