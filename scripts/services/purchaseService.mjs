import { BasketService } from "./basketService.mjs";
import { MODULE_ID, FLAGKEY_Basket } from "../lib/constants.mjs";
import { AppTestFlagService } from "./AppTestFlagService.mjs";
import enrichHTML from "./enricher.mjs";


export class PurchaseService {

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

        let basket = user.getFlag(MODULE_ID, FLAGKEY_Basket);

        // Check for the essential arrays. If they don't exist, the flag is invalid.
        if (!basket || !Array.isArray(basket.shoppingCartItems) || !Array.isArray(basket.orderReviewItems)) {
            console.warn(`Marketplace | Invalid or missing basket flag for user ${user.name}.`);
            if (resetInvalid) {
                await user.unsetFlag(MODULE_ID, FLAGKEY_Basket);
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
            const basket = user.getFlag(MODULE_ID, FLAGKEY_Basket);
            return count + (basket?.orderReviewItems?.length || 0);
        }, 0);
    }

    static async getAllPendingRequests() {
        if (!game.user.isGM) return [];
        const allPendingRequests = [];
        for (const user of game.users) {
            const basketState = user.getFlag(MODULE_ID, FLAGKEY_Basket);
            if (basketState?.orderReviewItems?.length > 0) {
                for (const request of basketState.orderReviewItems) {
                    const actor = request.createdForActor ? await fromUuid(request.createdForActor) : null;
                    allPendingRequests.push({ 
                        user: user.toJSON(), 
                        basket: request, 
                        actor: actor ? { 
                            name: actor.name, 
                            uuid: actor.uuid, 
                            img: actor.img, 
                            nuyen: actor.system.nuyen, 
                            karma: actor.system.karma.value,
                            essence: actor.system.attributes.essence?.value ?? 6
                        } : null 
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

        const testStates = await AppTestFlagService.readState(userId);
        const testState = Object.values(testStates)[0] || null;

        const newRequest = {
            basketUUID: basket.basketUUID,
            creationTime: basket.creationTime,
            createdForActor: basket.createdForActor,
            selectedContactId: basket.selectedContactId,
            shopActorUuid: basket.shopActorUuid,
            reviewRequest: true,
            basketItems: basket.shoppingCartItems,
            totalCost: basket.totalCost,
            totalAvailability: basket.totalAvailability,
            totalKarma: basket.totalKarma,
            totalEssenceCost: basket.totalEssenceCost,
            testState: testState
        };

        basket.orderReviewItems.push(newRequest);
        
        // Clear the active cart fields
        basket.shoppingCartItems = [];
        basket.createdForActor = null;
        basket.selectedContactId = null;
        this._recalculateTotals(basket); // Recalculate totals to zero them out
        
        await basketService.saveBasket(basket, userId);

        if (testState) {
            await AppTestFlagService.deleteState(userId);
        }

        game.socket.emit("module.sr5-marketplace", { type: "new_request", senderId: user.id, basketUUID: newRequest.basketUUID });

        // Post a ChatMessageRequest to the chat log
        if (game.settings.get("sr5-marketplace", "chatRequestEnabled")) {
            try {
                const actorId = newRequest.createdForActor ? newRequest.createdForActor.split(".").pop() : null;
                const items = newRequest.basketItems.map(i => ({
                    ...i,
                    rating: i.selectedRating ?? i.rating
                }));
                const chatData = {
                    actorId: actorId,
                    items: items,
                    totalCost: newRequest.totalCost,
                    totalAvailability: newRequest.totalAvailability,
                    totalKarma: newRequest.totalKarma,
                    totalEssenceCost: newRequest.totalEssenceCost,
                    id: newRequest.basketUUID,
                    isGM: game.user.isGM,
                    statusMessage: game.i18n.localize("SR5Marketplace.Marketplace.Notifications.PurchaseRequestSubmitted")
                };

                const html = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/chat/chatMessageRequest.html", chatData);
                const actor = newRequest.createdForActor ? await fromUuid(newRequest.createdForActor) : null;
                const speaker = actor ? ChatMessage.getSpeaker({ actor }) : {};
                await ChatMessage.create({
                    speaker: speaker,
                    content: html
                });
            } catch (err) {
                console.error("SR5 Marketplace | Failed to post order request to chat log:", err);
            }
        }
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
        
        const itemToReject = request.basketItems.find(i => i.basketItemUuid === basketItemUuid);
        const initialItemCount = request.basketItems.length;
        request.basketItems = request.basketItems.filter(i => i.basketItemUuid !== basketItemUuid);

        if (request.basketItems.length < initialItemCount) {
            this._recalculateTotals(request);
            const basketService = new BasketService();
            await basketService.saveBasket(basket, userId);

            if (itemToReject && game.settings.get("sr5-marketplace", "chatRejectionEnabled")) {
                try {
                    const actor = request.createdForActor ? await fromUuid(request.createdForActor) : null;
                    const useSmartphone = !!(game.modules.get("smartphone-widget")?.active && game.settings.get("sr5-marketplace", "sendToSmartphone"));
                    
                    const templatePath = useSmartphone && actor
                        ? "modules/sr5-marketplace/templates/chat/orderRejectionPhone.html"
                        : "modules/sr5-marketplace/templates/chat/orderRejection.html";

                    let html = await foundry.applications.handlebars.renderTemplate(templatePath, {
                        items: [{ name: itemToReject.name, uuid: itemToReject.itemUuid }],
                        statusMessage: game.i18n.localize("SR5Marketplace.Marketplace.Notifications.ItemRejected")
                    });

                    if (useSmartphone && actor) {
                        const phoneApi = game.modules.get("smartphone-widget")?.api;
                        const phone = await phoneApi?.getPhoneForActor(actor.id);
                        if (phone) {
                            let senderAlias = "Marketplace";
                            let senderPhoneId = undefined;
                            if (request.shopActorUuid) {
                                const shopActor = await fromUuid(request.shopActorUuid);
                                const servingEmployeeUuid = shopActor?.system?.shop?.servingEmployee;
                                const employeeActor = servingEmployeeUuid ? await fromUuid(servingEmployeeUuid) : null;
                                if (employeeActor) {
                                    senderAlias = employeeActor.name;
                                    const employeePhone = await phoneApi?.getPhoneForActor(employeeActor.id);
                                    if (employeePhone) {
                                        senderPhoneId = employeePhone.id;
                                    }
                                } else if (shopActor) {
                                    senderAlias = shopActor.name;
                                }
                            }
                            const enrichedHtml = await enrichHTML(html, { async: true });
                            await phoneApi.sendSystemMessage(phone.id, enrichedHtml, { senderAlias, senderPhoneId, chat: false });
                        }
                    } else {
                        const speaker = actor ? ChatMessage.getSpeaker({ actor }) : {};
                        await ChatMessage.create({
                            speaker: speaker,
                            content: html
                        });
                    }
                } catch (err) {
                    console.error("SR5 Marketplace | Failed to post order item rejection:", err);
                }
            }
        }
    }

    static async rejectBasket(userId, basketUUID) {
        // Use the validator to ensure we have a good basket object.
        const basket = await this._validateAndGetBasket(userId, {resetInvalid: true});
        if (!basket?.orderReviewItems) return;

        const request = basket.orderReviewItems.find(r => r.basketUUID === basketUUID);
        const initialCount = basket.orderReviewItems.length;
        basket.orderReviewItems = basket.orderReviewItems.filter(r => r.basketUUID !== basketUUID);

        if (basket.orderReviewItems.length < initialCount) {
            const basketService = new BasketService();
            await basketService.saveBasket(basket, userId);
            game.socket.emit("module.sr5-marketplace", { type: "request_resolved", userId });

            if (request && game.settings.get("sr5-marketplace", "chatRejectionEnabled")) {
                try {
                    const rejectedItems = request.basketItems.map(i => ({
                        name: i.name,
                        uuid: i.itemUuid
                    }));
                    if (rejectedItems.length > 0) {
                        const actor = request.createdForActor ? await fromUuid(request.createdForActor) : null;
                        const useSmartphone = !!(game.modules.get("smartphone-widget")?.active && game.settings.get("sr5-marketplace", "sendToSmartphone"));
                        
                        const templatePath = useSmartphone && actor
                            ? "modules/sr5-marketplace/templates/chat/orderRejectionPhone.html"
                            : "modules/sr5-marketplace/templates/chat/orderRejection.html";

                        let html = await foundry.applications.handlebars.renderTemplate(templatePath, {
                            items: rejectedItems,
                            statusMessage: game.i18n.format("SR5Marketplace.Marketplace.Notifications.PurchaseRequestRejected", { name: game.users.get(userId)?.name || "" })
                        });

                        if (useSmartphone && actor) {
                            const phoneApi = game.modules.get("smartphone-widget")?.api;
                            const phone = await phoneApi?.getPhoneForActor(actor.id);
                            if (phone) {
                                let senderAlias = "Marketplace";
                                let senderPhoneId = undefined;
                                if (request.shopActorUuid) {
                                    const shopActor = await fromUuid(request.shopActorUuid);
                                    const servingEmployeeUuid = shopActor?.system?.shop?.servingEmployee;
                                    const employeeActor = servingEmployeeUuid ? await fromUuid(servingEmployeeUuid) : null;
                                    if (employeeActor) {
                                        senderAlias = employeeActor.name;
                                        const employeePhone = await phoneApi?.getPhoneForActor(employeeActor.id);
                                        if (employeePhone) {
                                            senderPhoneId = employeePhone.id;
                                        }
                                    } else if (shopActor) {
                                        senderAlias = shopActor.name;
                                    }
                                }
                                const enrichedHtml = await enrichHTML(html, { async: true });
                                await phoneApi.sendSystemMessage(phone.id, enrichedHtml, { senderAlias, senderPhoneId, chat: false });
                            }
                        } else {
                            const speaker = actor ? ChatMessage.getSpeaker({ actor }) : {};
                            await ChatMessage.create({
                                speaker: speaker,
                                content: html
                            });
                        }
                    }
                } catch (err) {
                    console.error("SR5 Marketplace | Failed to post order rejection:", err);
                }
            }
        }
    }

    static async approveBasket(userId, basketUUID) {
        const basketService = new BasketService();
        const basket = await basketService.getBasket(userId);
        if (!basket) return;

        const requestIndex = basket.orderReviewItems.findIndex(r => r.basketUUID === basketUUID);
        if (requestIndex === -1) return;
        
        const requestToProcess = basket.orderReviewItems[requestIndex];
        const actor = await fromUuid(requestToProcess.createdForActor);

        // --- REFACTOR ---
        // Call directPurchase with the actor and the request data.
        const success = await this.directPurchase(actor, requestToProcess, { userName: game.users.get(userId)?.name });
        
        if (success) {
            basket.orderReviewItems.splice(requestIndex, 1);
            await basketService.saveBasket(basket, userId);
            game.socket.emit("module.sr5-marketplace", { type: "request_resolved", userId });
        }
    }

    static async _createVehicleActor(actorData, userId) {
        if (game.user.isGM) {
            const data = foundry.utils.deepClone(actorData);
            data.ownership = data.ownership || {};
            data.ownership[userId] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
            const newActor = await Actor.create(data);
            if (newActor) {
                console.log(`SR5 Marketplace | GM created actor: ${newActor.name} for user ${userId}`);
            }
        } else {
            game.socket.emit(`module.sr5-marketplace`, {
                action: "create_actor",
                actorData: actorData,
                userId: userId
            });
        }
    }

    /**
     * This function handles the purchase operations.
     * It receives both the actor and the basket/request object.
     * @param {Actor} actor The actor document making the purchase.
     * @param {object} basket The basket or request object containing purchase data.
     * @param {object} [options] Additional options.
     * @param {string} [options.userName=""] The username of the purchaser.
     */
    static async directPurchase(actor, basket, { userName = "" } = {}) {
        // Fallback for single-argument call style
        if (!basket && actor && (actor.basketItems || actor.shoppingCartItems)) {
            basket = actor;
            actor = null;
        }
        if (!basket) return false;

        const basketItems = basket.basketItems || basket.shoppingCartItems;
        if (!basketItems || basketItems.length === 0) return false;
        
        if (!actor) {
            actor = await fromUuid(basket.createdForActor);
        }
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

        const itemsToCreate = [];
        const userId = game.user.id;
        for (const basketItem of basketItems) {
            if (basketItem.isCustomBuild) {
                const buildData = basketItem.customData;
                if (buildData.type === "vehicle") {
                    await this._createVehicleActor(buildData, userId);
                } else {
                    itemsToCreate.push(buildData);
                }
            } else {
                const sourceItem = await fromUuid(basketItem.itemUuid);
                if (sourceItem) {
                    if (sourceItem.type === "vehicle") {
                        const actorData = sourceItem.toObject();
                        await this._createVehicleActor(actorData, userId);
                    } else {
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
            }
        }
        // --- DEBUG LOG: Inspect the data being passed to the creation method ---
        console.log("Marketplace | Attempting to create the following items on actor:", actor.name, itemsToCreate);
        // --- END DEBUG LOG ---

        let createdDocs = [];
        if (itemsToCreate.length > 0) {
            createdDocs = await actor.createEmbeddedDocuments("Item", itemsToCreate);
        }

        // Post order confirmation ChatMessage to the chat log
        if (game.settings.get("sr5-marketplace", "chatApprovalEnabled")) {
            try {
                const chatItems = createdDocs.map(d => ({
                    _id: d.id,
                    name: d.name,
                    uuid: d.uuid
                }));

                const statusMessages = [];
                if (userName) {
                    statusMessages.push(game.i18n.format("SR5Marketplace.Marketplace.Notifications.PurchaseApproved", { name: userName }));
                }
                statusMessages.push(game.i18n.format("SR5Marketplace.Marketplace.Notifications.DeductedResources", {
                    cost: basket.totalCost.toLocaleString(),
                    karma: basket.totalKarma,
                    actor: actor.name
                }));
                statusMessages.push(game.i18n.format("SR5Marketplace.Marketplace.Notifications.ItemsAdded", {
                    count: itemsToCreate.length,
                    actor: actor.name
                }));
                
                const confirmData = {
                    actorId: actor.id,
                    actorName: actor.name,
                    actorImg: actor.img,
                    items: chatItems,
                    totalCost: basket.totalCost,
                    totalAvailability: basket.totalAvailability,
                    totalEssenceCost: basket.totalEssenceCost,
                    totalKarmaCost: basket.totalKarma,
                    timestamp: new Date().toLocaleString(),
                    statusMessage: statusMessages
                };

                const useSmartphone = !!(game.modules.get("smartphone-widget")?.active && game.settings.get("sr5-marketplace", "sendToSmartphone"));
                const templatePath = useSmartphone && actor
                    ? "modules/sr5-marketplace/templates/chat/orderConfirmationPhone.html"
                    : "modules/sr5-marketplace/templates/chat/orderConfirmation.html";

                let html = await foundry.applications.handlebars.renderTemplate(templatePath, confirmData);
                
                if (useSmartphone && actor) {
                    const phoneApi = game.modules.get("smartphone-widget")?.api;
                    const phone = await phoneApi?.getPhoneForActor(actor.id);
                    if (phone) {
                        let senderAlias = "Marketplace";
                        let senderPhoneId = undefined;
                        if (basket?.shopActorUuid) {
                            const shopActor = await fromUuid(basket.shopActorUuid);
                            const servingEmployeeUuid = shopActor?.system?.shop?.servingEmployee;
                            const employeeActor = servingEmployeeUuid ? await fromUuid(servingEmployeeUuid) : null;
                            if (employeeActor) {
                                senderAlias = employeeActor.name;
                                const employeePhone = await phoneApi?.getPhoneForActor(employeeActor.id);
                                if (employeePhone) {
                                    senderPhoneId = employeePhone.id;
                                }
                            } else if (shopActor) {
                                senderAlias = shopActor.name;
                            }
                        }
                        const enrichedHtml = await enrichHTML(html, { async: true });
                        await phoneApi.sendSystemMessage(phone.id, enrichedHtml, { senderAlias, senderPhoneId, chat: false });
                    }
                } else {
                    await ChatMessage.create({
                        speaker: ChatMessage.getSpeaker({ actor }),
                        content: html
                    });
                }
            } catch (err) {
                console.error("SR5 Marketplace | Failed to post order confirmation:", err);
            }
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