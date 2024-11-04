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
        const reviewRequests = await this.getReviewRequests();
        delete reviewRequests[requestId];
        await game.settings.set(this.moduleNamespace, this.settingKey, reviewRequests);
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
     * 
     * @param {*string} itemId The ID of the item to save to the global
     * @param {*string} userId The ID of the user or GM to save the item for
     * @param {*object} userActor The actor assigned to the user, if available to save the item for
     * @returns 
     */
    async saveItemToGlobalBasket(itemId, userId, userActor) {
        // Retrieve the current user and check if they are a GM
        const currentUser = userId;
        const basketUser = game.users.get(currentUser);
        const isGM = basketUser && basketUser.isGM;
        let basketUserActor = userActor;
        let actorOrUserId;
    
        if (isGM) {
            // Check if any actor is selected on the scene
            const selectedToken = canvas.tokens.controlled[0]; // Get the first selected token on the scene

            const selectedSceneActor = selectedToken?.actor; // Access the actor from the selected token
            console.log(selectedSceneActor);
    
            if (selectedSceneActor && typeof selectedSceneActor.getUuid === "function") {
                // Use the selected actor on the scene if present and valid
                actorOrUserId = await selectedSceneActor.id;
                console.log(`Selected scene actor found: ${actorOrUserId}`);
            } else if (basketUserActor) {
                // Fallback to the GM's assigned character if no scene actor is selected
                actorOrUserId = await basketUserActor.id;
                console.log(`Using GM's assigned actor: ${actorOrUserId}`);
            } else {
                // If no selected actor or assigned character, use the GM's user ID
                console.warn("GM has no actor selected; using GM's user ID for basket.");
                actorOrUserId = currentUser;
            }
        } else {
            // For non-GM users, ensure they have an assigned character
            if (!basketUserActor) {
                ui.notifications.warn("Please assign an actor to proceed with adding items to the basket.");
                return; // Exit if the user does not have an assigned character
            }
            actorOrUserId = await basketUserActor.id;
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
        const calculatedCost = await this.itemData.calculateCost(addedToBasketItem, selectedRating);
        const calculatedAvailability = await this.itemData.calculateAvailability(addedToBasketItem, selectedRating);
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
    
        console.log(`Saved item ${addedToBasketItem.name} to global baskets for user ${userId} or actor ${actorOrUserId}`, basketItem);
        console.log( 'Baskets: ' , globalBaskets);
    }
    
    // Method to remove an item from a specific user or actor's basket by basketId
    /**
     * Removes an item from the global basket by basketId and user selection.
     * @param {string} basketId - The ID of the item to be removed, provided by the delete button.
     * @param {string} userId - The ID of the user to remove the item from.
     * @param {object} userActor - The actor object from the selected token or assigned user actor.
     */
    async removeItemFromGlobalBasket(basketId, userId, userActor) {
        // Retrieve the current user and check if they are a GM
        const currentUser = userId;
        const basketUser = game.users.get(currentUser);
        const isGM = basketUser && basketUser.isGM;
        let actorOrUserId;

        if (isGM) {
            // Check if any actor is selected on the scene
            const selectedToken = canvas.tokens.controlled[0]; // Get the first selected token on the scene
            const selectedSceneActor = selectedToken?.actor; // Access the actor from the selected token

            if (selectedSceneActor) {
                // Use the selected actor on the scene if present
                actorOrUserId = selectedSceneActor.id;
                console.log(`Selected scene actor found: ${actorOrUserId}`);
            } else if (userActor) {
                // Fallback to the GM's assigned character if no scene actor is selected
                actorOrUserId = userActor.id;
                console.log(`Using GM's assigned actor: ${actorOrUserId}`);
            } else {
                // If no selected actor or assigned character, use the GM's user ID
                console.warn("GM has no actor selected; using GM's user ID for basket.");
                actorOrUserId = currentUser;
            }
        } else {
            // For non-GM users, ensure they have an assigned character
            if (!userActor) {
                ui.notifications.warn("Please assign an actor to proceed with adding items to the basket.");
                return; // Exit if the user does not have an assigned character
            }
            actorOrUserId = userActor.id;
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
    async initializePurchaseScreenSetting() {
        const existingData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        const currentUserId = game.user.id || null;
    
        // Check for and initialize global settings if they are missing
        if (!existingData.globalShopActor) {
            existingData.globalShopActor = {
                id: null,
                name: null,
                img: null,
                uuid: null,
                items: [] // Initialize with an empty items array
            };
        }
    
        // Ensure user-specific data structure exists, if not initialize it
        if (!existingData.users) {
            existingData.users = {};
        }
    
        // Check if the current user's settings exist; initialize if missing
        if (!existingData.users[currentUserId]) {
            existingData.users[currentUserId] = {
                selectedActorOrUserActor: null,
                connectionItem: null
            };
        }
    
        // Save the updated structure back to settings if any modifications were made
        await game.settings.set(this.moduleNamespace, this.settingKey, existingData);
    }

    /**
     * Retrieves Purchase Screen data for the current user.
     * @param {Object} currentUser - The current user.
     * @param {Object} selectedActor - Actor selected on the screen.
     * @returns {Object} Processed data for the template display.
     */
    async getPurchaseScreenData(currentUser, selectedActor) {
        const allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        const currentUserId = currentUser?.id || null;

        // Retrieve global shop actor data for display
        const globalShopActor = allData.globalShopActor || { items: [] };
        const shopActorBox = globalShopActor?.id ? {
            id: globalShopActor.id,
            name: globalShopActor.name,
            img: globalShopActor.img,
            uuid: globalShopActor.uuid
        } : null;

        // Retrieve user-specific data for current user, defaulting to null if not available
        const userData = allData.users?.[currentUserId] || { selectedActorOrUserActor: null, connectionItem: null };

        // Determine which actor to display based on user type
        const selectedActorOrUserActor = currentUser.isGM ? selectedActor : currentUser.character;

        // Structure data for template rendering
        const displayData = {
            selectedActorBox: selectedActorOrUserActor ? {
                id: selectedActorOrUserActor.id,
                name: selectedActorOrUserActor.name,
                img: selectedActorOrUserActor.img
            } : null,
            shopActorBox: shopActorBox,
            connectionBox: userData.connectionItem ? {
                id: userData.connectionItem.id,
                name: userData.connectionItem.name,
                img: userData.connectionItem.img
            } : null,
            hasShopActor: !!globalShopActor.id
        };

        // Save the selected actor for the user if needed
        if (currentUserId) {
            await this.setSelectedActor(currentUserId, displayData.selectedActorBox);
        }

        return displayData;
    }
    // Set selected actor for the current user
    async setSelectedActor(currentUser, actorData) {
        const allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        // Initialize users object if not existing
        allData.users = allData.users || {};
        let setSelectCurrentUderId = currentUser.id;
        let setActorSelectedActorUserId = currentUser.id;
        let selectedActorOrUserActor = currentUser.isGM ? actorData : currentUser.character;
        allData.users[setSelectCurrentUderId] = {
            ...allData.users[setSelectCurrentUderId],
            selectedActorOrUserActor: selectedActorOrUserActor
        };
    
        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }
    // Set shop actor globally
    async setShopActor(shopActorData) {
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
    
        // Update global shop actor data
        allData.globalShopActor = {
            id: shopActorData.id,
            name: shopActorData.name,
            img: shopActorData.img,
            uuid: shopActorData.uuid,
            items: shopActorData.items || [] // default empty array for shop items
        };
    
        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }

    // Set connection item for the current user
    async setConnectionItem(currentUser, connectionItemData) {
        const allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        allData.users = allData.users || {};
        let conncetionCurrentUserId = currentUser.id;
        allData.users[conncetionCurrentUserId] = {
            ...allData.users[conncetionCurrentUserId],
            connectionItem: connectionItemData
        };
        let currentConnctionUserId = currentUser.id;
        // Initialize users object if not existing
        allData.users = allData.users || {};

        // Update only the current user's data under users object
        allData.users[currentConnctionUserId] = {
            ...allData.users[currentConnctionUserId],
            connectionItem: connectionItemData
        };

        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }

    // Clear the Purchase Screen data for the current user
    async clearPurchaseScreenData(currentUserId) {
        const clearCurrentUserId = currentUserId;
        const allData = await game.settings.get(this.moduleNamespace, this.settingKey);

        // Reset only the current user's data
        allData[clearCurrentUserId] = {
            selectedActor: null,
            shopActor: null,
            connectionItem: null,
            hasShopActor: false
        };

        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }

    // Remove the global shop actor (GM only)
    async removeShopActor() {
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        
        // Clear global shop actor data
        delete allData.globalShopActor;
        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }

    // Remove the selected actor for a specific user
    async removeSelectedActor(currentUser, actorId) {
        let RemoveUserId = currentUser.id;
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        allData.users = allData.users || {};

        if (allData.users[RemoveUserId]) {
            allData.users[RemoveUserId].selectedActorOrUserActor = null;
        }

        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }

    // Remove the connection item for a specific user
    async removeConnectionItem(currentUser, itemId) {
        let removeConnectionUserId = currentUser.id;
        let allData = await game.settings.get(this.moduleNamespace, this.settingKey) || {};
        allData.users = allData.users || {};

        if (allData.users[removeConnectionUserId]) {
            allData.users[removeConnectionUserId].connectionItem = null;
        }

        await game.settings.set(this.moduleNamespace, this.settingKey, allData);
    }
}
