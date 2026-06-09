import { MODULE_ID, FLAGKEY_Basket } from "../lib/constants.mjs";

export class BasketService {

    constructor() {
    }
    /**
     * Returns the default structure for the entire basket flag.
     */
    _getDefaultBasketState() {
        return {
            basketUUID: foundry.utils.randomID(),
            creationTime: new Date().toISOString(),
            createdForActor: null,
            selectedContactUuid: null,
            shopActorUuid: null,
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

        const savedBasket = await user.getFlag(MODULE_ID, FLAGKEY_Basket) || {};
        const basket = foundry.utils.mergeObject(this._getDefaultBasketState(), savedBasket);

        if (basket.shopActorUuid) {
            const shopActor = await fromUuid(basket.shopActorUuid);
            if (shopActor && typeof shopActor.findInventoryItem === "function") {
                let updated = false;
                for (const cartItem of basket.shoppingCartItems) {
                    const entry = shopActor.findInventoryItem(cartItem.itemUuid);
                    if (entry) {
                        const shopItem = entry[1];
                        if (cartItem.cost !== shopItem.sellPrice.value) {
                            cartItem.cost = shopItem.sellPrice.value;
                            updated = true;
                        }
                        if (cartItem.availability !== shopItem.availability.value) {
                            cartItem.availability = shopItem.availability.value;
                            updated = true;
                        }
                    }
                }
                if (updated) {
                    this._recalculateTotals(basket);
                    await this.saveBasket(basket, userId);
                }
            }
        }

        return basket;
    }

    /**
     * Saves the entire basket state back to a user's flag.
     * @param {object} basket The entire basket state object to save.
     * @param {string|null} [userId=null] The ID of the user to save the basket for.
     */
    async saveBasket(basket, userId = null) {
        const user = userId ? game.users.get(userId) : game.user;
        if (user) {
            // 'flagScope is MODULE_ID' and 'FLAGKEY_Basket' will now be correct.
            return user.setFlag(MODULE_ID, FLAGKEY_Basket, basket);
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

        // --- Shop Actor & Stock Limit Checks ---
        let shopItem = null;
        if (basket.shopActorUuid) {
            const shopActor = await fromUuid(basket.shopActorUuid);
            if (shopActor && typeof shopActor.findInventoryItem === "function") {
                const entry = shopActor.findInventoryItem(item.uuid);
                if (entry) {
                    shopItem = entry[1];
                }
            }
        }

        if (shopItem) {
            const totalInBasket = basket.shoppingCartItems
                .filter(i => i.itemUuid === item.uuid)
                .reduce((sum, i) => sum + i.buyQuantity, 0);
            if (totalInBasket + 1 > shopItem.qty) {
                ui.notifications.warn(game.i18n.format("SR5Marketplace.Marketplace.Basket.OutOfStockWarning", { name: item.name, qty: shopItem.qty }));
                return;
            }
        }

        if (behavior === 'stack' && existingItemInCart) {
            existingItemInCart.buyQuantity += 1;
        } else {
            // --- NEW KARMA LOGIC ---
            // 1. Start with the item's defined karma (if any)
            let calculatedKarma = item.system.karma || 0;
            
            // 2. If it's a spell/complex form and has 0 karma, pull from Settings
            if (item.type === "spell" && calculatedKarma === 0) {
                calculatedKarma = game.settings.get("sr5-marketplace", "karmaCostForSpell");
            } else if (item.type === "complex_form" && calculatedKarma === 0) {
                calculatedKarma = game.settings.get("sr5-marketplace", "karmaCostForComplexForm");
            }

            const isVehicle = item.type === "vehicle";
            const defaultRating = !isVehicle ? (item.system.technology?.rating || 0) : 0;
            
            let finalCost = 0;
            if (isVehicle) {
                finalCost = typeof item.system.cost === "object" ? (item.system.cost.value ?? 0) : (item.system.cost ?? 0);
            } else {
                finalCost = typeof item.system.technology?.cost === "object" ? (item.system.technology?.cost.value ?? 0) : (item.system.technology?.cost ?? 0);
            }

            let finalAvailability = "0";
            if (isVehicle) {
                finalAvailability = typeof item.system.availability === "object" ? (item.system.availability.value ?? "0") : (item.system.availability ?? "0");
            } else {
                finalAvailability = typeof item.system.technology?.availability === "object" ? (item.system.technology?.availability.value ?? "0") : (item.system.technology?.availability ?? "0");
            }

            let finalEssence = !isVehicle ? (item.system.essence || 0) : 0;

            if (defaultRating > 0) {
                try {
                    const cloned = item.clone({ "system.technology.rating": defaultRating }, { keepId: true });
                    finalCost = cloned.system.technology?.cost ?? finalCost;
                    finalAvailability = cloned.system.technology?.availability ?? finalAvailability;
                    finalEssence = cloned.system.essence ?? finalEssence;
                } catch (err) {
                    console.warn("SR5 Marketplace | Failed to clone item for dynamic calculation on add:", err);
                }
            }

            if (shopItem) {
                finalCost = shopItem.sellPrice.value;
            }

            const basketItem = {
                basketItemUuid: "basket." + foundry.utils.randomID(),
                itemUuid: item.uuid,
                buyQuantity: 1,
                name: item.name, 
                img: item.img, 
                cost: finalCost,
                karma: calculatedKarma, 
                availability: finalAvailability,
                essence: finalEssence, 
                itemQuantity: behavior === 'stack' ? 10 : (item.system.quantity || 1),
                rating: defaultRating, 
                selectedRating: defaultRating,
            };
            basket.shoppingCartItems.push(basketItem);
        }
        
        const updatedBasket = this._recalculateTotals(basket);
        await this.saveBasket(updatedBasket);
        //ui.notifications.info(`'${item.name}' added to basket.`);
    }

    /**
     * Adds a compiled custom build to the active shopping cart.
     * @param {object} customData - The compiled item/actor build data.
     * @param {string} actorUuid - The UUID of the actor this basket is for.
     * @param {object} totals - Pre-calculated totals (cost, availability, essence).
     */
    async addCustomToBasket(customData, actorUuid, totals) {
        if (!customData || !actorUuid) {
            ui.notifications.error("Cannot add custom build to cart without a purchasing actor.");
            return;
        }

        const basket = await this.getBasket();
        basket.createdForActor = actorUuid;

        const isVehicle = customData.type === "vehicle";
        const defaultRating = !isVehicle ? (customData.system.technology?.rating || 0) : 0;

        const basketItem = {
            basketItemUuid: "basket." + foundry.utils.randomID(),
            itemUuid: customData.uuid || ("custom." + foundry.utils.randomID()),
            buyQuantity: 1,
            name: customData.name, 
            img: customData.img || "icons/svg/item-bag.svg", 
            cost: totals.cost,
            karma: 0, 
            availability: totals.availability,
            essence: totals.essence, 
            itemQuantity: 1,
            rating: defaultRating, 
            selectedRating: defaultRating,
            isCustomBuild: true,
            customData: customData
        };

        basket.shoppingCartItems.push(basketItem);

        const updatedBasket = this._recalculateTotals(basket);
        await this.saveBasket(updatedBasket);
        ui.notifications.info(`Custom build "${customData.name}" added to cart.`);
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

        // --- Shop Actor & Stock Limit Checks on Increase ---
        if (change > 0 && basket.shopActorUuid) {
            const shopActor = await fromUuid(basket.shopActorUuid);
            if (shopActor && typeof shopActor.findInventoryItem === "function") {
                const entry = shopActor.findInventoryItem(targetItem.itemUuid);
                if (entry) {
                    const shopItem = entry[1];
                    const totalInBasket = basket.shoppingCartItems
                        .filter(i => i.itemUuid === targetItem.itemUuid)
                        .reduce((sum, i) => sum + i.buyQuantity, 0);
                    if (totalInBasket + change > shopItem.qty) {
                        ui.notifications.warn(game.i18n.format("SR5Marketplace.Marketplace.Basket.OutOfStockWarning", { name: targetItem.name, qty: shopItem.qty }));
                        return;
                    }
                }
            }
        }

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

    /**
     * Updates a property on an item in the active shopping cart and recalculates.
     * @param {string} basketItemUuid The unique instance ID of the item.
     * @param {string} property The property name to update.
     * @param {*} value The new value for the property.
     */
    async updateItemProperty(basketItemUuid, property, value) {
        if (!basketItemUuid || !property) return;

        const basket = await this.getBasket();
        const targetItem = basket.shoppingCartItems.find(i => i.basketItemUuid === basketItemUuid);
        if (!targetItem) return;

        targetItem[property] = value;

        if (property === "selectedRating") {
            const sourceItem = await fromUuid(targetItem.itemUuid);
            if (sourceItem) {
                try {
                    let shopItem = null;
                    if (basket.shopActorUuid) {
                        const shopActor = await fromUuid(basket.shopActorUuid);
                        if (shopActor && typeof shopActor.findInventoryItem === "function") {
                            const entry = shopActor.findInventoryItem(targetItem.itemUuid);
                            if (entry) {
                                shopItem = entry[1];
                            }
                        }
                    }

                    const cloned = sourceItem.clone({ "system.technology.rating": value }, { keepId: true });
                    targetItem.cost = shopItem ? shopItem.sellPrice.value : (cloned.system.technology?.cost ?? targetItem.cost);
                    targetItem.availability = cloned.system.technology?.availability ?? targetItem.availability;
                    targetItem.essence = cloned.system.essence ?? targetItem.essence;
                } catch (err) {
                    console.warn("SR5 Marketplace | Failed to clone item for dynamic calculation on update:", err);
                }
            }
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

    /**
     * Updates the selected contact in the user's basket.
     * @param {string} contactUuid The UUID of the contact item to select.
     */
    async setSelectedContact(contactUuid) {
        const basket = await this.getBasket();
        basket.selectedContactUuid = contactUuid;
        // No need to recalculate totals, just save the change.
        await this.saveBasket(basket);
    }

    /**
     * Updates the shop actor associated with the user's basket.
     * This is typically the owner of the shop or the actor linked to a contact.
     * @param {string} actorUuid The UUID of the shop actor.
     */
    async setShopActor(actorUuid) {
        const basket = await this.getBasket();
        basket.shopActorUuid = actorUuid;
        await this.saveBasket(basket);
    }

    /**
     * Clears the current user's basket by resetting it to the default state.
     * @param {string|null} [userId=null] The ID of the user to clear the basket for.
     */
    async clearBasket(userId = null) {
        const defaultBasket = this._getDefaultBasketState();
        await this.saveBasket(defaultBasket, userId);
    }
}