// scripts/app/itemData.js
export default class ItemData {

    constructor() {
        this.items = [];
        this.excludedItems = [];
        this.basketItems = [];
        this.filteredItems = [];
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
    addItemToBasket(itemId) {
        const item = this.items.find(item => item._id === itemId);
        if (item) {
            const basketItem = {
                ...item,
                id_Item: item._id,
                image: item.img,
                name: item.name,
                description: item.system.description ? item.system.description.value : "", // Safely access description
                type: item.type,
                basketId: foundry.utils.randomID(),
                selectedRating: item.system.technology.rating || 1, // Default rating
                calculatedCost: this.calculateCost(item),
                calculatedAvailability: this.calculateAvailability(item),
                calculatedEssence: this.calculateEssence(item)
            };
            this.basketItems.push(basketItem);
        }
    }
    getReviewItems() {
        return this.reviewItems; // Return the prepared review items for rendering
    }
    calculateCost(item) {
        const rating = item.selectedRating || 1;
        return item.system.technology.cost * rating;
    }
    
    calculateAvailability(item) {
        const rating = item.selectedRating || 1;
        const baseAvailability = parseInt(item.system.technology.availability) || 0;
        const text = item.system.technology.availability.replace(/^\d+/, ''); // Extract text after the number
        return (baseAvailability * rating) + text;
    }
    
    calculateEssence(item) {
        const rating = item.selectedRating || 1;
        return item.system.essence * rating;
    }   

    removeItemFromBasket(basketId) {
        this.basketItems = this.basketItems.filter(item => item.basketId !== basketId);
    }
    updateBasketItem(basketId, selectedRating) {
        const item = this.basketItems.find(i => i.basketId === basketId);
        if (item) {
            item.selectedRating = selectedRating;
            item.calculatedCost = this.calculateCost(item);
            item.calculatedAvailability = this.calculateAvailability(item);
        }
    }
    getBasketItems() {
        return this.basketItems;
    }

    getFilteredItemsByType(type) {
        return this.filteredItems.filter(item => item.type === type);
    }

    calculateTotalCost() {
        return this.basketItems.reduce((total, item) => total + item.system.technology.cost, 0);
    }
    calculateTotalAvailability() {
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
     * Retrieve order data from a flag using the provided flag ID.
     * @param {string} flagId - The ID of the flag to retrieve data from.
     * @returns {Object|null} - The flag data object or null if not found.
     */
    getOrderDataFromFlag(flagId) {
        // Access the 'sr5-marketplace' flag on the current user
        const userFlags = game.user.flags['sr5-marketplace'];

        if (userFlags && userFlags[flagId]) {
            const flagData = userFlags[flagId];
            const items = flagData.items || [];

            // Return the flag data including requester information and the items
            return {
                id: flagData.id,
                items: items,
                requester: flagData.requester
            };
        } else {
            console.warn(`No flag found with ID ${flagId}`);
            return null;
        }
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

        const flagItems = userFlags.items || [];
        const completeItemsArray = [];

        for (const flagItem of flagItems) {
            const itemId = flagItem.id;
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
                calculatedEssence: flagItem.essence || (gameItem.system.essence || 0),
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
            requester: userFlags.requester // Include requester information if needed
        };
    }

    updateOrderReviewItem(itemId, selectedRating) {
        const item = game.items.get(itemId);
        if (item) {
            // Update the selected rating in the item's system data
            item.system.technology.rating = selectedRating;
    
            // Recalculate cost and availability after the rating change
            const updatedItem = {
                ...item,
                calculatedCost: this.calculateCost(item),
                calculatedAvailability: this.calculateAvailability(item),
                calculatedEssence: this.calculateEssence(item)  // Assuming essence depends on rating as well
            };
    
            // Save or update the item data in the game's system (optional)
            game.items.get(itemId).update(updatedItem);
        } else {
            console.warn(`Item with ID ${itemId} not found.`);
        }
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
     * Retrieve a complete weapon object with all relevant attributes.
     * @param {Object} itemValue - The base item data from game items.
     * @returns {Object} - The complete weapon object.
     */
    getCompleteWeaponObject(itemValue) {
        return {
            id: itemValue._id,
            name: itemValue.name,
            image: itemValue.img,
            description: itemValue.system.description?.value || "",
            type: itemValue.type,
            cost: itemValue.system.technology?.cost || 0,
            rating: itemValue.system.technology?.rating || 1,
            damage: itemValue.system.action?.damage?.value || 0,
            ap: itemValue.system.action?.damage?.ap?.value || 0,
            test: itemValue.system.action?.test || "",
            // Add other weapon-specific attributes here
        };
    }

    /**
     * Retrieve a complete equipment object with all relevant attributes.
     * @param {Object} itemValue - The base item data from game items.
     * @returns {Object} - The complete equipment object.
     */
    getCompleteEquipmentObject(itemValue) {
        return {
            id: itemValue._id,
            name: itemValue.name,
            image: itemValue.img,
            description: itemValue.system.description?.value || "",
            type: itemValue.type,
            cost: itemValue.system.technology?.cost || 0,
            rating: itemValue.system.technology?.rating || 1,
            equipped: itemValue.system.technology?.equipped || false,
            conditionMonitor: itemValue.system.technology?.condition_monitor || { value: 0, max: 0 },
            // Add other equipment-specific attributes here
        };
    }

    /**
     * Retrieve a complete lifestyle object with all relevant attributes.
     * @param {Object} itemValue - The base item data from game items.
     * @returns {Object} - The complete lifestyle object.
     */
    getCompleteLifestyleObject(itemValue) {
        return {
            id: itemValue._id,
            name: itemValue.name,
            image: itemValue.img,
            description: itemValue.system.description?.value || "",
            type: itemValue.type,
            cost: itemValue.system.technology?.cost || 0,
            rating: itemValue.system.technology?.rating || 1,
            comforts: itemValue.system.comforts || 0,
            security: itemValue.system.security || 0,
            // Add other lifestyle-specific attributes here
        };
    }

    /**
     * Retrieve a generic item object if no specific type handling is required.
     * @param {Object} itemValue - The base item data from game items.
     * @returns {Object} - The complete generic item object.
     */
    getGenericItemObject(itemValue) {
        return {
            id: itemValue._id,
            name: itemValue.name,
            image: itemValue.img,
            description: itemValue.system.description?.value || "",
            type: itemValue.type,
            cost: itemValue.system.technology?.cost || 0,
            // Add other generic attributes as needed
        };
    }
}