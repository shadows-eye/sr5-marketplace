import ItemData from './itemData.js';
export default class GlobalHelper {
    constructor() {
        this.settingKey = "reviewRequests";
        this.moduleNamespace = "sr5-marketplace";
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
        const reviewRequests = await this.getReviewRequests();
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
            basketId: foundry.utils.randomID() // Assign unique basket IDs
        }));

        console.log(`Loaded purchase request ${requestId} into basketItems.`);
    }
}

//// Here the BasketHelper class is defined to save items to a global basket setting.
export class BasketHelper {
    constructor() {
        this.settingKey = "baskets";
        this.moduleNamespace = "sr5-marketplace";
        this.itemData = new ItemData();  // Instantiate ItemData to access its methods
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
     * @returns {*Array} Returns the user's basket or an empty array if not found.
     */
    async getUserBasket(userId) {
        // Get all baskets from global settings
        const baskets = await game.settings.get("sr5-marketplace", "baskets");
    
        // Return the user's basket or an empty array if not found
        return baskets[userId] || [];
    }
    /**
     * 
     * @param {*string} itemid The ID of the item to save to the global
     * @param {*object} user The ID of the user or GM to save the item for
     * @param {*object} userActor The actor assigned to the user, if available to save the item for
     * @returns 
     */
    async saveItemToGlobalBasket(itemId, user, userActor) {
        // Retrieve the current user and check if they are a GM
        const currentUserId = user.id || game.user.id; 
        const basketUser = game.users.get(currentUserId);
        const isGM = basketUser && basketUser.isGM;
        let basketUserActor = userActor || game.users.get(currentUser)?.character || currentUserId;
        let actorOrUserId;
    
        if (isGM) {
            // Check if any actor is selected on the scene
            const selectedToken = canvas.tokens.controlled[0]; // Get the first selected token on the scene

            const selectedSceneActor = selectedToken?.actor; // Access the actor from the selected token
            console.log(selectedSceneActor);
    
            if (selectedSceneActor && typeof selectedSceneActor.getUuid === "function") {
                // Use the selected actor on the scene if present and valid
                actorOrUserId =  selectedSceneActor.id;
                console.log(`Selected scene actor found: ${actorOrUserId}`);
            } else {
                // If no selected actor or assigned character, use the GM's user ID
                console.warn("GM has no actor selected; using GM's user ID for basket.");
                actorOrUserId = currentUserId;
            }
        } else {
            // For non-GM users, ensure they have an assigned character
            if (!basketUserActor) {
                ui.notifications.warn("Please assign an actor to proceed with adding items to the basket.");
                return; // Exit if the user does not have an assigned character
            }
            actorOrUserId =  basketUserActor.id;
        }
    
        // Fetch the item by ID
        const addedToBasketItem = game.items.get(itemId);
    
        // Ensure the item exists
        if (!addedToBasketItem) {
            console.warn(`Item with ID ${itemId} not found.`);
            return;
        }
    
        // Calculate the item properties using ItemData methods
        const baseRating = addedToBasketItem.system.technology?.rating || 1;
        const selectedRating = addedToBasketItem.selectedRating || baseRating;
        const buyQuantity = addedToBasketItem.buyQuantity || 1;
        const calculatedCost = await this.itemData.calculateCost(addedToBasketItem, selectedRating);
        const calculatedAvailability = await this.itemData.calculateAvailabilitySpecial(addedToBasketItem, selectedRating);
        const calculatedEssence = await this.itemData.calculateEssence(addedToBasketItem, selectedRating);
        const calculatedKarma = await this.itemData.calculatedKarmaCost(addedToBasketItem);
        let counter = 0;
        // Construct the basket item object with actor UUID if available
        const basketItem = {
            id_Item: addedToBasketItem.id,
            name: addedToBasketItem.name,
            image: addedToBasketItem.img,
            description: addedToBasketItem.system.description?.value || "",
            type: addedToBasketItem.type,
            basketId: 'basket.' + addedToBasketItem.id,
            selectedRating,
            buyQuantity,
            calculatedCost,
            calculatedAvailability,
            calculatedEssence,
            calculatedKarma,
            actorId: actorOrUserId,  // Store the determined actor ID or user ID
        };
        let globalBaskets = await this.getAllBaskets();
        // Restructure globalBaskets if it’s an array
        if (Array.isArray(globalBaskets)) {
            const structuredBaskets = {};
            for (const item of globalBaskets) {
                if (item.actorId) {
                    if (!structuredBaskets[item.actorId]) {
                        structuredBaskets[item.actorId] = [];
                    }
                    structuredBaskets[item.actorId].push(item);
                }
            }
            globalBaskets = structuredBaskets;
            console.log("Restructured globalBaskets to object format:", globalBaskets);
        }

        // Initialize the user's basket array if not created
        if (!globalBaskets[actorOrUserId]) {
            globalBaskets[actorOrUserId] = [];
        }

        // Add the item to the user’s basket array in the global settings
        globalBaskets[actorOrUserId].push(basketItem);
    
        // Update the global basket setting
        await game.settings.set(this.moduleNamespace, this.settingKey, globalBaskets);
    
        console.log(`Saved item ${addedToBasketItem.name} to global baskets for user ${currentUserId} or actor ${actorOrUserId}`, basketItem);
        console.log( 'Baskets: ' , globalBaskets);
    }
    
    // Method to remove an item from a specific user or actor's basket by basketId
    /**
     * Removes an item from the global basket by basketId and user selection.
     * @param {string} basketId - The ID of the item to be removed, provided by the delete button added with basket+ itemId.
     * @param {string} userId - The ID of the user to remove the item from.
     * @param {object} userActor - The actor object from the selected token or assigned user actor.
     */
    async removeItemFromGlobalBasket(basketId, user, userActor) {
        // Retrieve the current user and check if they are a GM
        const currentUserId = user.id || game.user.id;
        const basketUser = game.users.get(currentUserId);
        let basketUserActor = userActor || game.users.get(currentUser)?.character || currentUserId;
        const isGM = basketUser && basketUser.isGM;
        let actorOrUserId;

        if (isGM) {
            // Check if any actor is selected on the scene
            const selectedToken = canvas.tokens.controlled[0]; // Get the first selected token on the scene
            const selectedSceneActor = selectedToken?.actor // Access the actor from the selected token

            if (selectedSceneActor) {
                // Use the selected actor on the scene if present
                actorOrUserId = selectedSceneActor.id;
                console.log(`Selected scene actor found: ${actorOrUserId}`);
            } else {
                // If no selected actor or assigned character, use the GM's user ID
                console.warn("GM has no actor selected; using GM's user ID for basket.");
                actorOrUserId = currentUserId;
            }
        } else {
            // For non-GM users, ensure they have an assigned character
            if (!basketUserActor) {
                ui.notifications.warn("Please assign an actor to proceed with adding items to the basket.");
                return; // Exit if the user does not have an assigned character
            }
            actorOrUserId = basketUserActor.id;
        }

        // Fetch all baskets from global settings
        const baskets = await game.settings.get("sr5-marketplace", "baskets");

        // Access the user's basket directly by their ID
        const userBasket = baskets[actorOrUserId];

        if (!userBasket) {
            console.warn(`No basket found for actor or user ${actorOrUserId}.`);
            return;
        }

        // Filter out the item with the specified basketId
        const updatedItems = userBasket.filter(item => item.basketId !== basketId);

        if (userBasket.length === updatedItems.length) {
            console.warn(`Item with basketId ${basketId} not found in the basket for actor or user ${actorOrUserId}.`);
            return;
        }

        // Update the basket for this actor/user and save back to settings
        baskets[actorOrUserId] = updatedItems;
        await game.settings.set("sr5-marketplace", "baskets", baskets);

        console.log(`Removed item with basketId ${basketId} from the global basket for actor or user ${actorOrUserId}.`);
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
    async deleteGlobalUserBasket(actorId) {
        // Retrieve the current global baskets setting
        const baskets = await this.getAllBaskets();
    
        // Check if a basket exists for the given actorId
        if (baskets[actorId]) {
            // Clear the basket by setting it to an empty array
            baskets[actorId] = [];
    
            // Update the global basket setting with the cleared basket
            await game.settings.set(this.moduleNamespace, this.settingKey, baskets);
    
            console.log(`Cleared basket for actorId: ${actorId}`);
        } else {
            console.warn(`No basket found for actorId: ${actorId}`);
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
        let getPlayerActor = playerActor;
        console.log("Player actor data:", getPlayerActor);
        // Retrieve or initialize the global settings data
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        const currentUserId = currentUser?.id || game.user.id;
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
    
        // Structure data for template display
        const displayData = {
            selectedActorBox: selectedActorOrUserActor ? {
                actorId: selectedActorOrUserActor.id || selectedActorOrUserActor._id,
                actorName: selectedActorOrUserActor.name,
                actorImg: selectedActorOrUserActor.img,
                actorUuid: selectedActorOrUserActor.uuid
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
