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
        // Retrieve the specific flag under 'sr5-marketplace' using the flagId
        const userFlags = game.user.getFlag('sr5-marketplace', flagId);
        if (userFlags) {
            const items = userFlags.items || [];
            return {
                id: userFlags.id,
                items: items,
                requester: userFlags.requester
            };
        }
        console.warn(`No flag found with ID ${flagId}`);
        return null;
    }

    /**
     * Prepare the review order data for rendering the orderReview tab.
     * This processes items based on their IDs and calculates the necessary details like cost, availability, and ratings.
     * @param {Array} itemIds - An array of item IDs to prepare for review.
     * @returns {Object} - The prepared order review data.
     */
    prepareOrderReviewData(itemIds) {
        const reviewItems = [];

        // Iterate over each item ID, find the full item object, and prepare it
        itemIds.forEach(itemId => {
            const item = game.items.get(itemId);
            if (item) {
                const reviewItem = {
                    id_Item: item._id,
                    name: item.name,
                    image: item.img,
                    description: item.system.description?.value || "",
                    type: item.type,
                    selectedRating: item.system.technology.rating || 1, // Default rating
                    calculatedCost: this.calculateCost(item),
                    calculatedAvailability: this.calculateAvailability(item),
                    calculatedEssence: this.calculateEssence(item)
                };
                reviewItems.push(reviewItem);
            } else {
                console.warn(`Item with ID ${itemId} not found in game items.`);
            }
        });

        // Calculate total cost and total availability
        const totalCost = reviewItems.reduce((sum, item) => sum + (item.calculatedCost || 0), 0);
        const totalAvailability = reviewItems.reduce((sum, item) => sum + (item.calculatedAvailability || 0), 0);

        // Return the prepared data
        return {
            items: reviewItems,
            totalCost: totalCost,
            totalAvailability: totalAvailability
        };
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