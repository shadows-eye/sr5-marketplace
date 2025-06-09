import { BasketService } from "./basketService.mjs";

export class PurchaseService {
    static get flagScope() { return "sr5-marketplace"; }
    static get flagKey() { return "basket"; }

    static getPendingRequestCount() {
        if (!game.user.isGM) return 0;
        return game.users.reduce((count, user) => {
            const basket = user.getFlag(this.flagScope, this.flagKey);
            return count + (basket?.orderReviewItems?.length || 0);
        }, 0);
    }

    static async submitForReview(userId) {
        const user = game.users.get(userId);
        if (!user) return;

        const basketService = new BasketService();
        // This now correctly gets the basket for the specific user.
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
        
        // This now correctly saves the basket for the specific user.
        await basketService.saveBasket(basket, userId);
        ui.notifications.info("Your purchase request has been submitted to the GM for review.");
        game.socket.emit("module.sr5-marketplace", { type: "new_request", senderId: user.id, basketUUID: newRequest.basketUUID });
    }

    static async updatePendingItem(userId, basketUUID, basketItemId, property, value) {
        const user = game.users.get(userId);
        if (!user) return;
        const basketService = new BasketService();
        const basket = await basketService.getBasket.call({user});

        if (!basket?.orderReviewItems) return;

        const request = basket.orderReviewItems.find(r => r.basketUUID === basketUUID);
        if (!request) return;

        const item = request.basketItems.find(i => i.basketItemId === basketItemId);
        if (!item) return;

        foundry.utils.setProperty(item, property, value);
        this._recalculateTotals(request);

        await basketService.saveBasket.call({user}, basket);
    }

    static async rejectBasket(userId, basketUUID) {
        const user = game.users.get(userId);
        if (!user) return;
        const basketService = new BasketService();
        const basket = await basketService.getBasket.call({user});
        if (!basket?.orderReviewItems) return;

        const initialCount = basket.orderReviewItems.length;
        basket.orderReviewItems = basket.orderReviewItems.filter(r => r.basketUUID !== basketUUID);

        if (basket.orderReviewItems.length < initialCount) {
            await basketService.saveBasket.call({user}, basket);
            ui.notifications.warn(`Purchase request for ${user.name} has been rejected.`);
            game.socket.emit("module.sr5-marketplace", { type: "request_resolved", userId });
        }
    }

    static async approveBasket(userId, basketUUID) {
        const user = game.users.get(userId);
        if (!user) return;
        const basketService = new BasketService();
        const basket = await basketService.getBasket.call({user});
        const requestIndex = basket.orderReviewItems?.findIndex(r => r.basketUUID === basketUUID);
        if (requestIndex === undefined || requestIndex === -1) return;

        const [requestToProcess] = basket.orderReviewItems.splice(requestIndex, 1);
        const actor = await fromUuid(requestToProcess.createdForActor);
        if (!actor) return;

        const success = await this.directPurchase(actor, requestToProcess);
        if (success) {
            await basketService.saveBasket.call({user}, basket);
            ui.notifications.info(`Purchase approved for ${user.name}.`);
            game.socket.emit("module.sr5-marketplace", { type: "request_resolved", userId });
        } else {
            basket.orderReviewItems.splice(requestIndex, 0, requestToProcess);
            await basketService.saveBasket.call({user}, basket);
        }
    }

    static async directPurchase(actor, basket) {
        if (!actor || !basket || !basket.basketItems) return false;
        
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
                itemData.system.technology.rating = basketItem.selectedRating;
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