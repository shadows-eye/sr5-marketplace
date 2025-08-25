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
            filteredItems: { label: "SR5.Marketplace.ItemTypes.AllItems", items: sourceItems },
            rangedWeapons: { label: "SR5.Marketplace.ItemTypes.RangedWeapons", items: getItemsByCategory("weapon", "range") },
            meleeWeapons: { label: "SR5.Marketplace.ItemTypes.MeleeWeapons", items: getItemsByCategory("weapon", "melee") },
            weaponMods: { label: "SR5.Marketplace.ItemTypes.WeaponMods", items: getModificationsByType("weapon") },
            armorMods: { label: "SR5.Marketplace.ItemTypes.ArmorMods", items: getModificationsByType("armor") },
            vehicleMods: { label: "SR5.Marketplace.ItemTypes.VehicleMods", items: getModificationsByType("vehicle") },
            armor: { label: "SR5.Marketplace.ItemTypes.Armor", items: getItemsByType("armor") },
            cyberware: { label: "SR5.Marketplace.ItemTypes.Cyberware", items: getItemsByType("cyberware") },
            bioware: { label: "SR5.Marketplace.ItemTypes.Bioware", items: getItemsByType("bioware") },
            devices: { label: "SR5.Marketplace.ItemTypes.Devices", items: getItemsByType("device") },
            equipment: { label: "SR5.Marketplace.ItemTypes.Equipment", items: getItemsByType("equipment") },
            spells: {label: "SR5.Marketplace.ItemTypes.Spells", items: getItemsByType("spell")},
            metamagic: {label: "SR5.Marketplace.ItemTypes.Metamagic", items: getItemsByType("metamagic")},
            adeptPower: {label: "SR5.Marketplace.ItemTypes.AdeptPowers", items: getItemsByType("adept_power")},
            echo: {label: "SR5.Marketplace.ItemTypes.Echo", items: getItemsByType("echo")},
            qualitys: {label: "SR5.Marketplace.ItemTypes.Qualitys", items: getItemsByType("quality")},
            complex_form: {label: "SR5.Marketplace.ItemTypes.complex_form", items: getItemsByType("complex_form")},
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
            filteredItems: { label: "SR5.Marketplace.ItemTypes.AllItems", items: filteredItems },
            rangedWeapons: { label: "SR5.Marketplace.ItemTypes.RangedWeapons", items: getItemsByCategory("weapon", "range") },
            meleeWeapons: { label: "SR5.Marketplace.ItemTypes.MeleeWeapons", items: getItemsByCategory("weapon", "melee") },

            weaponMods: { label: "SR5.Marketplace.ItemTypes.WeaponMods", items: getModificationsByType("weapon") },
            armorMods: { label: "SR5.Marketplace.ItemTypes.ArmorMods", items: getModificationsByType("armor") },
            vehicleMods: { label: "SR5.Marketplace.ItemTypes.VehicleMods", items: getModificationsByType("vehicle") },

            armor: { label: "SR5.Marketplace.ItemTypes.Armor", items: getItemsByType("armor") },
            cyberware: { label: "SR5.Marketplace.ItemTypes.Cyberware", items: getItemsByType("cyberware") },
            bioware: { label: "SR5.Marketplace.ItemTypes.Bioware", items: getItemsByType("bioware") },
            devices: { label: "SR5.Marketplace.ItemTypes.Devices", items: getItemsByType("device") },
            equipment: { label: "SR5.Marketplace.ItemTypes.Equipment", items: getItemsByType("equipment") },
            spells: {label: "SR5.Marketplace.ItemTypes.Spells", items: getItemsByType("spell")},
            metamagic: {label: "SR5.Marketplace.ItemTypes.Metamagic", items: getItemsByType("metamagic")},
            adeptPower: {label: "SR5.Marketplace.ItemTypes.AdeptPowers", items: getItemsByType("adept_power")},
            echo: {label: "SR5.Marketplace.ItemTypes.Echo", items: getItemsByType("echo")},
            qualitys: {label: "SR5.Marketplace.ItemTypes.Qualitys", items: getItemsByType("qualitys")},
            complex_form: {label: "SR5.Marketplace.ItemTypes.complex_form", items: getItemsByType("complex_form")}
        };
    }
}