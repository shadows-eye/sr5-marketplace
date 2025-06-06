// Import necessary dependencies
export default class ItemDataServices {
    constructor() {
        this.items = [];
        this.excludedItems = [];
        this.filteredItems = [];
    }

    /**
     * Fetch items from the world and compendiums, filter them, and prepare them for the UI.
     */
    async fetchItems() {
        const worldItems = game.items.contents.filter(item => !item.name.includes('#[CF_tempEntity]'));
        const compendiumItems = [];

        for (let pack of game.packs) {
            if (pack.metadata.type === "Item") {
                const content = await pack.getDocuments();
                compendiumItems.push(...content.filter(item => !item.name.includes('#[CF_tempEntity]')));
            }
        }

        // Merge and filter items
        this.items = [...worldItems, ...compendiumItems].filter(item => !["contact"].includes(item.type));

        // Separate excluded items
        this.excludedItems = this.items.filter(item =>
            ["adept_power", "call_in_action", "critter_power", "echo", "host", "metamagic", "sprite_power"].includes(item.type)
        );

        this.filteredItems = this.items.filter(item =>
            !["adept_power", "call_in_action", "critter_power", "echo", "host", "metamagic", "sprite_power"].includes(item.type)
        );
    }

    /**
     * Organize items by type for UI rendering.
     */
    get itemsByType() {
        const categories = {
            rangedWeapons: { label: "SR5.Marketplace.ItemTypes.RangedWeapons", items: this.getItemsByCategory("weapon", "range") },
            meleeWeapons: { label: "SR5.Marketplace.ItemTypes.MeleeWeapons", items: this.getItemsByCategory("weapon", "melee") },
            armor: { label: "SR5.Marketplace.ItemTypes.Armor", items: this.getItemsByType("armor") },
            cyberware: { label: "SR5.Marketplace.ItemTypes.Cyberware", items: this.getItemsByType("cyberware") },
            bioware: { label: "SR5.Marketplace.ItemTypes.Bioware", items: this.getItemsByType("bioware") },
            devices: { label: "SR5.Marketplace.ItemTypes.Devices", items: this.getItemsByType("device") },
            equipment: { label: "SR5.Marketplace.ItemTypes.Equipment", items: this.getItemsByType("equipment") },
            spells: {label: "SR5.Marketplace.ItemTypes.Spells", items: this.getItemsByType("spell")},
            qualitys: {label: "SR5.Marketplace.ItemTypes.Qualitys", items: this.getItemsByType("qualitys")},
            complex_form: {label: "SR5.Marketplace.ItemTypes.complex_form", items: this.getItemsByType("complex_form")},
        };
        return categories;
    }

    getItemsByType(type) {
        return this.items.filter(item => item.type === type);
    }

    getItemsByCategory(type, category) {
        return this.items.filter(item => item.type === type && item.system.category === category);
    }
    /**
     * Calculate the total cost, weight, or other metrics for items in the basket.
     * @param {Array} basket - The array of items in the basket.
     * @returns {Object} - An object containing calculated totals (e.g., cost, weight).
     */
    calculateBasketTotals(basket) {
        return basket.reduce(
            (totals, item) => {
                const quantity = item.buyQuantity || 1; // Default quantity to 1 if not set
                const rating = item.selectedRating || 1; // Default rating to 1 if not set

                // Calculate cost
                const cost = item.system?.technology?.cost || 0;
                totals.cost += cost * quantity * rating;

                // Calculate weight (if applicable)
                const weight = item.system?.technology?.weight || 0;
                totals.weight += weight * quantity;

                return totals;
            },
            { cost: 0, weight: 0 } // Initial totals
        );
    }

}