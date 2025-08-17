import { BasketService } from "./basketService.mjs";

export class PurchaseService {
    static get flagScope() { return "sr5-marketplace"; }
    static get flagKey() { return "basket"; }

    /**
     * A robust helper to get and validate a user's basket flag.
     * If the flag is malformed, it can be reset.
     * @param {string} userId The user ID.
     * @param {object} [options]
     * @param {boolean} [options.resetInvalid=false] Whether to delete an invalid flag.
     * @returns {Promise<object|null>} The valid basket object or null.
     * @private
     */
    static async _validateAndGetBasket(userId, {resetInvalid = false} = {}) {
        const user = game.users.get(userId);
        if (!user) return null;

        let basket = user.getFlag(this.flagScope, this.flagKey);

        // Check for the essential arrays. If they don't exist, the flag is invalid.
        if (!basket || !Array.isArray(basket.shoppingCartItems) || !Array.isArray(basket.orderReviewItems)) {
            console.warn(`Marketplace | Invalid or missing basket flag for user ${user.name}.`);
            if (resetInvalid) {
                await user.unsetFlag(this.flagScope, this.flagKey);
                console.log(`Marketplace | Reset invalid basket flag for user ${user.name}.`);
            }
            return null;
        }
        
        const basketService = new BasketService();
        // Ensure the basket has all default properties.
        return foundry.utils.mergeObject(basketService._getDefaultBasketState(), basket);
    }

    static getPendingRequestCount() {
        if (!game.user.isGM) return 0;
        return game.users.reduce((count, user) => {
            const basket = user.getFlag(this.flagScope, this.flagKey);
            return count + (basket?.orderReviewItems?.length || 0);
        }, 0);
    }

    static async getAllPendingRequests() {
        if (!game.user.isGM) return [];
        const allPendingRequests = [];
        for (const user of game.users) {
            const basketState = user.getFlag(this.flagScope, this.flagKey);
            if (basketState?.orderReviewItems?.length > 0) {
                for (const request of basketState.orderReviewItems) {
                    const actor = request.createdForActor ? await fromUuid(request.createdForActor) : null;
                    allPendingRequests.push({ 
                        user: user.toJSON(), 
                        basket: request, 
                        actor: actor ? { name: actor.name, nuyen: actor.system.nuyen, karma: actor.system.karma.value } : null 
                    });
                }
            }
        }
        return allPendingRequests;
    }
    static async submitForReview(userId) {
        const user = game.users.get(userId);
        if (!user) return;

        const basketService = new BasketService();
        const basket = await basketService.getBasket(userId); 

        if (!basket.shoppingCartItems || basket.shoppingCartItems.length === 0) {
            return ui.notifications.warn("Your shopping cart is empty.");
        }

        const newRequest = {
            basketUUID: basket.basketUUID,
            creationTime: basket.creationTime,
            createdForActor: basket.createdForActor,
            selectedContactId: basket.selectedContactId,
            reviewRequest: true,
            basketItems: basket.shoppingCartItems,
            totalCost: basket.totalCost,
            totalAvailability: basket.totalAvailability,
            totalKarma: basket.totalKarma,
            totalEssenceCost: basket.totalEssenceCost,
        };

        basket.orderReviewItems.push(newRequest);
        
        // Clear the active cart fields
        basket.shoppingCartItems = [];
        basket.createdForActor = null;
        basket.selectedContactId = null;
        this._recalculateTotals(basket); // Recalculate totals to zero them out
        
        await basketService.saveBasket(basket, userId);
        ui.notifications.info("Your purchase request has been submitted to the GM for review.");
        game.socket.emit("module.sr5-marketplace", { type: "new_request", senderId: user.id, basketUUID: newRequest.basketUUID });
    }

    static async updatePendingItem(userId, basketUUID, basketItemUuid, property, value) {
        const user = game.users.get(userId);
        if (!user) return;
        const basketService = new BasketService();
        
        // --- FIX: Pass userId as an argument instead of using .call() ---
        const basket = await basketService.getBasket(userId);

        if (!basket?.orderReviewItems) return;

        const request = basket.orderReviewItems.find(r => r.basketUUID === basketUUID);
        if (!request) return;

        const item = request.basketItems.find(i => i.basketItemUuid === basketItemUuid);
        if (!item) return;

        foundry.utils.setProperty(item, property, value);
        this._recalculateTotals(request);

        // --- FIX: Pass userId as an argument instead of using .call() ---
        await basketService.saveBasket(basket, userId);
    }
    /**
     * Rejects and removes a single item from a pending request.
     */
    static async rejectItemFromRequest(userId, basketUUID, basketItemUuid) {
        const basket = await this._validateAndGetBasket(userId);
        if (!basket) return;

        const request = basket.orderReviewItems.find(r => r.basketUUID === basketUUID);
        if (!request) return;
        
        const initialItemCount = request.basketItems.length;
        request.basketItems = request.basketItems.filter(i => i.basketItemUuid !== basketItemUuid);

        if (request.basketItems.length < initialItemCount) {
            this._recalculateTotals(request);
            const basketService = new BasketService();
            await basketService.saveBasket(basket, userId);
            ui.notifications.info("Item rejected and removed from the request.");
        }
    }

    static async rejectBasket(userId, basketUUID) {
        // Use the validator to ensure we have a good basket object.
        const basket = await this._validateAndGetBasket(userId, {resetInvalid: true});
        if (!basket?.orderReviewItems) return;

        const initialCount = basket.orderReviewItems.length;
        basket.orderReviewItems = basket.orderReviewItems.filter(r => r.basketUUID !== basketUUID);

        if (basket.orderReviewItems.length < initialCount) {
            const basketService = new BasketService();
            await basketService.saveBasket(basket, userId);
            ui.notifications.warn(`Purchase request for user ${game.users.get(userId)?.name} has been rejected.`);
            game.socket.emit("module.sr5-marketplace", { type: "request_resolved", userId });
        }
    }

    static async approveBasket(userId, basketUUID) {
        const basketService = new BasketService();
        const basket = await basketService.getBasket(userId);
        if (!basket) return;

        const requestIndex = basket.orderReviewItems.findIndex(r => r.basketUUID === basketUUID);
        if (requestIndex === -1) return;
        
        const requestToProcess = basket.orderReviewItems[requestIndex];

        // --- REFACTOR ---
        // Call directPurchase with just the request data. It will find the actor itself.
        const success = await this.directPurchase(requestToProcess);
        
        if (success) {
            basket.orderReviewItems.splice(requestIndex, 1);
            await basketService.saveBasket(basket, userId);
            ui.notifications.info(`Purchase approved for user ${game.users.get(userId)?.name}.`);
            game.socket.emit("module.sr5-marketplace", { type: "request_resolved", userId });
        }
    }

    /**
     * This function is now self-contained. It receives basket data
     * and is responsible for finding the actor and completing the purchase.
     * @param {object} basket The basket or request object containing purchase data.
     */
    static async directPurchase(basket) {
        if (!basket || !basket.basketItems) return false;
        
        const actor = await fromUuid(basket.createdForActor);
        if (!actor) {
            ui.notifications.error("Could not find the actor associated with this purchase.");
            return false;
        }

        this._recalculateTotals(basket);
        
        const currentNuyen = actor.system.nuyen;
        const currentKarma = actor.system.karma.value;
        if (currentNuyen < basket.totalCost) { 
            ui.notifications.warn(`${actor.name} cannot afford this purchase. Needs ${basket.totalCost} ¥.`);
            return false;
        }
        if (currentKarma < basket.totalKarma) {
            ui.notifications.warn(`${actor.name} does not have enough Karma. Needs ${basket.totalKarma} K.`);
            return false;
        }

        await actor.update({ "system.nuyen": currentNuyen - basket.totalCost, "system.karma.value": currentKarma - basket.totalKarma });
        ui.notifications.info(`Deducted ${basket.totalCost} ¥ and ${basket.totalKarma} Karma from ${actor.name}.`);

        const itemsToCreate = [];
        for (const basketItem of basket.basketItems) {
            const sourceItem = await fromUuid(basketItem.itemUuid);
            if (sourceItem) {
                const itemData = sourceItem.toObject();
                itemData.system.quantity = basketItem.buyQuantity * (itemData.system.quantity || 1);

                // --- FIX: Only set technology properties if the technology object exists. ---
                // This prevents errors for items like qualities, spells, and actions.
                if ( "technology" in itemData.system ) {
                    itemData.system.technology.rating = basketItem.selectedRating;
                    itemData.system.technology.cost = basketItem.cost;
                }
                
                itemsToCreate.push(itemData);
            }
        }
        // --- DEBUG LOG: Inspect the data being passed to the creation method ---
        console.log("Marketplace | Attempting to create the following items on actor:", actor.name, itemsToCreate);
        // --- END DEBUG LOG ---

        if (itemsToCreate.length > 0) {
            await actor.createEmbeddedDocuments("Item", itemsToCreate);
            ui.notifications.info(`Added ${itemsToCreate.length} new item(s) to ${actor.name}'s inventory.`);
        }
        return true;
    }
    
    static _recalculateTotals(basket) {
        const items = basket.basketItems || basket.shoppingCartItems || [];
        basket.totalCost = items.reduce((acc, item) => acc + ((item.cost || 0) * (item.buyQuantity || 0)), 0);
        basket.totalKarma = items.reduce((acc, item) => acc + ((item.karma || 0) * (item.buyQuantity || 0)), 0);
        basket.totalEssenceCost = items.reduce((acc, item) => acc + ((item.essence || 0) * (item.buyQuantity || 0)), 0);
        
        const basketService = new BasketService();
        basket.totalAvailability = basketService._combineAvailabilities(items.flatMap(item => Array(item.buyQuantity || 1).fill(item.availability)));
        
        return basket;
    }
}