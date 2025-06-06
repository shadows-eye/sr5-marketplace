import ItemDataServices from './ItemDataServices.mjs';
export default class GlobalHelper {
    constructor() {
        this.settingKey = "reviewRequests";
        this.moduleNamespace = "sr5-marketplace";
        this.itemData = new ItemDataServices();
    }

    // Initialize the global setting if not already set
    async initializeGlobalSetting(socket = null) {
        // Check if the call is being made via socketlib
        if (!socket && !game.user.isGM) {
            // Only GM can initialize this setting
            return ui.notifications.warn("Only a GM can initialize global settings.");
        }
        
        const existingData = await game.settings.get(this.moduleNamespace, this.settingKey);
        if (!existingData || typeof existingData !== 'object') {
            await game.settings.set(this.moduleNamespace, this.settingKey, {});
            console.log("GlobalHelper loaded successfully");
        }
    }

    // Retrieve all review requests, with socketlib support and optional GM permission
    async getReviewRequests() {
        // Fetch review requests from settings directly
        return await game.settings.get(this.moduleNamespace, this.settingKey) || {};
    }
    // Retrieve a specific review request by ID
    async getReviewRequest(requestId) {
        // Only GM can retrieve specific review requests if called remotely, but use player's userId for context
        if (!game.user.isGM && !userId) {
            return ui.notifications.warn("Only a GM can access specific review requests.");
        }

        // If userId is provided, we retrieve data for that specific user's request
        const reviewRequests = await this.getReviewRequests();
        return reviewRequests[requestId] || null;
    }


    // Add or update a review request
    async addOrUpdateReviewRequest(requestId, requestData) {
        let reviewRequests = await this.getReviewRequests();
        reviewRequests[requestId] = requestData;
        await game.settings.set(this.moduleNamespace, this.settingKey, reviewRequests);
    }

    /**
     * Save the current basket items as a purchase request in hidden settings.
     * @param {String} requestId - Unique ID for the purchase request.
     */
    async savePurchaseRequest(requestId) {
        const purchaseData = {
            flagId: requestId,
            items: this.basketItems.map(item => ({
                id: item.id_Item,
                name: item.name,
                buyQuantity: item.buyQuantity,
                type: item.type,
                description: item.description,
                selectedRating: item.selectedRating,
                calculatedCost: item.calculatedCost,
                calculatedAvailability: item.calculatedAvailability,
                calculatedEssence: item.calculatedEssence,
                calculatedKarma: item.calculatedKarma
            })),
            totalCost: this.calculateTotalCost(),
            totalAvailability: this.calculateTotalAvailability(),
            totalEssenceCost: this.calculateTotalEssenceCost(),
            totalKarmaCost: await this.calculateTotalKarmaCost()
            };
    
            // Use GlobalHelper to save purchase data
            await this.globalHelper.addOrUpdateReviewRequest(requestId, purchaseData);
            console.log(`Purchase request ${requestId} saved successfully!`);
    }
       
    // Delete a specific review request
    async deleteReviewRequest(requestId) {
        // Retrieve the current reviewRequests data from settings
        let reviewRequests = await this.getReviewRequests();
        
        // Use Object.entries to filter out the requestId and reconstruct the object
        let updatedReviewRequests = Object.fromEntries(
            Object.entries(reviewRequests).filter(([key]) => key !== requestId)
        );
    
        // Save the updated reviewRequests object back to settings
        await game.settings.set(this.moduleNamespace, this.settingKey, updatedReviewRequests);
    }

    // Clear all review requests
    async clearAllReviewRequests() {
        await game.settings.set(this.moduleNamespace, this.settingKey, {});
    }

    /**
     * Load a saved purchase request and populate basketItems or orderReviewItems.
     * @param {String} requestId - The ID of the purchase request to load.
     */
    async loadPurchaseRequest(requestId) {
        const requestData = await this.globalHelper.getReviewRequest(requestId);

        if (!requestData) {
            console.warn(`Purchase request with ID ${requestId} not found.`);
            return;
        }

        // Populate basketItems with loaded data
        this.basketItems = requestData.items.map(item => ({
            ...item,
            basketId: basketId || null // Assign unique basket IDs
        }));

        console.log(`Loaded purchase request ${requestId} into basketItems.`);
    }
}

//// Here the BasketHelper class is defined to save items to a global basket setting.
export class BasketHelper {
    constructor() {
        this.settingKey = "baskets";
        this.moduleNamespace = "sr5-marketplace";
        this.itemData = new ItemDataServices();  // Instantiate ItemData to access its methods
    }

    async initializeBasketsSetting() {
        const existingData = game.settings.get(this.moduleNamespace, this.settingKey);
        if (!existingData || typeof existingData !== 'object') {
            await game.settings.set(this.moduleNamespace, this.settingKey, {});
        }
    }
    /**
     * This method retrieves the basket for a specific User or Actor.
     * @param {*string} userId User ID to retrieve the basket for
     * @returns {*Object} Returns the user's basket items and aggregated totals.
     */
    async getUserBasket(userId) {
        const baskets = await game.settings.get("sr5-marketplace", "baskets");
        const userBasket = baskets[userId] || [];

        // Helper function to calculate availability for a single item
        let calculateItemAvailability = async (basketItem) => {
            const item = await fromUuid(basketItem.uuid);
            if (!item) return { numeric: 0, priority: 0 };

            const priorityMapping = { "": 0, "E": 1, "R": 2, "F": 3, "V": 3 }; // Define priority levels
            const rating = basketItem.selectedRating || 1;
            const baseAvailability = parseInt(item.system.technology?.availability) || 0;

            // Extract and normalize the text part
            let textPart = item.system.technology?.availability?.replace(/^\d+/, '').trim() || "";
            const normalizedText = textPart.toUpperCase();
            const priority = priorityMapping[normalizedText] || 0;

            return { numeric: baseAvailability * rating, priority };
        };

        // Process basket items and fetch full item data
        const itemsWithFullData = await Promise.all(userBasket.map(async (basketItem) => {
            const item = await fromUuid(basketItem.uuid);
            if (!item) return null;
            return { ...basketItem, fullItemData: item };
        }));

        // Filter out invalid items
        let validItems = itemsWithFullData.filter((item) => item !== null);

        // Aggregate totals
        let totalNumeric = 0;
        let highestPriority = 0;

        for (const basketItem of validItems) {
            const { numeric, priority } = await calculateItemAvailability(basketItem);
            totalNumeric += numeric;
            if (priority > highestPriority) highestPriority = priority;
        }

        const reverseMapping = { 0: "", 1: "E", 2: "R", 3: "F" };
        const rawTextPart = reverseMapping[highestPriority] || "";
        const textPartLocalized = rawTextPart 
            ? game.i18n.localize(`SR5.Marketplace.system.avail.${rawTextPart}`) 
            : "";

        const totals = {
            totalCost: validItems.reduce((sum, item) => sum + (item.calculatedCost * item.buyQuantity), 0),
            totalAvailability: `${totalNumeric}${textPartLocalized}`.trim(),
            totalKarma: validItems.reduce((sum, item) => sum + item.calculatedKarma, 0),
            totalEssenceCost: validItems.reduce((sum, item) => sum + item.calculatedEssence, 0),
        };

        return { items: validItems, totals };
    }

    /**
     * Save an item to the global basket using UUIDs.
     * @param {string} itemUuid - The UUID of the item to save.
     * @param {object} user - The user adding the item to the basket.
     */
    async saveItemToGlobalBasket(itemUuid, userId, basketActor) {
        const currentUserId = userId;
        const basketaktor = basketActor;

        let actorUuid = null;

        // Determine the actor UUID based on GM or player
        if (!basketaktor) {
            const selectedToken = canvas.tokens.controlled[0]; // Get the first selected token
            actorUuid = selectedToken?.actor?.uuid || null; // Use selected token's actor UUID, or null if no token is selected
        } else {
            actorUuid = basketaktor.uuid // For players, use their assigned character's UUID
        }

        // Retrieve or initialize the global baskets
        const baskets = await game.settings.get(this.moduleNamespace, this.settingKey);
        if (!baskets[currentUserId]) {
            baskets[currentUserId] = [];
        }
        const userBasket = baskets[currentUserId];

        // Fetch the item from the UUID
        const addedToBasketItem = await fromUuid(itemUuid);
        if (!addedToBasketItem) {
            console.warn(`Item with UUID ${itemUuid} not found.`);
            return;
        }

        // Define item type behaviors
        const uniqueTypes = ["bioware", "cyberware", "spell", "action", "quality", "complex_form", "ritual"];
        const multiIdTypes = ["weapon", "armor"];
        const quantityTypes = ["ammo", "equipment", "modification", "device", "lifestyle", "program", "sin"];

        // Check for existing item in the basket
        const existingItem = userBasket.find(item => item.uuid === itemUuid);

        // Calculate necessary values
        const baseRating = addedToBasketItem.system.technology?.rating || 1;
        const selectedRating = addedToBasketItem.selectedRating || baseRating;
        const buyQuantity = 1;
        const calculatedCost = await this.itemData.calculateCost(addedToBasketItem, selectedRating);
        const calculatedAvailability = await this.itemData.calculateAvailabilitySpecial(addedToBasketItem, selectedRating);
        const calculatedEssence = await this.itemData.calculateEssence(addedToBasketItem, selectedRating);
        const calculatedKarma = await this.itemData.calculatedKarmaCost(addedToBasketItem);

        // Handle unique, multiId, and quantity types
        if (uniqueTypes.includes(addedToBasketItem.type)) {
            if (existingItem) {
                ui.notifications.warn(`Only one instance of ${addedToBasketItem.name} is allowed in the basket.`);
                return;
            }
        }

        if (quantityTypes.includes(addedToBasketItem.type) && existingItem) {
            // Increment quantity for existing item
            existingItem.buyQuantity += 1;
            existingItem.calculatedCost += calculatedCost;
        } else {
            // Add new item to the basket
            const basketItem = {
                uuid: itemUuid,
                name: addedToBasketItem.name,
                image: addedToBasketItem.img,
                description: addedToBasketItem.system.description?.value || "",
                type: addedToBasketItem.type,
                basketId: foundry.utils.randomID(),
                selectedRating,
                buyQuantity,
                calculatedCost,
                calculatedAvailability,
                calculatedEssence,
                calculatedKarma,
                actorUuid: actorUuid, // Save the actor UUID if available
                userId: currentUserId, // Save the user ID
            };

            userBasket.push(basketItem);
        }

        // Save the updated basket back to settings
        baskets[currentUserId] = userBasket;
        await game.settings.set(this.moduleNamespace, this.settingKey, baskets);

        console.log(`Updated basket for user ${currentUserId}`, userBasket);
    }

    async updateBasketItemRating(basketId, newRating, userId) {
        const baskets = await game.settings.get("sr5-marketplace", "baskets");
        const userBasket = baskets[userId];
    
        const basketItem = userBasket?.find(item => item.basketId === basketId);
        if (basketItem) {
            basketItem.selectedRating = newRating;
    
            // Recalculate properties
            const item = await fromUuid(basketItem.uuid);
            basketItem.calculatedCost = await this.itemData.calculateCost(item, newRating);
            basketItem.calculatedAvailability = this.calculateAvailability(item, newRating);
            basketItem.calculatedEssence = await this.itemData.calculateEssence(item, newRating);
            basketItem.calculatedKarma = await this.itemData.calculatedKarmaCost(item);
    
            // Save updated basket
            await game.settings.set("sr5-marketplace", "baskets", baskets);
            console.log(`Updated rating for basket item: ${basketId}`);
        }
    }

    /**
     * Removes an item from the global basket by basketId and user selection.
     * @param {string} basketId - The ID of the item to be removed, prefixed with "basket.".
     * @param {object} user - The user object performing the action.
     * @param {object} userActor - The actor object assigned to the user or selected token, if applicable.
     */
    async removeItemFromGlobalBasket(basketId, userId, userActor) {
        const currentUserId = userId;
        const basketaktor = userActor;

        // Retrieve baskets from settings
        const baskets = await game.settings.get("sr5-marketplace", "baskets");

        // Access the basket for the determined user/actor ID
        const userBasket = baskets[currentUserId];
        if (!userBasket) {
            console.warn(`No basket found for actor/user ID: ${currentUserId}`);
            return;
        }

        // Filter out the item by basketId
        const updatedItems = userBasket.filter(item => item.basketId !== basketId);

        // If no items were removed, log a warning
        if (userBasket.length === updatedItems.length) {
            console.warn(`Item with basketId ${basketId} not found in basket for actor/user ID: ${currentUserId}`);
            return;
        }

        // Save the updated basket back to settings
        baskets[currentUserId] = updatedItems;
        await game.settings.set("sr5-marketplace", "baskets", baskets);

        console.log(`Successfully removed item with basketId ${basketId} for actor/user ID: ${currentUserId}`);
    }
    /**
     * Decrease the quantity of an item in the global basket by 1.
     * If the quantity reaches zero, remove the item entirely.
     *
     * @param {string} basketId - The BasketId of the item to decrease the quantity of.
     * @param {string} userId - The userId of the user to decrease the quantity for in the global baskets.
     * @param {object} userActor - The actor object from the selected token or assigned user actor.
     */
    async decreaseItemQuantityInGlobalBasket(basketId, userId, userActor) {
        const currentUser = userId;
        const basketUser = game.users.get(currentUser);
        const isGM = basketUser && basketUser.isGM;
        let actorOrUserId;

        if (isGM) {
            // Check if any actor is selected on the scene
            const selectedToken = canvas.tokens.controlled[0]; // Get the first selected token on the scene
            const selectedSceneActor = selectedToken?.actor; // Access the actor from the selected token

            if (selectedSceneActor) {
                actorOrUserId = selectedSceneActor.id;
                console.log(`Selected scene actor found: ${actorOrUserId}`);
            } else if (userActor) {
                actorOrUserId = userActor.id;
                console.log(`Using GM's assigned actor: ${actorOrUserId}`);
            } else {
                console.warn("GM has no actor selected; using GM's user ID for basket.");
                actorOrUserId = currentUser;
            }
        } else {
            if (!userActor) {
                ui.notifications.warn("Please assign an actor to proceed with adding items to the basket.");
                return; // Exit if the user does not have an assigned character
            }
            actorOrUserId = userActor.id;
        }

        // Fetch the user's basket
        const allBaskets = await game.settings.get("sr5-marketplace", "baskets");
        let userBasket = allBaskets[actorOrUserId];

        if (!userBasket) {
            console.warn(`No basket found for actor or user ${actorOrUserId}.`);
            return;
        }

        // Find the basket item by basketId
        const basketItem = userBasket.find(item => item.basketId === basketId);
        if (!basketItem) {
            console.warn(`Item with basketId ${basketId} not found in user's basket.`);
            return;
        }

        // Decrease buyQuantity
        basketItem.buyQuantity -= 1;
        if (basketItem.buyQuantity <= 0) {
            // Remove the item entirely if quantity is zero
            userBasket = userBasket.filter(item => item.basketId !== basketId);
            console.log(`Removed item with basketId ${basketId} as quantity reached zero.`);
        }

        // Update the global settings with the modified basket
        allBaskets[actorOrUserId] = userBasket;
        await game.settings.set("sr5-marketplace", "baskets", allBaskets);
        console.log(`Decreased quantity of item with basketId ${basketId} for actor/user ${actorOrUserId}.`);
    }   
    /**
     * 
     * @param {*string} actorId the ID of the actor to clear the basket for
     */
    async deleteGlobalUserBasket(userId) {
        // Retrieve the current global baskets setting
        const baskets = await this.getAllBaskets();
    
        // Check if a basket exists for the given actorId
        if (baskets[userId]) {
            // Clear the basket by setting it to an empty array
            baskets[userId] = [];
    
            // Update the global basket setting with the cleared basket
            await game.settings.set(this.moduleNamespace, this.settingKey, baskets);
    
            console.log(`Cleared basket for actorId: ${userId}`);
        } else {
            console.warn(`No basket found for actorId: ${userId}`);
        }
    }
    
    async getAllBaskets() {
        return game.settings.get(this.moduleNamespace, this.settingKey) || {};
    }
}
export class MarketplaceHelper {
    constructor() {
        this.settingKey = "purchase-screen-app";
        this.moduleNamespace = "sr5-marketplace";
    }

    // Initialize the setting to include user-specific data if not already set
    async initializePurchaseScreenSetting(userId) {
        let existingData = await game.settings.get(this.moduleNamespace, this.settingKey);
        
        // Structure with all necessary properties, ensuring consistency
        const defaultData = {
            connectionItem: null,
            hasShopActor: false,
            globalShopActor: {
                shopId: null,
                shopName: null,
                shopImg: null,
                shopUuid: null,
                shopActorItems: []
            },
            users: {
                [userId]: {
                    selectedActorOrUserActor: null,
                    connectionItem: null
                }
            }
        };
        
        // Merge existing data with defaults, ensuring missing properties are set
        const mergedData = foundry.utils.mergeObject(defaultData, existingData);
        
        // Save initialized data back to settings
        await game.settings.set(this.moduleNamespace, this.settingKey, mergedData);
    }
    /**
     * 
     * @returns {boolean} Returns true if the global shop actor exists, false otherwise.
     */
    async getHasShopActor() {
        const settingsData = await game.settings.get(this.moduleNamespace, this.settingKey);
        return settingsData.hasShopActor || false;
    }

    /**
     * 
     * @returns {Object} Returns the global shop actor data from settings.
     */
    async getGlobalShopActorData() {
        const settingsData = await game.settings.get(this.moduleNamespace, this.settingKey);
        return settingsData.globalShopActor || null;
    }

    /**
     * Retrieves Purchase Screen data for the current user.
     * @param {Object} currentUser - The current user.
     * @param {Object} playerActor - Actor assigned to the current user (if any).
     * @param {Object} selectedActor - Actor selected on the screen (if any).
     * @returns {Object} Processed data for the template display.
     */
    async getPurchaseScreenData(currentUser,playerActor, selectedActor) {
        console.log("Retrieving purchase screen data for user:", currentUser);
        // Retrieve or initialize the global settings data
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        const currentUserId = currentUser?.id || game.user.id;
        let getPlayerActor = playerActor || game.users.get(currentUserId).character;
        console.log("Current user ID:", currentUserId);
        console.log("Current user data from settings:", allData.users?.[currentUserId]);
    
        // Prepare global shop actor data for display
        const globalShopActor = allData.globalShopActor || { items: [] };
        const shopActorBox = globalShopActor?.shopId ? {
            shopId: globalShopActor.shopId,
            shopName: globalShopActor.shopName,
            shopImg: globalShopActor.shopImg,
            shopUuid: globalShopActor.shopUuid,
            //shopActorItems: globalShopActor.items
        } : null;
    
        // Ensure user-specific data structure exists in settings
        if (!allData.users) allData.users = {};
        if (!allData.users[currentUserId]) {
            allData.users[currentUserId] = {
                selectedActorOrUserActor: null,
                connectionItem: null
            };
        }
        const userData = allData.users[currentUserId];
    
        // Determine selected actor based on user role (GM vs. Player)
        let selectedActorOrUserActor;
        if (currentUser.isGM) {
            // For GM: Use selected token on the canvas if available; otherwise, leave null
            selectedActorOrUserActor = selectedActor || null;
        } else {
            // For Players: Always use playerActor
            selectedActorOrUserActor = getPlayerActor;
            console.log("Player actor data:", selectedActorOrUserActor);
        }
        if (!selectedActorOrUserActor) {
            selectedActorOrUserActor = getPlayerActor;
        }
        // Structure data for template display
        const displayData = {
            selectedActorBox: selectedActorOrUserActor ? {
                actorId: selectedActorOrUserActor.id || selectedActorOrUserActor._id,
                actorName: selectedActorOrUserActor.name,
                actorImg: selectedActorOrUserActor.img,
                actorUuid: selectedActorOrUserActor.uuid || 'Actor.'+selectedActorOrUserActor._id
            } : null,
            shopActorBox: shopActorBox,
            connectionBox: userData.connectionItem ? {
                connectionId: userData.connectionItem.id,
                connectionName: userData.connectionItem.name,
                connectionImg: userData.connectionItem.img,
                connectionUuid: userData.connectionItem.uuid
            } : null,
            hasShopActor: !!globalShopActor.shopId
        };
    
        // Update selected actor for the current user in settings
        await this.setSelectedActor(currentUser, displayData.selectedActorBox);
    
        return displayData;
    }    

    // Set selected actor for the current user
    async setSelectedActor(currentUser, actorData) {
        const allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
    
        // Ensure user-specific data structure exists in settings
        const userId = currentUser.id || game.user.id;
        if (!allData.users) allData.users = {};
        if (!allData.users[userId]) {
            allData.users[userId] = {
                selectedActorOrUserActor: null,
                connectionItem: null
            };
        }
    
        // Assign selected actor based on user type
        allData.users[userId].selectedActorOrUserActor = actorData || null;
    
        // Save updated settings
        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }
    // Set shop actor globally
    async setShopActor(shopActorData) {
        let shoptest = shopActorData;
        console.log('Shop actor data:', shoptest);
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
    
        // Update global shop actor data and set hasShopActor to true
        allData.globalShopActor = {
            shopId: shopActorData.id,
            shopName: shopActorData.name,
            shopImg: shopActorData.img,
            shopUuid: shopActorData.uuid,
            shopActorItems: shopActorData.items || [] // Ensures shopItems is always an array
        };
        allData.hasShopActor = true;
    
        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }

    // Set connection item for the current user
    async setConnectionItem(currentUser, connectionItemData) {
        // Retrieve existing data or initialize it if undefined
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
    
        // Ensure `users` object and current user's structure exist
        allData.users = allData.users || {};
        const currentUserId = currentUser.id || game.user.id;
        allData.users[currentUserId] = allData.users[currentUserId] || {
            selectedActorOrUserActor: null,
            connectionItem: null
        };
    
        // Update the connection item for the specified user
        allData.users[currentUserId].connectionItem = connectionItemData;
    
        // Save updated data back to the game settings
        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }

    // Clear the Purchase Screen data for the current user
    async clearPurchaseScreenData(currentUserId) {
        const clearCurrentUserId = currentUserId;
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey);

        // Reset only the current user's data
        allData[clearCurrentUserId] = {
            
            connectionItem: null,
            hasShopActor: false
        };

        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }

    // Remove the global shop actor (GM only)
    async removeShopActor() {
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};

        // Clear global shop actor data
        allData.globalShopActor = {};
        allData.hasShopActor = false;
        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }

    // Remove the selected actor for a specific user
    async removeSelectedActor(currentUser, actorId) {
        // Retrieve all data from settings or initialize if it doesn’t exist
        const allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        allData.users = allData.users || {};
    
        // Get the current user's ID
        const removeUserId = currentUser.id;
    
        // Check if the user's data exists and matches the actorId
        if (allData.users[removeUserId] && allData.users[removeUserId].selectedActorOrUserActor.id === actorId) {
            // Deselect any tokens that belong to this actor to prevent re-selection
            canvas.tokens.placeables
                .filter(token => token.actor?.id === actorId)
                .forEach(token => token.control({ releaseOthers: true }));
            
            // Set selectedActorOrUserActor to null to "remove" the actor
            allData.users[removeUserId].selectedActorOrUserActor = null;
    
            // Save the updated settings back to Foundry
            await game.settings.set(this.moduleNamespace, this.settingKey, allData);
            
            console.log(`Actor with ID ${actorId} has been removed for user ${removeUserId}.`);
        } else {
            console.warn(`No matching actor with ID ${actorId} found for user ${removeUserId}.`);
        }
    }

    // Remove the connection item for a specific user
    async removeConnectionItem(currentUser, connectionItemId) {
        let removeConnectionUserId = currentUser.id;
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        allData.users = allData.users || {};

        // Check if the user exists in settings and clear the connection item
        if (allData.users[removeConnectionUserId]) {
            allData.users[removeConnectionUserId].connectionItem = null;
        }

        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }
}
