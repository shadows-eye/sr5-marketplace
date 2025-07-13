export class BasketService {

    constructor() {
        this.flagScope = "sr5-marketplace";
        this.flagKey = "basket";
    }
    /**
     * Returns the default structure for the entire basket flag.
     */
    _getDefaultBasketState() {
        return {
            basketUUID: foundry.utils.randomID(),
            creationTime: new Date().toISOString(),
            createdForActor: null,
            selectedContactId: null,
            totalCost: 0,
            totalAvailability: "0",
            totalKarma: 0,
            totalEssenceCost: 0,
            shoppingCartItems: [],
            orderReviewItems: []
        };
    }
    /**
     * Gets the entire basket state for a given user, merged with defaults.
     * If no userId is provided, it defaults to the current game user.
     * @param {string|null} userId The ID of the user to get the basket for.
     * @returns {Promise<object>}
     */
    async getBasket(userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (!user) return this._getDefaultBasketState();

        const savedBasket = await user.getFlag(this.flagScope, this.flagKey) || {};
        return foundry.utils.mergeObject(this._getDefaultBasketState(), savedBasket);
    }

    /**
     * Saves the entire basket state back to a user's flag.
     * @param {object} basket The entire basket state object to save.
     * @param {string|null} [userId=null] The ID of the user to save the basket for.
     */
    async saveBasket(basket, userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (user) {
            // 'this.flagScope' and 'this.flagKey' will now be correct.
            return user.setFlag(this.flagScope, this.flagKey, basket);
        }
    }
    
    /**
     * Adds an item to the current user's active shopping cart.
     * @param {string} itemUuid The UUID of the item to add.
     * @param {string} actorUuid The UUID of the actor this basket is for.
     */
    async addToBasket(itemUuid, actorUuid) {
        if (!itemUuid || !actorUuid) {
            ui.notifications.error("Cannot add item to cart without a purchasing actor.");
            return;
        }

        const basket = await this.getBasket();
        // This is the fix: The createdForActor is now always set from the actorUuid passed by the application.
        basket.createdForActor = actorUuid;

        const item = await fromUuid(itemUuid);
        if (!item) return ui.notifications.warn(`Item with UUID ${itemUuid} not found.`);

        const itemBehaviors = game.settings.get("sr5-marketplace", "itemTypeBehaviors") || {};
        const behavior = itemBehaviors[item.type] || 'single';
        const existingItemInCart = basket.shoppingCartItems.find(i => i.itemUuid === item.uuid);

        if (behavior === 'unique') {
            if (existingItemInCart) {
                return ui.notifications.warn(`'${item.name}' is a unique item and is already in your cart.`);
            }
            const actor = await fromUuid(basket.createdForActor);
            if (actor && actor.items.some(i => i.name === item.name && i.type === item.type)) {
                return ui.notifications.warn(`Your character, ${actor.name}, already possesses the unique item: '${item.name}'.`);
            }
        }

        if (behavior === 'stack' && existingItemInCart) {
            existingItemInCart.buyQuantity += 1;
        } else {
            const basketItem = {
                basketItemUuid: "basket." + foundry.utils.randomID(),
                itemUuid: item.uuid,
                buyQuantity: 1,
                name: item.name, 
                img: item.img, 
                cost: item.system.technology?.cost || 0,
                karma: item.system.karma || 0, 
                availability: item.system.technology?.availability || "0",
                essence: item.system.essence || 0, 
                itemQuantity: behavior === 'stack' ? 10 : (item.system.quantity || 1),
                rating: item.system.technology?.rating || 1, 
                selectedRating: item.system.technology?.rating || 1,
            };
            basket.shoppingCartItems.push(basketItem);
        }
        
        const updatedBasket = this._recalculateTotals(basket);
        await this.saveBasket(updatedBasket);
        //ui.notifications.info(`'${item.name}' added to basket.`);
    }
    
    /**
     * Removes an item from the active shopping cart using its unique instance ID.
     * @param {string} basketItemUuid The unique ID of the item instance in the cart.
     */
    async removeFromBasket(basketItemUuid) {
        if (!basketItemUuid) return;
        const basket = await this.getBasket();
        const initialCount = basket.shoppingCartItems.length;
        
        basket.shoppingCartItems = basket.shoppingCartItems.filter(i => i.basketItemUuid !== basketItemUuid);

        if (basket.shoppingCartItems.length < initialCount) {
            const updatedBasket = this._recalculateTotals(basket);
            await this.saveBasket(updatedBasket);
            ui.notifications.info(`Item removed from basket.`);
        }
    }

    /**
     * Updates the quantity of an item in the basket based on its behavior setting.
     * @param {string} basketItemUuid The unique ID of the item instance to act upon.
     * @param {number} change The amount to change by (+1 or -1).
     */
    async updateItemQuantity(basketItemUuid, actorUuid,change) {
        if (!basketItemUuid || !change) return;

        const basket = await this.getBasket();
        const itemBehaviors = game.settings.get("sr5-marketplace", "itemTypeBehaviors") || {};
        
        const targetItem = basket.shoppingCartItems.find(i => i.basketItemUuid === basketItemUuid);
        if (!targetItem) return;

        const sourceItem = await fromUuid(targetItem.itemUuid);
        if (!sourceItem) return;

        const behavior = itemBehaviors[sourceItem.type] || 'single';

        switch (behavior) {
            case 'stack':
                targetItem.buyQuantity += change;
                if (targetItem.buyQuantity <= 0) {
                    await this.removeFromBasket(basketItemUuid);
                    return; // Exit as removeFromBasket already saves and updates.
                }
                break;

            case 'single':
                if (change > 0) {
                    // For "single" items, adding quantity means adding a new, separate instance of that item.
                    await this.addToBasket(targetItem.itemUuid, actorUuid);
                    return; // Exit as addToBasket already saves and updates.
                } else {
                    // The minus button on a single item just removes that one instance.
                    await this.removeFromBasket(basketItemUuid, actorUuid);
                    return; // Exit as removeFromBasket already saves and updates.
                }

            case 'unique':
                // The UI should prevent this, but we do nothing here for safety.
                return;
        }

        const updatedBasket = this._recalculateTotals(basket);
        await this.saveBasket(updatedBasket);
    }

    _recalculateTotals(basket) {
        // This helper now correctly calculates totals based on the shoppingCartItems array.
        const items = basket.shoppingCartItems || [];
        basket.totalCost = items.reduce((acc, item) => acc + ((item.cost || 0) * (item.buyQuantity || 0)), 0);
        basket.totalKarma = items.reduce((acc, item) => acc + ((item.karma || 0) * (item.buyQuantity || 0)), 0);
        basket.totalEssenceCost = items.reduce((acc, item) => acc + ((item.essence || 0) * (item.buyQuantity || 0)), 0);
        const allAvailabilities = items.flatMap(item => Array(item.buyQuantity || 1).fill(item.availability));
        basket.totalAvailability = this._combineAvailabilities(allAvailabilities);
        return basket;
    }
    
    _combineAvailabilities(availStrings) {
        const priority = { "F": 3, "V": 3, "R": 2, "E": 2, "": 1 };
        let totalNumeric = 0;
        let highestPriorityCode = "";
        for (const avail of availStrings) {
            const match = String(avail).match(/^(\d+)?([A-Z])?$/i);
            if (!match) continue;
            const numericPart = parseInt(match[1] || '0', 10);
            const codePart = (match[2] || "").toUpperCase();
            totalNumeric += numericPart;
            if ((priority[codePart] || 0) > (priority[highestPriorityCode] || 0)) {
                highestPriorityCode = codePart;
            }
        }
        return `${totalNumeric}${highestPriorityCode}`;
    }
}