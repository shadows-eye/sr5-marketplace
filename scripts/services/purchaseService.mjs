export class PurchaseService {

    /**
     * Processes a direct purchase without GM approval.
     * @param {Actor5e} actor The actor making the purchase.
     * @param {object} basket The user's basket object.
     */
    static async directPurchase(actor, basket) {
        if (!actor || !basket) return;

        // 1. Check if the actor can afford the purchase
        const currentNuyen = actor.system.nuyen;
        if (currentNuyen < basket.totalCost) {
            ui.notifications.warn(`You cannot afford this purchase. You need ${basket.totalCost} ¥.`);
            return false;
        }

        // 2. Deduct costs
        const nuyenUpdate = currentNuyen - basket.totalCost;
        await actor.update({ "system.nuyen": nuyenUpdate });
        ui.notifications.info(`Deducted ${basket.totalCost} ¥ from ${actor.name}.`);

        // 3. Add items to the actor's inventory
        const itemsToCreate = [];
        for (const basketItem of basket.basketItems) {
            const sourceItem = await fromUuid(basketItem.itemUuid);
            if (sourceItem) {
                const itemData = sourceItem.toObject(); // Get a plain data object
                itemData.system.quantity = basketItem.buyQuantity * basketItem.itemQuantity; // Set correct final quantity
                itemsToCreate.push(itemData);
            }
        }
        await actor.createEmbeddedDocuments("Item", itemsToCreate);
        ui.notifications.info(`Added ${itemsToCreate.length} new item(s) to ${actor.name}'s inventory.`);
        
        return true;
    }

    /**
     * Submits a basket for GM review.
     * @param {User} user The user submitting the request.
     * @param {object} basket The user's basket object.
     */
    static async submitForReview(user, basket) {
        if (!user || !basket) return;

        basket.status = "pending"; // Mark the basket for review
        await user.setFlag("sr5-marketplace", "basket", basket);

        // Notify GM(s)
        const gmUsers = game.users.filter(u => u.isGM);
        // In a future step, we can use sockets to send a real-time notification.
        // For now, a simple notification for the submitting player is enough.
        ui.notifications.info("Your purchase request has been submitted to the GM for review.");
        
        return true;
    }

    /**
     * GM action to approve a pending basket for a specific user.
     * @param {string} userId The ID of the user whose basket is being approved.
     */
    static async approveBasket(userId) {
        const user = game.users.get(userId);
        if (!user) return;

        const basket = user.getFlag("sr5-marketplace", "basket");
        if (!basket || basket.status !== "pending") return;

        const actor = await fromUuid(basket.createdForActor);
        if (!actor) {
            ui.notifications.error(`Could not find the actor associated with this purchase request.`);
            return;
        }
        
        // Use the direct purchase logic to handle payment and item creation
        const success = await this.directPurchase(actor, basket);

        if (success) {
            // Clear the user's basket flag upon successful approval
            await user.unsetFlag("sr5-marketplace", "basket");
            ui.notifications.info(`Purchase approved for ${user.name}.`);
        }
    }

    /**
     * GM action to reject a pending basket for a specific user.
     * @param {string} userId The ID of the user whose basket is being rejected.
     */
    static async rejectBasket(userId) {
        const user = game.users.get(userId);
        if (!user) return;
        
        // Simply clear the flag. A future enhancement could send a notification to the player.
        await user.unsetFlag("sr5-marketplace", "basket");
        ui.notifications.warn(`Purchase request for ${user.name} has been rejected.`);
    }
}