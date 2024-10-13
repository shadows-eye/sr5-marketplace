// scripts/app/itemData.js
export default class ItemData {

    constructor() {
        this.items = [];
        this.excludedItems = [];
        this.basketItems = [];
        this.filteredItems = [];
        this.orderReviewItems = [];
    }

    async fetchItems() {
        const worldItems = game.items.contents.filter(item => !item.name.includes('#[CF_tempEntity]'));
        const compendiumItems = [];
        for (let pack of game.packs) {
            if (pack.metadata.type === "Item") {
                const content = await pack.getDocuments();
                compendiumItems.push(...content.filter(item => !item.name.includes('#[CF_tempEntity]')));
            }
        }

        this.items = [...worldItems, ...compendiumItems]
            .filter(item => item.type !== "contact");

        this.excludedItems = this.items.filter(item =>
            ["adept_power", "call_in_action", "complex_form", "critter_power", "echo", "host", "metamagic", "quality", "sprite_power"]
            .includes(item.type)
        );
        this.items = this.items.filter(item =>
            !["adept_power", "call_in_action", "complex_form", "critter_power", "echo", "host", "metamagic", "quality", "sprite_power"]
            .includes(item.type)
        );
        this.filteredItems = this.items; // Initialize filteredItems with all items
    }

    get itemsByType() {
        return {
            rangedWeapons: this.getWeaponsByCategory("range"),
            meleeWeapons: this.getWeaponsByCategory("melee"),
            modifications: this.getItemsByType("modification"),
            armor: this.getItemsByType("armor"),
            bioware: this.getItemsByType("bioware"),
            cyberware: this.getItemsByType("cyberware"),
            devices: this.getItemsByType("device"),
            ammo: this.getItemsByType("ammo"),
            equipment: this.getItemsByType("equipment"),
            lifestyles: this.getItemsByType("lifestyle"),
            programs: this.getItemsByType("program"),
            rituals: this.getItemsByType("ritual"),
            sins: this.getItemsByType("sin"),
            spells: this.getItemsByType("spell"),
            actions: this.getItemsByType("action"),
        };
    }
    getItemsByType(type) {
        return this.items.filter(item => item.type === type);
    }

    getWeaponsByCategory(itemCategory) {
        return this.items.filter(item => 
            item.type === "weapon" && 
            item.system.category === itemCategory
        );
    }
    async addItemToBasket(itemId) {
        const item = this.items.find(item => item._id === itemId);
        if (item) {
            // Ensure all async calculations are awaited before adding to the basket
            // Get the base rating of the item (if available), otherwise default to 1
            const baseRating = item.system.technology?.rating || 1;
            
            // Ensure that selectedRating is at least the base rating of the item, or default to the base rating
            const selectedRating = item.selectedRating !== undefined && item.selectedRating !== null
                ? Math.max(item.selectedRating, baseRating) // Ensure the rating is not lower than the baseRating
                : baseRating;
    
            const calculatedCost = await this.calculateCost(item, selectedRating);
            const calculatedAvailability = await this.calculateAvailability(item, selectedRating);
            const calculatedEssence = await this.calculateEssence(item, selectedRating);
    
            const basketItem = {
                ...item,
                id_Item: item._id,
                image: item.img,
                name: item.name,
                description: item.system.description ? item.system.description.value : "", // Safely access description
                type: item.type,
                basketId: foundry.utils.randomID(),
                selectedRating, // Default or selected rating
                calculatedCost, // Use the awaited calculated cost
                calculatedAvailability, // Use the awaited availability
                calculatedEssence // Use the awaited essence
            };
    
            this.basketItems.push(basketItem);
        }
    }
    calculateCost(item) {
        const rating = item.selectedRating || 1; // Default rating
        const baseCost = item.system.technology?.cost || 0; // Get base cost from item data
        return baseCost * rating; // Calculate the cost based on the rating
    }
    /**
     * Asynchronously calculate the cost for the order review based on item rating.
     * @param {Object} item - The game item object.
     * @param {number} rating - The selected rating for the item.
     * @returns {Promise<number>} - The calculated cost as a number.
     */
    async calculateCostReviewUpdate(item, rating) {
        const baseItem = game.items.get(item._id || item.id); // Fetch the base item from the game world using the ID

        if (!baseItem) {
            console.warn(`Base item with ID ${item._id || item.id} not found.`);
            return 0; // Return 0 if the base item isn't found
        }

        // Get the base cost from the game item
        const baseCost = baseItem.system?.technology?.cost || 0;

        // Ensure baseCost is a number before proceeding
        if (typeof baseCost !== "number") {
            console.warn(`Base cost is not a number for item ${item._id || item.id}, got:`, baseCost);
            return 0; // Default to 0 if baseCost is not valid
        }

        const calculatedCost = baseCost * rating; // Calculate the cost based on the rating

        // Return the recalculated cost
        return parseFloat(calculatedCost) || 0; // Ensure that the result is a valid number
    }
    /**
     * Asynchronously calculate the availability for an order review item based on its rating.
     * @param {Object} item - The item object (game item data).
     * @param {number} rating - The selected rating.
     * @returns {Promise<string>} - The calculated availability string.
     */
    async calculateOrderReviewAvailability(item, rating) {
        const baseAvailability = item.system.technology.availability.match(/\d+/)[0]; // Extract the number
        const availabilityText = item.system.technology.availability.replace(/^\d+/, ''); // Extract text like 'R' or 'F'
        
        // Return the calculated availability, combining the number and text
        return (parseInt(baseAvailability) * rating) + availabilityText;
    }
    /**
     * Asynchronously calculate the essence for an item if applicable (cyberware/bioware/etc.).
     * @param {Object} item - The item object (game item data).
     * @returns {Promise<number>} - The calculated essence or 0 if not applicable.
     */
    async calculateOrderEssence(item) {
        // Simulate an async operation if needed
        return item.system.essence ? item.system.essence * (item.selectedRating || 1) : 0;
    }
    calculateAvailability(item) {
        const rating = item.selectedRating || 1;
        const baseAvailability = parseInt(item.system.technology.availability) || 0;
        const text = item.system.technology.availability.replace(/^\d+/, ''); // Extract text after the number
        return (baseAvailability * rating) + text;
    }
    calculateTotalEssenceCost() {
        return this.basketItems.reduce((total, item) => total + this.calculateEssence(item), 0);
    }
    calculateOrderReviewAvailability(item, selectedRating) {
        const baseAvailability = item.system.technology.availability || '0';
        const numericAvailability = parseInt(baseAvailability) || 0;
        const availabilityModifier = baseAvailability.replace(/^\d+/, '');  // Extract any non-numeric part (like "R" or "F")
    
        return `${numericAvailability * selectedRating}${availabilityModifier}`;  // Scale availability by rating
    }
    calculateEssence(item) {
        // Ensure selectedRating is set to 1 if it is undefined or null
        const rating = item.selectedRating !== undefined && item.selectedRating !== null ? item.selectedRating : 1;
    
        // Check if the essence value exists in the item's system, if not, default to 0
        const baseEssence = item.system?.essence !== undefined ? item.system.essence : 0;
    
        // Only apply rating multiplier if baseEssence is greater than 0
        if (baseEssence > 0) {
            return baseEssence * rating;
        }
    
        // If baseEssence is 0 or essence doesn't exist, return 0
        return 0;
    }
    calculatedKarmaCost(item) {
        // Check if the item has the sr5-marketplace flag and a karma value
        const marketplaceFlag = item.flags['sr5-marketplace'] || {};
        return marketplaceFlag.karma || 0;
    }
    
    // Function to calculate the total karma cost for all items in the basket
    calculateTotalKarmaCost() {
        return this.basketItems.reduce((total, item) => total + this.calculatedKarmaCost(item), 0);
    }
    async removeItemFromBasket(basketId) {
        this.basketItems = this.basketItems.filter(item => item.basketId !== basketId);
    }
    updateBasketItem(basketId, selectedRating) {
        const item = this.basketItems.find(i => i.basketId === basketId);
        if (item) {
            item.selectedRating = selectedRating;
            item.calculatedCost = this.calculateCost(item);
            item.calculatedAvailability = this.calculateAvailability(item);
            item.calculatedEssence = this.calculateEssence(item);
        }
    }
    /**
     * Calculate total cost for the order review.
     */
    calculateOrderReviewTotalCost() {
        return this.orderReviewItems.reduce((sum, item) => sum + (item.calculatedCost || 0), 0);
    }
    /**
     * Calculate total cost for the order review.
     */
    async calculateOrderReviewTotalCostUpdate() {
        const totalCostPromises = this.orderReviewItems.map(async (item) => {
            // Ensure that calculatedCost is awaited, as it may be a promise
            const cost = item.calculatedCost || await this.calculateCostReviewUpdate(item, item.selectedRating || 1);
            return cost;
        });
    
        // Wait for all promises to resolve, then sum the total cost
        const resolvedCosts = await Promise.all(totalCostPromises);
        return resolvedCosts.reduce((sum, cost) => sum + cost, 0);
    }

    /**
     * Calculate total availability for the order review. and Provide Localization for the highest priority text part
     */
    calculateOrderReviewTotalAvailability() {
        // Initialize variables to store the total availability and the highest priority text part
        let totalAvailability = 0;
        let highestPriorityText = "";
    
        // Define a priority map for the availability text parts
        const priorityMap = {
            "": 0,   // No text has the lowest priority
            "R": 1,  // Restricted
            "F": 2,  // Forbidden
            "E": 3   // Extreme (highest priority)
        };
    
        // Define a mapping for text parts to normalize values (e.g., "E" or "V" to "R" and "F")
        const textMapping = {
            "E": "R",  // German for Restricted
            "V": "F",  // German for Forbidden
            "R": "R",  // English Restricted
            "F": "F",  // English Forbidden
            "": ""     // No text
        };
    
        // Iterate over all order review items
        this.orderReviewItems.forEach(item => {
            const availability = item.calculatedAvailability || "";
    
            // Extract the numeric part of availability using regex
            const numericPart = parseInt(availability.match(/\d+/), 10) || 0;
            totalAvailability += numericPart;
    
            // Extract the text part (e.g., "E", "F", "R") from the availability string
            let textPart = availability.replace(/\d+/g, '').trim();
    
            // Normalize the text part based on the textMapping (e.g., "E" becomes "R", "V" becomes "F")
            textPart = textMapping[textPart.toUpperCase()] || "";  // Convert to uppercase for case-insensitive matching
    
            // Compare the current text part's priority to the highestPriorityText
            if (priorityMap[textPart] > priorityMap[highestPriorityText]) {
                highestPriorityText = textPart;  // Update to the highest-priority text part
            }
        });
    
        // Localize the highest priority text part (using the localization keys)
        const localizedText = highestPriorityText ? game.i18n.localize(`SR5.Marketplace.system.avail.${highestPriorityText}`) : "";
    
        // Combine the total availability number and the localized text part
        return `${totalAvailability} ${localizedText}`;
    }    
    addItemToOrderReview(itemId) {
        const item = this.items.find(item => item._id === itemId);
        if (item) {
            const reviewItem = {
                ...item,
                id_Item: item._id,
                image: item.img,
                name: item.name,
                description: item.system.description ? item.system.description.value : "",
                type: item.type,
                selectedRating: item.system.technology.rating || 1, // Default rating
                calculatedCost: this.calculateCost(item),
                calculatedAvailability: this.calculateAvailability(item),
                calculatedEssence: this.calculateEssence(item)
            };
            this.orderReviewItems.push(reviewItem);
        }
    }
    /**
     * Remove item from order review
     * @param {String} itemId - The ID of the item to remove from the review.
     */
    removeItemFromOrderReview(itemId) {
        this.orderReviewItems = this.orderReviewItems.filter(item => item.id_Item !== itemId);
    }
    /**
     * Update an item in the order review with a new rating
     * @param {String} itemId - The ID of the item to update.
     * @param {Number} selectedRating - The new selected rating.
     */
    updateOrderReviewItem(itemId, selectedRating) {
        const item = this.orderReviewItems.find(i => i.id_Item === itemId);
        if (item) {
            item.selectedRating = selectedRating;
            item.calculatedCost = this.calculateCostReviewUpdate(item);
            item.calculatedAvailability = this.calculateAvailability(item);
        }
    }
    getBasketItems() {
        return this.basketItems;
    }
    /**
     * Get the current list of items in the order review.
     * @returns {Array} The list of items in the order review.
     */
    getOrderReviewItems() {
        return this.orderReviewItems;
    }
    getFilteredItemsByType(type) {
        return this.filteredItems.filter(item => item.type === type);
    }

    calculateTotalCost() {
        return this.basketItems.reduce((total, item) => {
            // Use the selectedRating to calculate the total cost dynamically
            const rating = item.selectedRating || 1;  // Default to 1 if no rating is selected
            const cost = item.system.technology.cost || 0;  // Ensure cost is present
    
            return total + (cost * rating);  // Calculate cost based on rating and add to total
        }, 0);
    }
    calculateTotalAvailability() {
        const availabilityData = this.basketItems.reduce((acc, item) => {
            const baseAvailability = parseInt(item.system.technology.availability) || 0;
            const text = item.system.technology.availability.replace(/^\d+/, ''); // Extract text like 'F' or 'R'
    
            acc.total += baseAvailability * (item.selectedRating || 1);
            // Ensure we use the highest restriction (e.g., 'F' > 'R') if different types exist
            if (acc.text === '' || text > acc.text) {
                acc.text = text;
            }
            return acc;
        }, { total: 0, text: '' });
    
        return `${availabilityData.total}${availabilityData.text}`;
    }
    calculateTotalCostUpdate() {
        return this.basketItems.reduce((total, item) => total + item.system.technology.cost, 0);
    }
    calculateTotalAvailabilityUpdate() {
        return this.basketItems.reduce((total, item) => {
            const baseAvailability = parseInt(item.system.technology.availability) || 0;
            const text = item.system.technology.availability.replace(/^\d+/, ''); // Extract text after the number
            return total + (baseAvailability * (item.selectedRating || 1))+ text;
        }, 0);
    }
    async getData() {
        this.itemData = new ItemData();
        await this.itemData.fetchItems();
        window.itemData = this.itemData;  // Make it globally accessible
        return super.getData();
    }

    // send data to chat message hbs
    sendBasketToChat() {
        const basketItems = this.getBasketItems();
        const totalCost = this.calculateTotalCost();

        const messageData = {
            items: basketItems.map(item => ({
                name: item.name,
                quantity: item.selectedRating || 1,
                price: item.calculatedCost,
                description: item.data?.description || item.system?.description
            })),
            totalCost: totalCost
        };

        // Render the message using the HBS template
        renderTemplate('modules/sr5-marketplace/templates/chatMessage.hbs', messageData).then(html => {
            ChatMessage.create({
                user: game.user.id,
                content: html,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER
            });
        });
    }
    getItemsFromIds(itemIds) {
        // Retrieve detailed item data from an array of item IDs
        const items = itemIds.map(id => {
            const item = game.items.get(id);
            if (item) {
                return {
                    id: item.id,
                    name: item.name,
                    cost: item.system.technology.cost,
                    availability: item.system.technology.availability,
                    essence: item.system.technology.essence,
                    image: item.img,
                    type: item.type,                    
                    // Add other relevant properties as needed
                };
            } else {
                console.warn(`Item with ID ${id} not found.`);
                return null;
            }
        }).filter(item => item !== null); // Filter out null items
    
        return items;
    }
    /**
     * Retrieve order data from a flag, enrich it with item data, and store it in the completeItemsArray.
     * @param {string} flagId - The ID of the flag to retrieve data from.
     * @returns {Object|null} - The enriched order data or null if not found.
     */
    async getOrderDataFromFlag(flagId) {
        let flagData = null;
    
        // Step 1: Search through all users for the flag
        for (const user of game.users.contents) {
            const userFlags = user.flags['sr5-marketplace'];
            if (userFlags && userFlags[flagId]) {
                flagData = userFlags[flagId];
                break; // Exit loop once flag is found
            }
        }
    
        // Step 2: If no user has the flag, check the GM's flags
        if (!flagData) {
            const gmUser = game.users.find(u => u.isGM);
            if (gmUser) {
                const gmFlags = gmUser.flags['sr5-marketplace'];
                if (gmFlags && gmFlags[flagId]) {
                    flagData = gmFlags[flagId];
                }
            }
        }
    
        // Step 3: If no flag data was found, return null
        if (!flagData) {
            console.warn(`No flag found with ID ${flagId}`);
            return null;
        }
    
        // Step 4: Enrich the items in the flag data
        const items = flagData.items || [];
        const reviewPrep = [];
        /*
        const baseItems = [];
        await Promise.all(items.map(async (flagItem) => {
            const itemId = flagItem.id || flagItem._id || flagItem.id_Item; // Adjust based on how the ID is stored
            const baseItemUuid = `Item.${itemId}`; // Construct UUID for the base item
            try {
                // Fetch the base item using its UUID
                const baseItem = await fromUuid(baseItemUuid);
                if (baseItem) {
                    console.log(`Base item fetched with UUID: ${baseItemUuid}`, baseItem);
                    baseItems.push(baseItem); // Store the base item in the array
                } else {
                    console.warn(`Base item with UUID ${baseItemUuid} not found.`);
                }
            } catch (error) {
                console.error(`Error fetching base item with UUID ${baseItemUuid}:`, error);
            }*/
            await Promise.all(items.map(async (flagItem) => {
            const itemId = flagItem.id || flagItem._id || flagItem.id_Item; 
            const gameItem = game.items.get(itemId); // Fetch the item from the game world
            if (gameItem) {
                const enrichedItem = JSON.parse(JSON.stringify(gameItem));
    
                enrichedItem.selectedRating = flagItem.rating || enrichedItem.system.technology?.rating || 1;
                let enrichmentRating = Number(enrichedItem.selectedRating);
    
                enrichedItem.calculatedCost = flagItem.cost || (await this.calculateCostReviewUpdate(enrichedItem, enrichmentRating));
                if (typeof enrichedItem.calculatedCost !== "number") {
                    console.warn(`calculatedCost is not a number, got:`, enrichedItem.calculatedCost);
                    enrichedItem.calculatedCost = parseFloat(enrichedItem.calculatedCost) || 0;
                }
    
                enrichedItem.calculatedAvailability = await this.calculateOrderReviewAvailability(enrichedItem, enrichedItem.selectedRating);
                enrichedItem.calculatedEssence = await this.calculateEssence(enrichedItem);
    
                enrichedItem.calculatedAvailability = String(enrichedItem.calculatedAvailability || '');
                enrichedItem.calculatedEssence = parseFloat(enrichedItem.calculatedEssence) || 0;

                // Calculate karma cost from the flag, with a fallback to 0
                enrichedItem.calculatedKarma = flagItem.karma || 0;
    
                enrichedItem.system.technology.cost = enrichedItem.calculatedCost; // Override with flagged cost
                enrichedItem.system.technology.rating = enrichedItem.selectedRating; // Override with flagged rating
                enrichedItem.system.technology.availability = enrichedItem.calculatedAvailability; // Override availability
    
                reviewPrep.push(enrichedItem);
            } else {
                console.warn(`Game item with ID ${itemId} not found.`);
            }
        }));
    
        // Step 5: Fetch the actor if actorId is present
        let actor = null;
        if (flagData.actorId) {
            actor = game.actors.get(flagData.actorId);
            if (!actor) {
                console.warn(`Actor with ID ${flagData.actorId} not found.`);
            }
        }
    
        // Step 6: Calculate total cost and availability
        const totalCost = reviewPrep.reduce((sum, item) => sum + (item.calculatedCost || 0), 0);
        const totalAvailability = reviewPrep.reduce((acc, item) => acc + (item.calculatedAvailability || ''), '');
    
        // Step 7: Save enriched items and calculated totals into completeItemsArray
        this.completeItemsArray = reviewPrep.map(item => ({
            ...item,
            flags: {
                ...item.flags,
                'sr5-marketplace': { flagId }
            }
        }));
    
        // Return the enriched data, including actor details
        return {
            id: flagData.id,
            items: this.completeItemsArray, // The enriched items array with cost, availability, karma, and essence
            totalCost,
            totalAvailability,
            totalEssenceCost: this.completeItemsArray.reduce((sum, item) => sum + (item.calculatedEssence || 0), 0), // Total essence
            totalKarmaCost: this.completeItemsArray.reduce((sum, item) => sum + (item.calculatedKarma || 0), 0), // Total karma
            requester: flagData.requester,
            requesterId: flagData.requesterId, // Include requesterId if present
            actorId: flagData.actorId // Include actorId if present
        };
    }

    /**
     * Retrieve order data from a flag using the provided flag ID and enrich it with game item data.
     * @param {string} flagId - The ID of the flag to retrieve data from.
     * @returns {Object|null} - The order review data with enriched game item information, or null if not found.
     */
    async prepareOrderReviewData(flagId) {
        const userFlags = game.user.getFlag('sr5-marketplace', flagId);
        if (!userFlags) {
            console.warn(`No flag found with ID ${flagId}`);
            return null;
        }

        const flagItems = userFlags.items || []; //These are the items that are saved in the flag of the user!
        const completeItemsArray = [];

        for (const flagItem of flagItems) {
            const itemId = flagItem._id;
            const gameItem = game.items.get(itemId);

            // Combine flag and game item data
            const enrichedItem = {
                id_Item: itemId,
                name: flagItem.name || gameItem.name,
                image: flagItem.image || gameItem.img,
                description: flagItem.description || gameItem.system.description?.value || "",
                type: flagItem.type || gameItem.type,
                selectedRating: flagItem.rating || (gameItem.system.technology?.rating || 1),
                calculatedCost: flagItem.cost || (gameItem.system.technology?.cost || 0),
                calculatedAvailability: flagItem.availability || (gameItem.system.technology?.availability || 0),
                calculatedEssence: flagItem.essence || (gameItem.system.essence * flagItem.rating || 0),
                Karma: gameItem.getFlag('sr5-marketplace', 'karma') || 0,
                gameItem: gameItem // Keep the full game item for further functions
            };

            completeItemsArray.push(enrichedItem);
        }

        // Calculate total cost and availability based on the modified flag data
        const totalCost = completeItemsArray.reduce((sum, item) => sum + (item.calculatedCost || 0), 0);
        const totalAvailability = completeItemsArray.reduce((sum, item) => sum + (item.calculatedAvailability || 0), 0);

        // Return order review data, including the completeItemsArray
        return {
            id: flagId,
            items: completeItemsArray,  // Pass the enriched complete items array
            totalCost: totalCost,
            totalAvailability: totalAvailability,
            Karma: completeItemsArray.Karma,
            requester: userFlags.requester // Include requester information if needed
        };
    }

    updateOrderReviewItem(itemId, selectedRating) {
        // Find the item in the completeItemsArray (which is managing the review items)
        const completeItemsArray = this.getOrderReviewItems();
        const reviewItem = completeItemsArray.find(item => item.id === itemId);
        
        if (reviewItem) {
            // Update the selected rating
            reviewItem.selectedRating = selectedRating;
            
            // Recalculate cost, availability, and essence based on the new rating
            reviewItem.calculatedCost = this.calculateCostReviewUpdate(reviewItem);
            reviewItem.calculatedAvailability = this.calculateAvailability(reviewItem);
            reviewItem.calculatedEssence = this.calculateEssence(reviewItem);  // Assuming essence depends on rating

            // Log the updated review item for debugging
            console.log(`Updated review item with new rating:`, reviewItem);
        } else {
            console.warn(`Review item with ID ${itemId} not found in completeItemsArray.`);
        }
    
        return completeItemsArray;  // Return the updated array
    }
    /**
     * Retrieve a complete item object by its ID, dynamically handling different item types.
     * @param {string} itemId - The ID of the item to retrieve.
     * @returns {Object} - The complete item object with all relevant attributes.
     */
    getCompleteItemObject(itemId) {
        const gameItem = game.items.get(itemId);
        if (!gameItem) {
            console.warn(`Item with ID ${itemId} not found.`);
            return null;
        }
        
        const itemType = itemValue.type;

        switch (itemType) {
            case 'weapon':
                return this.getCompleteWeaponObject(itemValue);
            case 'equipment':
                return this.getCompleteEquipmentObject(itemValue);
            case 'lifestyle':
                return this.getCompleteLifestyleObject(itemValue);
            // Add more cases as needed for different types
            default:
                return this.getGenericItemObject(itemValue);
        }
    }

    /**
     * Get the full structure for ranged weapons, building off the base structure.
     */
    getRangedWeapons(itemId) {
        const item = game.items.get(itemId);
        if (item && item.type === "weapon" && item.system.category === "range") {
            const rangedWeapon = {
                ...this.getBaseStructure(item),  // Start with the base structure
                system: {
                    ...this.getBaseStructure(item).system,
                    action: {
                        type: item.system.action?.type || "varies",
                        test: item.system.action?.test || "RangedAttackTest",
                        attribute: item.system.action?.attribute || "agility",
                        skill: item.system.action?.skill || "automatics",
                        limit: {
                            value: item.system.action?.limit?.value || 5,
                            base: item.system.action?.limit?.base || 5
                        },
                        damage: {
                            type: {
                                value: item.system.action?.damage?.type?.value || "physical",
                                base: item.system.action?.damage?.type?.base || "physical"
                            },
                            value: item.system.action?.damage?.value || 10,
                            ap: {
                                value: item.system.action?.damage?.ap?.value || -2,
                                base: item.system.action?.damage?.ap?.base || -2
                            }
                        }
                    },
                    range: {
                        category: item.system.range?.category || "manual",
                        ranges: {
                            short: item.system.range?.ranges?.short || 25,
                            medium: item.system.range?.ranges?.medium || 150,
                            long: item.system.range?.ranges?.long || 350,
                            extreme: item.system.range?.ranges?.extreme || 550
                        },
                        rc: {
                            value: item.system.range?.rc?.value || 0,
                            base: item.system.range?.rc?.base || 0
                        },
                        modes: {
                            single_shot: item.system.range?.modes?.single_shot || false,
                            semi_auto: item.system.range?.modes?.semi_auto || true,
                            burst_fire: item.system.range?.modes?.burst_fire || true,
                            full_auto: item.system.range?.modes?.full_auto || true
                        }
                    }
                }
            };
            
            // Add the structured ranged weapon to the completeItemsArray
            this.completeItemsArray.push(rangedWeapon);
        } else {
            console.warn("Item is not a ranged weapon or item was not found.");
        }
    }
    /**
     * Create the base structure shared by all item types.
     */
    getBaseStructure(item) {
        return {
            name: item.name,
            type: item.type,
            system: {
                description: {
                    value: item.system.description?.value || "",
                    chat: item.system.description?.chat || "",
                    source: item.system.description?.source || ""
                },
                technology: {
                    rating: item.system.technology?.rating || 0,
                    availability: item.system.technology?.availability || "",
                    quantity: item.system.technology?.quantity || 1,
                    cost: item.system.technology?.cost || 0,
                    equipped: item.system.technology?.equipped || false,
                    conceal: {
                        base: item.system.technology?.conceal?.base || 0,
                        value: item.system.technology?.conceal?.value || 0
                    },
                    condition_monitor: {
                        value: item.system.technology?.condition_monitor?.value || 0,
                        max: item.system.technology?.condition_monitor?.max || 9
                    },
                    wireless: item.system.technology?.wireless || false,
                    networkController: item.system.technology?.networkController || null
                },
                importFlags: {
                    name: item.system.importFlags?.name || "",
                    type: item.system.importFlags?.type || "",
                    subType: item.system.importFlags?.subType || "",
                    isFreshImport: item.system.importFlags?.isFreshImport || false,
                    isImported: item.system.importFlags?.isImported || false
                }
            },
            folder: item.folder || "",
            img: item.img || "icons/svg/item-bag.svg",
            effects: item.effects || [],
            sort: item.sort || 0,
            ownership: item.ownership || {},
            flags: item.flags || {},
            _stats: item._stats || {},
            _id: item._id || ""
        };
    }
    /**
     * Add a melee weapon to the order review with the full structure.
     * This ensures the object in completeItemsArray matches the system's melee weapon structure.
     */
    getMeleeWeapon(itemId) {
        const item = game.items.get(itemId);  // Fetch the item by its ID
        if (item && item.type === "weapon" && item.system.category === "melee") {
            const meleeWeapon = {
                name: item.name,
                type: item.type,
                system: {
                    description: {
                        value: item.system.description?.value || "",
                        chat: item.system.description?.chat || "",
                        source: item.system.description?.source || ""
                    },
                    action: {
                        type: item.system.action?.type || "",
                        test: item.system.action?.test || "",
                        categories: item.system.action?.categories || [],
                        attribute: item.system.action?.attribute || "",
                        attribute2: item.system.action?.attribute2 || "",
                        skill: item.system.action?.skill || "",
                        armor: item.system.action?.armor || false,
                        spec: item.system.action?.spec || "",
                        mod: item.system.action?.mod || 0,
                        mod_description: item.system.action?.mod_description || "",
                        roll_mode: item.system.action?.roll_mode || "",
                        limit: {
                            value: item.system.action?.limit?.value || 0,
                            base: item.system.action?.limit?.base || 0,
                            attribute: item.system.action?.limit?.attribute || ""
                        },
                        threshold: {
                            value: item.system.action?.threshold?.value || 0,
                            base: item.system.action?.threshold?.base || 0
                        },
                        extended: item.system.action?.extended || false,
                        damage: {
                            type: {
                                value: item.system.action?.damage?.type?.value || "physical",
                                base: item.system.action?.damage?.base || "physical"
                            },
                            element: {
                                value: item.system.action?.damage?.element?.value || "",
                                base: item.system.action?.damage?.element?.base || ""
                            },
                            value: item.system.action?.damage?.value || 0,
                            base: item.system.action?.damage?.base || 0,
                            ap: {
                                value: item.system.action?.damage?.ap?.value || 0,
                                base: item.system.action?.damage?.ap?.base || 0,
                                mod: item.system.action?.damage?.ap?.mod || []
                            },
                            base_formula_operator: item.system.action?.damage?.base_formula_operator || "add",
                            attribute: item.system.action?.damage?.attribute || ""
                        }
                    },
                    technology: {
                        rating: item.system.technology?.rating || 0,
                        availability: item.system.technology?.availability || "",
                        quantity: item.system.technology?.quantity || 1,
                        cost: item.system.technology?.cost || 0,
                        equipped: item.system.technology?.equipped || false,
                        conceal: {
                            base: item.system.technology?.conceal?.base || 0,
                            value: item.system.technology?.conceal?.value || 0
                        },
                        condition_monitor: {
                            value: item.system.technology?.condition_monitor?.value || 0,
                            max: item.system.technology?.condition_monitor?.max || 0
                        },
                        wireless: item.system.technology?.wireless || false,
                        networkController: item.system.technology?.networkController || null
                    },
                    category: item.system.category || "melee",
                    subcategory: item.system.subcategory || "blades",
                    ammo: {
                        spare_clips: {
                            value: item.system.ammo?.spare_clips?.value || 0,
                            max: item.system.ammo?.spare_clips?.max || 0
                        },
                        current: {
                            value: item.system.ammo?.current?.value || 0,
                            max: item.system.ammo?.current?.max || 0
                        }
                    },
                    range: {
                        category: item.system.range?.category || "",
                        ranges: {
                            short: item.system.range?.ranges?.short || 0,
                            medium: item.system.range?.ranges?.medium || 0,
                            long: item.system.range?.ranges?.long || 0,
                            extreme: item.system.range?.ranges?.extreme || 0
                        },
                        rc: {
                            value: item.system.range?.rc?.value || 0
                        },
                        modes: {
                            single_shot: item.system.range?.modes?.single_shot || false,
                            semi_auto: item.system.range?.modes?.semi_auto || false,
                            burst_fire: item.system.range?.modes?.burst_fire || false,
                            full_auto: item.system.range?.modes?.full_auto || false
                        }
                    },
                    melee: {
                        reach: item.system.melee?.reach || 0
                    }
                },
                folder: item.folder || "",
                img: item.img || "icons/svg/item-bag.svg",
                effects: item.effects || [],
                sort: item.sort || 0,
                ownership: item.ownership || {},
                flags: item.flags || {},
                _stats: item._stats || {},
                _id: item._id || ""
            };

            // Add the structured melee weapon to the completeItemsArray
            this.completeItemsArray.push(meleeWeapon);
        } else {
            console.warn("Item is not a melee weapon or item was not found.");
        }
    }
    /**
     * Get the full structure for thrown weapons, building off the base structure.
     */
    getThrownWeapon(itemId) {
        const item = game.items.get(itemId);
        if (item && item.type === "weapon" && item.system.category === "thrown") {
            const thrownWeapon = {
                ...this.getBaseStructure(item),  // Start with the base structure
                system: {
                    ...this.getBaseStructure(item).system,
                    action: {
                        type: item.system.action?.type || "varies",
                        test: item.system.action?.test || "ThrownAttackTest",
                        attribute: item.system.action?.attribute || "agility",
                        skill: item.system.action?.skill || "throwing_weapons",
                        limit: {
                            value: item.system.action?.limit?.value || 0,
                            base: item.system.action?.limit?.base || 0
                        },
                        damage: {
                            type: {
                                value: item.system.action?.damage?.type?.value || "physical",
                                base: item.system.action?.damage?.type?.base || "physical"
                            },
                            value: item.system.action?.damage?.value || 0,
                            ap: {
                                value: item.system.action?.damage?.ap?.value || 0,
                                base: item.system.action?.damage?.ap?.base || 0
                            },
                            attribute: item.system.action?.damage?.attribute || "strength"
                        }
                    },
                    thrown: {
                        ranges: {
                            short: item.system.thrown?.ranges?.short || 2,
                            medium: item.system.thrown?.ranges?.medium || 4,
                            long: item.system.thrown?.ranges?.long || 8,
                            extreme: item.system.thrown?.ranges?.extreme || 15,
                            attribute: item.system.thrown?.ranges?.attribute || "strength",
                            category: item.system.thrown?.ranges?.category || "manual",
                            min: item.system.thrown?.ranges?.min || 0
                        },
                        blast: {
                            radius: item.system.thrown?.blast?.radius || 0,
                            dropoff: item.system.thrown?.blast?.dropoff || 0
                        }
                    }
                }
            };

            // Add the structured thrown weapon to the completeItemsArray
            this.completeItemsArray.push(thrownWeapon);
        } else {
            console.warn("Item is not a thrown weapon or item was not found.");
        }
    }
    /**
     * Get the full structure for commlinks, building off the base structure.
     */
    getCommlink(itemId) {
        const item = game.items.get(itemId);
        if (item && item.type === "device" && item.system.category === "commlink") {
            const commlink = {
                ...this.getBaseStructure(item),  // Start with the base structure
                system: {
                    ...this.getBaseStructure(item).system,
                    atts: {
                        att1: {
                            value: item.system.atts?.att1?.value || 0,
                            att: item.system.atts?.att1?.att || "attack",
                            editable: item.system.atts?.att1?.editable || true
                        },
                        att2: {
                            value: item.system.atts?.att2?.value || 0,
                            att: item.system.atts?.att2?.att || "sleaze",
                            editable: item.system.atts?.att2?.editable || true
                        },
                        att3: {
                            value: item.system.atts?.att3?.value || 0,
                            att: item.system.atts?.att3?.att || "data_processing",
                            editable: item.system.atts?.att3?.editable || true
                        },
                        att4: {
                            value: item.system.atts?.att4?.value || 0,
                            att: item.system.atts?.att4?.att || "firewall",
                            editable: item.system.atts?.att4?.editable || true
                        }
                    },
                    networkDevices: item.system.networkDevices || []
                }
            };

            // Add the structured commlink to the completeItemsArray
            this.completeItemsArray.push(commlink);
        } else {
            console.warn("Item is not a commlink or item was not found.");
        }
    }
    /**
     * Get the full structure for cyberdecks, building off the base structure.
     */
    getCyberdeck(itemId) {
        const item = game.items.get(itemId);
        if (item && item.type === "device" && item.system.category === "cyberdeck") {
            const cyberdeck = {
                ...this.getBaseStructure(item),  // Start with the base structure
                system: {
                    ...this.getBaseStructure(item).system,
                    atts: {
                        att1: {
                            value: item.system.atts?.att1?.value || 0,
                            att: item.system.atts?.att1?.att || "attack",
                            editable: item.system.atts?.att1?.editable || true
                        },
                        att2: {
                            value: item.system.atts?.att2?.value || 0,
                            att: item.system.atts?.att2?.att || "sleaze",
                            editable: item.system.atts?.att2?.editable || true
                        },
                        att3: {
                            value: item.system.atts?.att3?.value || 0,
                            att: item.system.atts?.att3?.att || "data_processing",
                            editable: item.system.atts?.att3?.editable || true
                        },
                        att4: {
                            value: item.system.atts?.att4?.value || 0,
                            att: item.system.atts?.att4?.att || "firewall",
                            editable: item.system.atts?.att4?.editable || true
                        }
                    },
                    networkDevices: item.system.networkDevices || []
                }
            };

            // Add the structured cyberdeck to the completeItemsArray
            this.completeItemsArray.push(cyberdeck);
        } else {
            console.warn("Item is not a cyberdeck or item was not found.");
        }
    }
    /**
     * Get the full structure for cyberware, building off the base structure.
     */
    getCyberware(itemId) {
        const item = game.items.get(itemId);
        if (item && item.type === "cyberware") {
            const cyberware = {
                ...this.getBaseStructure(item),  // Start with the base structure
                system: {
                    ...this.getBaseStructure(item).system,
                    essence: item.system.essence || 0,  // Essence cost for cyberware
                    grade: item.system.grade || "standard",  // Cyberware grade (standard, alpha, etc.)
                    capacity: item.system.capacity || 0,  // Capacity used by the cyberware
                    action: {
                        type: item.system.action?.type || "",
                        test: item.system.action?.test || "SuccessTest",
                        categories: item.system.action?.categories || [],
                        attribute: item.system.action?.attribute || "",
                        skill: item.system.action?.skill || "",
                        limit: {
                            value: item.system.action?.limit?.value || 0,
                            base: item.system.action?.limit?.base || 0
                        }
                    },
                    armor: {
                        value: item.system.armor?.value || 0,
                        mod: item.system.armor?.mod || []
                    }
                }
            };

            // Add the structured cyberware to the completeItemsArray
            this.completeItemsArray.push(cyberware);
        } else {
            console.warn("Item is not cyberware or item was not found.");
        }
    }
    /**
     * Get the full structure for bioware, building off the base structure.
     */
    getBioware(itemId) {
        const item = game.items.get(itemId);
        if (item && item.type === "bioware") {
            const bioware = {
                ...this.getBaseStructure(item),  // Start with the base structure
                system: {
                    ...this.getBaseStructure(item).system,
                    essence: item.system.essence || 0,  // Essence cost for bioware
                    grade: item.system.grade || "standard",  // Bioware grade (standard, cultured, etc.)
                    capacity: item.system.capacity || 0,  // Capacity usage for bioware
                    action: {
                        type: item.system.action?.type || "",
                        test: item.system.action?.test || "SuccessTest",
                        categories: item.system.action?.categories || [],
                        attribute: item.system.action?.attribute || "",
                        skill: item.system.action?.skill || "",
                        limit: {
                            value: item.system.action?.limit?.value || 0,
                            base: item.system.action?.limit?.base || 0
                        }
                    },
                    armor: {
                        value: item.system.armor?.value || 0,
                        mod: item.system.armor?.mod || []
                    }
                }
            };

            // Add the structured bioware to the completeItemsArray
            this.completeItemsArray.push(bioware);
        } else {
            console.warn("Item is not bioware or item was not found.");
        }
    }
    /**
     * Get the full structure for programs, building off the base structure.
     */
    getProgram(itemId) {
        const item = game.items.get(itemId);
        if (item && item.type === "program") {
            const program = {
                ...this.getBaseStructure(item),  // Start with the base structure
                system: {
                    ...this.getBaseStructure(item).system,
                    type: item.system.type || "hacking_program",  // Program type (hacking, combat, etc.)
                    technology: {
                        rating: item.system.technology?.rating || null,
                        availability: item.system.technology?.availability || "4R",
                        cost: item.system.technology?.cost || 250,
                        wireless: item.system.technology?.wireless || true
                    }
                }
            };

            // Add the structured program to the completeItemsArray
            this.completeItemsArray.push(program);
        } else {
            console.warn("Item is not a program or item was not found.");
        }
    }
}

/**
* 
* @returns {Promise} - A promise that resolves with the formatted timestamps.
*/
export async function getFormattedTimestamp() {
    let chatTimestamp= "";
    let flagTimestamp= "";

    if (typeof SimpleCalendar !== "undefined" && SimpleCalendar.api) {
        const currentDate = SimpleCalendar.api.currentDateTime();
        
        // Ensure the date exists and is formatted correctly
        if (currentDate) {
            const formattedDate = `${currentDate.day}/${currentDate.month + 1}/${currentDate.year}`;  // month + 1 since months start at 0
            chatTimestamp = flagTimestamp = formattedDate;  // Use the same format for both chat and flag if needed
        } else {
            chatTimestamp = flagTimestamp = new Date().toLocaleString();  // Fallback to default JS date
        }
    } else {
        // Fallback if SimpleCalendar isn't available
        chatTimestamp = flagTimestamp = new Date().toLocaleString();
    }

    return { chatTimestamp, flagTimestamp };
}
/**
 * Fetch item data from a remote source and process it.
 * @returns {Promise<void>} - A promise that resolves when the data is fetched and processed.
 */
// Function to fetch and display the list of available languages
export async function fetchAndSelectLanguage() {
    const languageRepoUrl = 'https://api.github.com/repos/chummer5a/chummer5a/contents/Chummer/lang';

    try {
        const response = await fetch(languageRepoUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const languages = await response.json();
        const languageFiles = languages.filter(file => file.name.endsWith('_data.xml'));

        // Generate options for the selection window
        const languageOptions = languageFiles.map(file => ({
            name: file.name.replace('_data.xml', ''), // Strip the "_data.xml" from the filename
            url: file.download_url
        }));

        // Create and show a selection dialog
        const selectedLanguageUrl = await new Promise(resolve => {
            const dialogOptions = languageOptions.map(option => `<option value="${option.url}">${option.name}</option>`).join('');
            const dialogHtml = `<label>Select a language:</label><select id="language-select">${dialogOptions}</select>`;

            new Dialog({
                title: 'Language Selection',
                content: dialogHtml,
                buttons: {
                    ok: {
                        label: 'OK',
                        callback: html => {
                            const selectedUrl = html.find('#language-select').val();
                            resolve(selectedUrl);
                        }
                    }
                }
            }).render(true);
        });

        if (selectedLanguageUrl) {
            const enhancedItems = await EnhanceItemData(selectedLanguageUrl);
            return enhancedItems;  // Return the enhanced items for further processing
        }
    } catch (error) {
        console.error("Failed to fetch languages from GitHub:", error);
    }
}

// Function to fetch item data from a remote source and process it.
export async function EnhanceItemData(languageUrl) {
    const url = 'https://api.github.com/repos/chummer5a/chummer5a/contents/Chummer/data/qualities.xml?ref=master';

    try {
        const response = await fetch(url, {
            headers: {
                Accept: 'application/vnd.github.v3.raw', // Get raw file content
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        // Find all qualities in the XML
        const qualities = xmlDoc.getElementsByTagName("quality");

        const qualitiesArray = [];

        // Fetch localized data
        if (languageUrl) {
            const langResponse = await fetch(languageUrl, {
                headers: {
                    Accept: 'application/vnd.github.v3.raw',
                }
            });

            if (!langResponse.ok) {
                throw new Error(`Failed to fetch language data from ${languageUrl}, status: ${langResponse.status}`);
            }

            const langXmlText = await langResponse.text();
            const langXmlDoc = parser.parseFromString(langXmlText, "text/xml");

            const langQualities = langXmlDoc.getElementsByTagName("quality");

            // Match qualities and localized qualities
            for (let i = 0; i < qualities.length; i++) {
                const quality = qualities[i];
                const qualityId = quality.getElementsByTagName("id")[0]?.textContent;
                const qualityName = quality.getElementsByTagName("name")[0]?.textContent;
                const qualitySource = quality.getElementsByTagName("source")[0]?.textContent || "Unknown";

                const localizedQuality = Array.from(langQualities).find(
                    lq => lq.getElementsByTagName("id")[0]?.textContent === qualityId
                );

                if (localizedQuality) {
                    const localizedName = localizedQuality.getElementsByTagName("translate")[0]?.textContent || qualityName;
                    const altPage = localizedQuality.getElementsByTagName("altpage")[0]?.textContent || "Unknown";
                    const sourceAndPage = `${qualitySource} ${altPage}`;

                    qualitiesArray.push({
                        id: qualityId,
                        name: qualityName,
                        localizedName: localizedName,
                        sourceAndPage: sourceAndPage,
                        karma: quality.getElementsByTagName("karma")[0]?.textContent || 0
                    });
                }
            }

            console.log("GitHub Qualities Array:", qualitiesArray);

            const worldItems = await fetchWorldAndCompendiumItems();
            const enhancedItems = await findItemName(qualitiesArray, worldItems);

            // Log the enhanced items that were updated
            console.log("Enhanced World Items with updated karma and source:", enhancedItems);
            return enhancedItems;
        }
    } catch (error) {
        console.error("Failed to fetch XML from GitHub:", error);
    }
}

/**
 * Fetch world and compendium items of type 'quality'
 */
async function fetchWorldAndCompendiumItems() {
    const worldItems = game.items.filter(i => i.type === 'quality');
    const compendiumItems = [];

    for (const pack of game.packs) {
        if (pack.documentName === 'Item') {
            const items = await pack.getDocuments();
            compendiumItems.push(...items.filter(i => i.type === 'quality'));
        }
    }

    // Combine world and compendium items into one array
    return [...worldItems, ...compendiumItems];
}

/**
 * Match the GitHub qualities with world/compendium items step by step.
 * @param {Array} githubQualities - Array of GitHub qualities
 * @param {Array} worldItems - Array of world/compendium items
 */
async function findItemName(githubQualities, worldItems) {
    const enhancedItems = [];

    for (const quality of githubQualities) {
        let matchedItems = worldItems.filter(item => item.name.includes(quality.localizedName.split(' ')[0]));

        const nameParts = quality.localizedName.split(' ');
        for (let i = 1; i < nameParts.length && matchedItems.length > 1; i++) {
            matchedItems = matchedItems.filter(item => item.name.includes(nameParts[i]));
        }

        if (matchedItems.length === 1) {
            const matchedItem = matchedItems[0];

            // Update the matched item with the sourceAndPage and karma from the GitHub quality
            matchedItem.system.description.source = quality.sourceAndPage;
            matchedItem.system.karma = parseInt(quality.karma, 10);

            // Update the item in the world or compendium
            await matchedItem.update({
                'system.description.source': quality.sourceAndPage,
                'system.karma': quality.karma
            });

            enhancedItems.push({
                name: matchedItem.name,
                originalName: quality.name,
                localizedName: quality.localizedName,
                sourceAndPage: quality.sourceAndPage,
                karma: quality.karma
            });
        } else {
            console.warn(`No exact match found for quality: ${quality.localizedName}`);
        }
    }

    return enhancedItems;
}