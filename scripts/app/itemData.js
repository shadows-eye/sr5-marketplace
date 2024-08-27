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
                basketId: foundry.utils.randomID(), 
                selectedRating: item.system.technology.rating || 1, // Default rating
                calculatedCost: item.system.technology.cost // Initial cost
            };
            basketItem.calculatedCost = this.calculateCost(basketItem);
            this.basketItems.push(basketItem);
        }
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
            return total + (baseAvailability * (item.selectedRating || 1));
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
}