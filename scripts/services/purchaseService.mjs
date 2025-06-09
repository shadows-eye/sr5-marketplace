export class PurchaseService {

    static get flagScope() { return "sr5-marketplace"; }
    static get flagKey() { return "marketplaceState"; }
    
    /**
     * Counts pending review requests across all users.
     * @returns {number} The total number of pending requests.
     */
    static getPendingRequestCount() {
        if (!game.user.isGM) return 0;
        return game.users.reduce((count, user) => {
            const state = user.getFlag(this.flagScope, this.flagKey);
            return count + (state?.pendingRequests?.length || 0);
        }, 0);
    }
    /**
     * Helper function to recalculate basket totals.
     * @private
     */
    static _recalculateTotals(basket) {
        basket.totalCost = basket.basketItems.reduce((acc, item) => acc + ((item.cost || 0) * (item.buyQuantity || 0)), 0);
        basket.totalKarma = basket.basketItems.reduce((acc, item) => acc + ((item.karma || 0) * (item.buyQuantity || 0)), 0);
        basket.totalEssenceCost = basket.basketItems.reduce((acc, item) => acc + ((item.essence || 0) * (item.buyQuantity || 0)), 0);

        // This availability calculation is complex, for now, we will just mark it as needing review.
        // A full recalculation would require the logic from basketService.
        const allAvailabilities = basket.basketItems.flatMap(item => Array(item.buyQuantity || 1).fill(item.availability));
        
        // A simplified recalculation for the review screen
        const totalNumeric = allAvailabilities.reduce((acc, avail) => acc + (parseInt(String(avail).match(/\d+/)?.[0], 10) || 0), 0);
        const highestCode = allAvailabilities.map(avail => String(avail).replace(/\d+/g, '').trim().toUpperCase()).sort().pop() || "";
        basket.totalAvailability = `${totalNumeric}${highestCode}`;

        return basket;
    }

    /**
     * Processes a direct purchase without GM approval.
     * @param {Actor} actor The actor making the purchase.
     * @param {object} basket The user's basket object.
     */
    static async directPurchase(actor, basket) {
        if (!actor || !basket) return;

        // 1. Check if the actor can afford the purchase
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

        // 2. Deduct costs
        await actor.update({ 
            "system.nuyen": currentNuyen - basket.totalCost,
            "system.karma.value": currentKarma - basket.totalKarma
        });
        ui.notifications.info(`Deducted ${basket.totalCost} ¥ and ${basket.totalKarma} Karma from ${actor.name}.`);

        // 3. Add items to the actor's inventory
        const itemsToCreate = [];
        for (const basketItem of basket.basketItems) {
            const sourceItem = await fromUuid(basketItem.itemUuid);
            if (sourceItem) {
                const itemData = sourceItem.toObject(); // Get a plain data object
                itemData.system.quantity = basketItem.buyQuantity * (itemData.system.quantity || 1);
                itemData.system.technology.rating = basketItem.selectedRating;
                // Apply GM-modified cost
                itemData.system.technology.cost = basketItem.cost;
                itemsToCreate.push(itemData);
            }
        }
        if (itemsToCreate.length > 0) {
            await actor.createEmbeddedDocuments("Item", itemsToCreate);
            ui.notifications.info(`Added ${itemsToCreate.length} new item(s) to ${actor.name}'s inventory.`);
        }
        
        return true;
    }

    /**
     * Submits the user's active cart for GM review.
     * This moves the active cart into the pendingRequests array.
     * @param {User} user The user submitting the request.
     */
    static async submitForReview(user) {
        const state = user.getFlag(this.flagScope, this.flagKey) || {};
        const cart = state.activeCart;

        if (!cart || cart.basketItems.length === 0) {
            ui.notifications.warn("Your shopping cart is empty.");
            return false;
        }

        cart.status = "pending"; // Mark as pending
        state.pendingRequests = state.pendingRequests || [];
        state.pendingRequests.push(cart); // Add to the pending array
        state.activeCart = null; // Clear the active cart

        await user.setFlag(this.flagScope, this.flagKey, state);
        ui.notifications.info("Your purchase request has been submitted to the GM for review.");
        game.socket.emit("module.sr5-marketplace", { type: "new_request", senderId: user.id });
        return true;
    }

    /**
     * GM action to approve a pending basket for a specific user.
     * @param {string} userId The ID of the user whose basket is being approved.
     * @param {string} basketUUID The unique ID of the basket to approve.
     */
    static async approveBasket(userId, basketUUID) {
        const user = game.users.get(userId);
        if (!user) return;

        const state = user.getFlag(this.flagScope, this.flagKey) || {};
        if (!state.pendingRequests) return;
        
        const requestIndex = state.pendingRequests.findIndex(r => r.basketUUID === basketUUID);
        if (requestIndex === -1) return;

        const [requestToProcess] = state.pendingRequests.splice(requestIndex, 1);
        const actor = await fromUuid(requestToProcess.createdForActor);
        
        if (actor) {
            const success = await this.directPurchase(actor, requestToProcess);
            if (success) {
                await user.setFlag(this.flagScope, this.flagKey, state); // Save the state with the request removed
                ui.notifications.info(`Purchase approved for ${user.name}.`);
                game.socket.emit("module.sr5-marketplace", { type: "request_resolved", userId });
            } else {
                state.pendingRequests.splice(requestIndex, 0, requestToProcess); // Add it back if purchase fails
            }
        }
    }

    /**
     * GM action to reject a pending basket for a specific user.
     * @param {string} userId
     * @param {string} basketUUID
     */
    static async rejectBasket(userId, basketUUID) {
        const user = game.users.get(userId);
        if (!user) return;

        const state = user.getFlag(this.flagScope, this.flagKey) || {};
        if (!state.pendingRequests) return;

        const initialCount = state.pendingRequests.length;
        state.pendingRequests = state.pendingRequests.filter(r => r.basketUUID !== basketUUID);

        if (state.pendingRequests.length < initialCount) {
            await user.setFlag(this.flagScope, this.flagKey, state);
            ui.notifications.warn(`Purchase request for ${user.name} has been rejected.`);
            game.socket.emit("module.sr5-marketplace", { type: "request_resolved", userId });
        }
    }

    /**
     * GM action to update a single item within a pending basket.
     * @param {string} userId - The ID of the user who owns the basket.
     * @param {string} basketItemId - The unique ID of the item within the basket.
     * @param {string} property - The property of the item to update (e.g., 'buyQuantity', 'cost').
     * @param {*} value - The new value for the property.
     */
    static async updatePendingItem(userId, basketItemId, property, value) {
        const user = game.users.get(userId);
        if (!user) return;

        const basket = user.getFlag("sr5-marketplace", "basket");
        if (!basket || basket.status !== "pending") return;

        const itemToUpdate = basket.basketItems.find(item => item.basketItemId === basketItemId);
        if (!itemToUpdate) return;

        foundry.utils.setProperty(itemToUpdate, property, value);

        const updatedBasket = this._recalculateTotals(basket);
        await user.setFlag("sr5-marketplace", "basket", updatedBasket);
    }
    
    /**
     * GM action to approve and process a single item from a basket.
     * @param {string} userId The ID of the user.
     * @param {string} basketItemId The ID of the item within the basket.
     */
    static async approveSingleItem(userId, basketItemId) {
        const user = game.users.get(userId);
        if (!user) return;

        const basket = user.getFlag("sr5-marketplace", "basket");
        if (!basket || basket.status !== "pending") return;

        const itemIndex = basket.basketItems.findIndex(item => item.basketItemId === basketItemId);
        if (itemIndex === -1) return;

        const actor = await fromUuid(basket.createdForActor);
        if (!actor) return;

        const [itemToPurchase] = basket.basketItems.splice(itemIndex, 1);
        const singleItemBasket = {
            basketItems: [itemToPurchase],
            totalCost: (itemToPurchase.cost || 0) * (itemToPurchase.buyQuantity || 0),
            totalKarma: (itemToPurchase.karma || 0) * (itemToPurchase.buyQuantity || 0),
            totalEssenceCost: (itemToPurchase.essence || 0) * (itemToPurchase.buyQuantity || 0),
        };
        
        const success = await this.directPurchase(actor, singleItemBasket);

        if (success) {
            const updatedBasket = this._recalculateTotals(basket);
            await user.setFlag("sr5-marketplace", "basket", updatedBasket);
            ui.notifications.info(`Approved '${itemToPurchase.name}' for ${user.name}.`);
            // Notify the user that their request has been updated
            game.socket.emit("module.sr5-marketplace", { type: "request_updated", userId: userId });
        } else {
            basket.basketItems.splice(itemIndex, 0, itemToPurchase);
        }
    }

    /**
     * GM action to reject and remove a single item from a basket.
     * @param {string} userId The ID of the user.
     * @param {string} basketItemId The ID of the item within the basket.
     */
    static async rejectSingleItem(userId, basketItemId) {
        const user = game.users.get(userId);
        if (!user) return;

        const basket = user.getFlag("sr5-marketplace", "basket");
        if (!basket || basket.status !== "pending") return;

        const itemIndex = basket.basketItems.findIndex(item => item.basketItemId === basketItemId);
        if (itemIndex === -1) return;

        const [rejectedItem] = basket.basketItems.splice(itemIndex, 1);
        
        const updatedBasket = this._recalculateTotals(basket);
        await user.setFlag("sr5-marketplace", "basket", updatedBasket);
        ui.notifications.warn(`Rejected '${rejectedItem.name}' for ${user.name}.`);
        // Notify the user that their request has been updated
        game.socket.emit("module.sr5-marketplace", { type: "request_updated", userId: userId });
    }
}