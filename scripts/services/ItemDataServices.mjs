import { IndexService } from './IndexService.mjs';

export default class ItemDataServices {
    constructor() {
        this.items = [];
        this.isIndexed = false;
    }

    /**
     * Initializes the service by using the IndexService to build the item cache.
     * This is the method that should be called from the 'ready' hook.
     */
    async initialize() {
        if (this.isIndexed) {
            console.log("SR5 Marketplace | Items already indexed for this session.");
            return;
        }

        const indexService = new IndexService();
        this.items = await indexService.buildIndex();
        this.isIndexed = true;
    }

    /**
     * Gets the cached list of all indexed items.
     * @returns {Array<object>} An array of plain item data objects.
     */
    getItems() {
        if (!this.isIndexed) {
            console.warn("SR5 Marketplace | Item index has not been built yet. Returning empty array.");
            return [];
        }
        return this.items;
    }

    /**
     * Getter that organizes items by type for UI rendering.
     */
    get itemsByType() {
        const allItems = this.getItems();
        
        // Filter out excluded items before categorizing
        const filteredItems = allItems.filter(item => 
            !["adept_power", "call_in_action", "critter_power", "echo", "host", "metamagic", "sprite_power", "contact"].includes(item.type)
        );

        // Helper functions that now correctly operate on the filtered list
        const getItemsByType = (type) => filteredItems.filter(i => i.type === type);
        const getItemsByCategory = (type, cat) => filteredItems.filter(i => i.type === type && i.system.category === cat);

        return {
            rangedWeapons: { label: "SR5.Marketplace.ItemTypes.RangedWeapons", items: getItemsByCategory("weapon", "range") },
            meleeWeapons: { label: "SR5.Marketplace.ItemTypes.MeleeWeapons", items: getItemsByCategory("weapon", "melee") },
            armor: { label: "SR5.Marketplace.ItemTypes.Armor", items: getItemsByType("armor") },
            cyberware: { label: "SR5.Marketplace.ItemTypes.Cyberware", items: getItemsByType("cyberware") },
            bioware: { label: "SR5.Marketplace.ItemTypes.Bioware", items: getItemsByType("bioware") },
            devices: { label: "SR5.Marketplace.ItemTypes.Devices", items: getItemsByType("device") },
            equipment: { label: "SR5.Marketplace.ItemTypes.Equipment", items: getItemsByType("equipment") },
            spells: {label: "SR5.Marketplace.ItemTypes.Spells", items: getItemsByType("spell")},
            qualitys: {label: "SR5.Marketplace.ItemTypes.Qualitys", items: getItemsByType("qualitys")},
            complex_form: {label: "SR5.Marketplace.ItemTypes.complex_form", items: getItemsByType("complex_form")},
        };
    }
}