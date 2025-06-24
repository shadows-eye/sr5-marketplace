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
     */
    async addToBasket(itemUuid) {
        if (!itemUuid) return;
        const basket = await this.getBasket(); // Gets current user's basket
        const item = await fromUuid(itemUuid);
        if (!item) return ui.notifications.warn(`Item with UUID ${itemUuid} not found.`);

        if (!basket.createdForActor) {
            const actor = game.user.character || canvas.tokens.controlled[0]?.actor;
            if (actor) basket.createdForActor = actor.uuid;
            else return ui.notifications.warn("Please select a token or assign a character to your user.");
        }
        
        const basketItem = {
            basketItemId: item.uuid, 
            buyQuantity: 1,
            name: item.name, 
            img: item.img, 
            cost: item.system.technology?.cost || 0,
            karma: item.system.karma || 0, availability: item.system.technology?.availability || "0",
            essence: item.system.essence || 0, itemQuantity: item.system.quantity || 1,
            rating: item.system.technology?.rating || 1, selectedRating: item.system.technology?.rating || 1,
        };

        basket.shoppingCartItems.push(basketItem);
        this._recalculateTotals(basket);
        await this.saveBasket(basket);
        ui.notifications.info(`'${item.name}' added to basket.`);
    }
    
    async removeFromBasket(basketItemId) {
        if (!basketItemId) return;
        const basket = await this.getBasket();
        const initialCount = basket.shoppingCartItems.length;
        basket.shoppingCartItems = basket.shoppingCartItems.filter(i => i.basketItemId !== basketItemId);

        if (basket.shoppingCartItems.length < initialCount) {
            const updatedBasket = this._recalculateTotals(basket);
            await this.saveBasket(updatedBasket);
            ui.notifications.info(`Item removed from basket.`);
        }
    }

    async updateItemQuantity(basketItemId, change) {
        if (!basketItemId || !change) return;
        const basket = await this.getBasket();
        const basketItem = basket.shoppingCartItems.find(i => i.basketItemId === basketItemId);
        if (!basketItem) return;

        basketItem.buyQuantity += change;
        if (basketItem.buyQuantity <= 0) {
            basket.shoppingCartItems = basket.shoppingCartItems.filter(i => i.basketItemId !== basketItemId);
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