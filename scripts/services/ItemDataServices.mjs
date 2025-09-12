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
     * Gets a categorized list of items filtered by a specific shop's inventory.
     * @param {string} shopActorUuid The UUID of the shop actor.
     * @returns {Promise<object>} A categorized object of items (`itemsByType` format).
     */
    async getShopItems(shopActorUuid) {
        const shopActor = await fromUuid(shopActorUuid);
        if (!shopActor?.system?.shop?.inventory) return {};

        const allIndexedItems = this.getItems();
        const shopItemUuids = new Set(
            Object.values(shopActor.system.shop.inventory).map(item => item.itemUuid)
        );
        const sourceItems = allIndexedItems.filter(item => shopItemUuids.has(item.uuid));

        const getItemsByType = (type) => sourceItems.filter(i => i.type === type);
        const getItemsByCategory = (type, cat) => sourceItems.filter(i => i.type === type && i.system.category === cat);
        const getModificationsByType = (modType) => 
            sourceItems.filter(i => i.type === "modification" && i.system.type === modType);

        return {
            filteredItems: { label: "SR5Marketplace.Marketplace.ItemTypes.AllItems", items: sourceItems },
            rangedWeapons: { label: "SR5Marketplace.Marketplace.ItemTypes.RangedWeapons", items: getItemsByCategory("weapon", "range") },
            meleeWeapons: { label: "SR5Marketplace.Marketplace.ItemTypes.MeleeWeapons", items: getItemsByCategory("weapon", "melee") },
            weaponMods: { label: "SR5Marketplace.Marketplace.ItemTypes.WeaponMods", items: getModificationsByType("weapon") },
            armorMods: { label: "SR5Marketplace.Marketplace.ItemTypes.ArmorMods", items: getModificationsByType("armor") },
            vehicleMods: { label: "SR5Marketplace.Marketplace.ItemTypes.VehicleMods", items: getModificationsByType("vehicle") },
            armor: { label: "SR5Marketplace.Marketplace.ItemTypes.Armor", items: getItemsByType("armor") },
            cyberware: { label: "SR5Marketplace.Marketplace.ItemTypes.Cyberware", items: getItemsByType("cyberware") },
            bioware: { label: "SR5Marketplace.Marketplace.ItemTypes.Bioware", items: getItemsByType("bioware") },
            devices: { label: "SR5Marketplace.Marketplace.ItemTypes.Devices", items: getItemsByType("device") },
            equipment: { label: "SR5Marketplace.Marketplace.ItemTypes.Equipment", items: getItemsByType("equipment") },
            spells: {label: "SR5Marketplace.Marketplace.ItemTypes.Spells", items: getItemsByType("spell")},
            metamagic: {label: "SR5Marketplace.Marketplace.ItemTypes.Metamagic", items: getItemsByType("metamagic")},
            adeptPower: {label: "SR5Marketplace.Marketplace.ItemTypes.AdeptPowers", items: getItemsByType("adept_power")},
            echo: {label: "SR5Marketplace.Marketplace.ItemTypes.Echo", items: getItemsByType("echo")},
            qualitys: {label: "SR5Marketplace.Marketplace.ItemTypes.Qualitys", items: getItemsByType("quality")},
            complex_form: {label: "SR5Marketplace.Marketplace.ItemTypes.complex_form", items: getItemsByType("complex_form")},
        };
    }

    /**
     * Getter that organizes items by type for UI rendering.
     */
    get itemsByType() {
        const allItems = this.getItems();
        
        // Filter out excluded items before categorizing
        const filteredItems = allItems.filter(item => 
            !["call_in_action", "critter_power", "host", "sprite_power", "contact"].includes(item.type)
        );

        // Helper functions that now correctly operate on the filtered list
        const getItemsByType = (type) => filteredItems.filter(i => i.type === type);
        const getItemsByCategory = (type, cat) => filteredItems.filter(i => i.type === type && i.system.category === cat);
        
        const getModificationsByType = (modType) => 
            filteredItems.filter(i => i.type === "modification" && i.system.type === modType);

        return {
            filteredItems: { label: "SR5Marketplace.Marketplace.ItemTypes.AllItems", items: filteredItems },
            rangedWeapons: { label: "SR5Marketplace.Marketplace.ItemTypes.RangedWeapons", items: getItemsByCategory("weapon", "range") },
            meleeWeapons: { label: "SR5Marketplace.Marketplace.ItemTypes.MeleeWeapons", items: getItemsByCategory("weapon", "melee") },

            weaponMods: { label: "SR5Marketplace.Marketplace.ItemTypes.WeaponMods", items: getModificationsByType("weapon") },
            armorMods: { label: "SR5Marketplace.Marketplace.ItemTypes.ArmorMods", items: getModificationsByType("armor") },
            vehicleMods: { label: "SR5Marketplace.Marketplace.ItemTypes.VehicleMods", items: getModificationsByType("vehicle") },

            armor: { label: "SR5Marketplace.Marketplace.ItemTypes.Armor", items: getItemsByType("armor") },
            cyberware: { label: "SR5Marketplace.Marketplace.ItemTypes.Cyberware", items: getItemsByType("cyberware") },
            bioware: { label: "SR5Marketplace.Marketplace.ItemTypes.Bioware", items: getItemsByType("bioware") },
            devices: { label: "SR5Marketplace.Marketplace.ItemTypes.Devices", items: getItemsByType("device") },
            equipment: { label: "SR5Marketplace.Marketplace.ItemTypes.Equipment", items: getItemsByType("equipment") },
            spells: {label: "SR5Marketplace.Marketplace.ItemTypes.Spells", items: getItemsByType("spell")},
            metamagic: {label: "SR5Marketplace.Marketplace.ItemTypes.Metamagic", items: getItemsByType("metamagic")},
            adeptPower: {label: "SR5Marketplace.Marketplace.ItemTypes.AdeptPowers", items: getItemsByType("adept_power")},
            echo: {label: "SR5Marketplace.Marketplace.ItemTypes.Echo", items: getItemsByType("echo")},
            qualitys: {label: "SR5Marketplace.Marketplace.ItemTypes.Qualitys", items: getItemsByType("qualitys")},
            complex_form: {label: "SR5Marketplace.Marketplace.ItemTypes.complex_form", items: getItemsByType("complex_form")}
        };
    }
    // ... inside the ItemDataServices class ...

    /**
     * Getter that returns a categorized list of ONLY non-modification items.
     * Ideal for the Item Builder's main selector.
     */
    get baseItemsByType() {
        const allItems = this.getItems();
        
        // 1. Filter out unwanted types AND all modifications.
        const baseItems = allItems.filter(item => 
            !["modification", "call_in_action", "critter_power", "host", "sprite_power", "contact"].includes(item.type)
        );

        // 2. Run categorization logic ONLY on the base items.
        const getItemsByType = (type) => baseItems.filter(i => i.type === type);
        const getItemsByCategory = (type, cat) => baseItems.filter(i => i.type === type && i.system.category === cat);

        return {
            filteredItems: { label: "SR5Marketplace.Marketplace.ItemTypes.AllItems", items: baseItems },
            rangedWeapons: { label: "SR5Marketplace.Marketplace.ItemTypes.RangedWeapons", items: getItemsByCategory("weapon", "range") },
            meleeWeapons: { label: "SR5Marketplace.Marketplace.ItemTypes.MeleeWeapons", items: getItemsByCategory("weapon", "melee") },
            armor: { label: "SR5Marketplace.Marketplace.ItemTypes.Armor", items: getItemsByType("armor") },
            cyberware: { label: "SR5Marketplace.Marketplace.ItemTypes.Cyberware", items: getItemsByType("cyberware") },
            bioware: { label: "SR5Marketplace.Marketplace.ItemTypes.Bioware", items: getItemsByType("bioware") },
            devices: { label: "SR5Marketplace.Marketplace.ItemTypes.Devices", items: getItemsByType("device") },
            equipment: { label: "SR5Marketplace.Marketplace.ItemTypes.Equipment", items: getItemsByType("equipment") },
            spells: {label: "SR5Marketplace.Marketplace.ItemTypes.Spells", items: getItemsByType("spell")},
            metamagic: {label: "SR5Marketplace.Marketplace.ItemTypes.Metamagic", items: getItemsByType("metamagic")},
            adeptPower: {label: "SR5Marketplace.Marketplace.ItemTypes.AdeptPowers", items: getItemsByType("adept_power")},
            echo: {label: "SR5Marketplace.Marketplace.ItemTypes.Echo", items: getItemsByType("echo")},
            qualitys: {label: "SR5Marketplace.Marketplace.ItemTypes.Qualitys", items: getItemsByType("qualitys")},
            complex_form: {label: "SR5Marketplace.Marketplace.ItemTypes.complex_form", items: getItemsByType("complex_form")}
        };
    }

    /**
     * Getter that returns a categorized list of ONLY modification items.
     * Ideal for the Item Builder's modification selector.
     */
    get modificationsByType() {
        const allItems = this.getItems();
        
        // 1. Filter for ONLY modifications.
        const allModifications = allItems.filter(item => item.type === "modification");

        // 2. Categorize modifications by their specific type (weapon, armor, etc.).
        const getModificationsByType = (modType) => 
            allModifications.filter(i => i.system.type === modType);

        return {
            allModifications: { label: "SR5Marketplace.Marketplace.ItemTypes.AllMods", items: allModifications },
            weaponMods: { label: "SR5Marketplace.Marketplace.ItemTypes.WeaponMods", items: getModificationsByType("weapon") },
            armorMods: { label: "SR5Marketplace.Marketplace.ItemTypes.ArmorMods", items: getModificationsByType("armor") },
            vehicleMods: { label: "SR5Marketplace.Marketplace.ItemTypes.VehicleMods", items: getModificationsByType("vehicle") },
        };
    }
}