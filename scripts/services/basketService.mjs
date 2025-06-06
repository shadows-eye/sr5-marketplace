/**
 * A service class to manage the user's shopping basket,
 * which is stored as a flag on the User object.
 */
export class BasketService {

    constructor() {
        this.flagScope = "sr5-marketplace";
        this.flagKey = "basket";
    }

    /**
     * Gets the basket object for the current user.
     * If no basket exists, it returns a new, empty basket structure.
     * @returns {Promise<object>} The user's basket object.
     */
    async getBasket() {
        const defaultBasket = {
            basketUUID: foundry.utils.randomID(),
            creationTime: new Date().toISOString(),
            createdForActor: null,
            totalCost: 0,
            totalAvailability: "0",
            totalKarma: 0,
            totalEssenceCost: 0,
            basketItems: []
        };

        const existingBasket = game.user.getFlag(this.flagScope, this.flagKey);
        return foundry.utils.mergeObject(defaultBasket, existingBasket || {});
    }

    /**
     * Saves the basket object to the current user's flags.
     * @param {object} basket - The basket object to save.
     * @returns {Promise<object>} The saved basket object.
     */
    async saveBasket(basket) {
        return game.user.setFlag(this.flagScope, this.flagKey, basket);
    }

    /**
     * Adds an item to the shopping basket.
     * Default behavior is to add a new, unique entry for each click.
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
        
        // Default behavior: Always add a new line item to the basket.
        const basketItem = {
            basketItemId: foundry.utils.randomID(), // A unique ID for this specific basket entry
            itemUuid: item.uuid,
            buyQuantity: 1, // Default quantity is always 1 for new non-stacking items
            name: item.name,
            img: item.img,
            cost: item.system.technology?.cost || 0,
            karma: item.system.karma || item.flags?.['sr5-marketplace']?.Karma || 0,
            availability: item.system.technology?.availability || "0",
            essence: item.system.essence || 0,
        };
        basket.basketItems.push(basketItem);

        const updatedBasket = this._recalculateTotals(basket);
        console.log("SR5 Marketplace | Basket updated:", updatedBasket); // Log the object as requested
        await this.saveBasket(updatedBasket);

        ui.notifications.info(`'${item.name}' added to basket.`);
    }

    /**
     * Removes a specific item entry from the basket using its unique basket ID.
     * @param {string} basketItemId - The unique ID of the basket entry to remove.
     */
    async removeFromBasket(basketItemId) {
        if (!basketItemId) return;
        const basket = await this.getBasket();
        
        const itemToRemove = basket.basketItems.find(i => i.basketItemId === basketItemId);
        if (!itemToRemove) return;

        basket.basketItems = basket.basketItems.filter(i => i.basketItemId !== basketItemId);
        
        const updatedBasket = this._recalculateTotals(basket);
        console.log("SR5 Marketplace | Basket updated after removal:", updatedBasket);
        await this.saveBasket(updatedBasket);

        ui.notifications.info(`'${itemToRemove.name}' removed from basket.`);
    }

    /**
     * Updates the quantity of a stackable item.
     * @param {string} basketItemId - The unique ID of the basket entry to update.
     * @param {number} change - The amount to change the quantity by (e.g., 1 to increment, -1 to decrement).
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
     * NOTE: For now, this only updates the rating. A future step would be to recalculate
     * cost and other properties based on the new rating.
     * @param {string} basketItemId - The unique ID of the basket entry to update.
     * @param {number} rating - The new rating value.
     */
    async updateItemRating(basketItemId, rating) {
        if (!basketItemId) return;
        const basket = await this.getBasket();
        const basketItem = basket.basketItems.find(i => i.basketItemId === basketItemId);

        if (basketItem) {
            basketItem.selectedRating = rating;
            // TODO: Recalculate cost/availability based on new rating.
            // For now, we just save the new rating.
            await this.saveBasket(basket);
            console.log(`Updated rating for ${basketItem.name} to ${rating}`);
        }
    }
    
    /**
     * Recalculates all total fields for the basket based on its items.
     * @private
     */
    _recalculateTotals(basket) {
        basket.totalCost = basket.basketItems.reduce((acc, item) => acc + (item.cost * item.buyQuantity), 0);
        basket.totalKarma = basket.basketItems.reduce((acc, item) => acc + (item.karma * item.buyQuantity), 0);
        basket.totalEssenceCost = basket.basketItems.reduce((acc, item) => acc + (item.essence * item.buyQuantity), 0);

        const allAvailabilities = basket.basketItems.flatMap(item => Array(item.buyQuantity).fill(item.availability));
        basket.totalAvailability = this._combineAvailabilities(allAvailabilities);

        return basket;
    }

    /**
     * Combines multiple availability strings (e.g., "6R", "4F") into a single string.
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