export class BasketService {

    constructor() {
        this.flagScope = "sr5-marketplace";
        this.flagKey = "basket";
    }

    /**
     * Gets the active shopping cart for the current user.
     * @returns {Promise<object>} The user's active cart object.
     */
    async getBasket() {
        const defaultCart = {
            basketUUID: foundry.utils.randomID(),
            creationTime: new Date().toISOString(),
            createdForActor: null,
            totalCost: 0,
            totalAvailability: "0",
            totalKarma: 0,
            totalEssenceCost: 0,
            basketItems: []
        };

        const state = game.user.getFlag(this.flagScope, this.flagKey) || {};
        return foundry.utils.mergeObject(defaultCart, state.activeCart || {});
    }

    /**
     * Saves the active shopping cart to the user's flags.
     * @param {object | null} cart - The cart object to save, or null to clear it.
     */
    async saveBasket(cart) {
        // We get the whole state, modify just the activeCart part, and save the whole state back.
        const state = game.user.getFlag(this.flagScope, this.flagKey) || { pendingRequests: [] };
        state.activeCart = cart;
        return game.user.setFlag(this.flagScope, this.flagKey, state);
    }

    /**
     * Adds an item to the shopping cart.
     * @param {string} itemUuid - The UUID of the item to add.
     */
    async addToBasket(itemUuid) {
        if (!itemUuid) return;

        const basket = await this.getBasket();
        const item = await fromUuid(itemUuid);
        if (!item) {
            ui.notifications.warn(`Item with UUID ${itemUuid} not found.`);
            return;
        }

        if (!basket.createdForActor) {
            const actor = game.user.character || canvas.tokens.controlled[0]?.actor;
            if (actor) {
                basket.createdForActor = actor.uuid;
            } else {
                ui.notifications.warn("Please select a token or assign a character to your user to create a basket.");
                return;
            }
        }
        
        let karmaCost = item.system.karma || item.flags?.['sr5-marketplace']?.Karma || 0;
        if (item.type === "spell") karmaCost = game.settings.get("sr5-marketplace", "karmaCostForSpell");
        else if (item.type === "complex_form") karmaCost = game.settings.get("sr5-marketplace", "karmaCostForComplexForm");

        const itemRating = item.system.technology?.rating || 1;

        const basketItem = {
            basketItemId: foundry.utils.randomID(), itemUuid: item.uuid, buyQuantity: 1,
            name: item.name, img: item.img, cost: item.system.technology?.cost || 0,
            karma: karmaCost, availability: item.system.technology?.availability || "0",
            essence: item.system.essence || 0, itemQuantity: item.system.quantity || 1,
            rating: itemRating, selectedRating: itemRating,
        };

        basket.basketItems.push(basketItem);
        const updatedBasket = this._recalculateTotals(basket);
        await this.saveBasket(updatedBasket);
        ui.notifications.info(`'${item.name}' added to basket.`);
    }

    /**
     * Removes a specific item entry from the basket using its unique basket ID.
     * @param {string} basketItemId
     */
    async removeFromBasket(basketItemId) {
        if (!basketItemId) return;
        const basket = await this.getBasket();
        const itemToRemove = basket.basketItems.find(i => i.basketItemId === basketItemId);
        if (!itemToRemove) return;

        basket.basketItems = basket.basketItems.filter(i => i.basketItemId !== basketItemId);
        
        const updatedBasket = this._recalculateTotals(basket);
        await this.saveBasket(updatedBasket);

        ui.notifications.info(`'${itemToRemove.name}' removed from basket.`);
    }

    /**
     * Updates the quantity of an item in the basket.
     * @param {string} basketItemId
     * @param {number} change - The amount to change the quantity by.
     */
    async updateItemQuantity(basketItemId, change) {
        if (!basketItemId || !change) return;
        const basket = await this.getBasket();
        const basketItem = basket.basketItems.find(i => i.basketItemId === basketItemId);

        if (!basketItem) return;

        basketItem.buyQuantity += change;

        if (basketItem.buyQuantity <= 0) {
            await this.removeFromBasket(basketItemId);
        } else {
            const updatedBasket = this._recalculateTotals(basket);
            await this.saveBasket(updatedBasket);
        }
    }

    /**
     * Updates the rating of an item in the basket.
     * @param {string} basketItemId
     * @param {number} rating
     */
    async updateItemRating(basketItemId, rating) {
        if (!basketItemId) return;
        const basket = await this.getBasket();
        const basketItem = basket.basketItems.find(i => i.basketItemId === basketItemId);

        if (basketItem) {
            basketItem.selectedRating = rating;
            // TODO: Recalculate cost/availability based on new rating.
            const updatedBasket = this._recalculateTotals(basket);
            await this.saveBasket(updatedBasket);
        }
    }

    /**
     * Recalculates all total fields for the basket based on its items.
     * @private
     */
    _recalculateTotals(basket) {
        basket.totalCost = basket.basketItems.reduce((acc, item) => acc + ((item.cost || 0) * (item.buyQuantity || 0)), 0);
        basket.totalKarma = basket.basketItems.reduce((acc, item) => acc + ((item.karma || 0) * (item.buyQuantity || 0)), 0);
        basket.totalEssenceCost = basket.basketItems.reduce((acc, item) => acc + ((item.essence || 0) * (item.buyQuantity || 0)), 0);

        const allAvailabilities = basket.basketItems.flatMap(item => Array(item.buyQuantity || 1).fill(item.availability));
        basket.totalAvailability = this._combineAvailabilities(allAvailabilities);

        return basket;
    }

    /**
     * Combines multiple availability strings into a single representative string.
     * @private
     */
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