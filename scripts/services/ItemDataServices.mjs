import { IndexService } from './IndexService.mjs';

/**
 * A helper function to safely retrieve a nested property from an object using a dot-notation string.
 * @param {object} obj The object to query.
 * @param {string} path The path to the property (e.g., 'system.range.category').
 * @returns {*} The value of the property, or undefined if the path is invalid.
 */
const getNested = (obj, path) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export default class ItemDataServices {
    /**
     * A static mapping of all item categories, subcategories, and sub-subcategories.
     * This object defines the structure for how items will be organized in the UI.
     * Each level can have a `label` for display and an `items` array that will be populated.
     */
    static ITEM_CATEGORIES = {
        weapon: {
            label: "SR5Marketplace.Marketplace.ItemTypes.Weapons",
            items: [],
            subcategories: {
                range: {
                    label: "SR5Marketplace.Marketplace.ItemTypes.RangedWeapons",
                    items: [],
                    subsubcategories: {
                        taser: { label: "SR5.Weapon.Range.Category.Taser", items: [] },
                        holdOutPistol: { label: "SR5.Weapon.Range.Category.HoldOutPistol", items: [] },
                        lightPistol: { label: "SR5.Weapon.Range.Category.LightPistol", items: [] },
                        heavyPistol: { label: "SR5.Weapon.Range.Category.HeavyPistol", items: [] },
                        machinePistol: { label: "SR5.Weapon.Range.Category.MachinePistol", items: [] },
                        smg: { label: "SR5.Weapon.Range.Category.SMG", items: [] },
                        assaultRifle: { label: "SR5.Weapon.Range.Category.AssaultRifle", items: [] },
                        shotgun: { label: "SR5.Weapon.Range.Category.ShotgunSlug", items: [] },
                        sniperRifle: { label: "SR5.Weapon.Range.Category.SniperRifle", items: [] },
                        sportingRifle: { label: "SR5.Weapon.Range.Category.SportingRifle", items: [] },
                        lightMachinegun: { label: "SR5.Weapon.Range.Category.LightMachinegun", items: [] },
                        mediumHeavyMachinegun: { label: "SR5.Weapon.Range.Category.MediumHeavyMachinegun", items: [] },
                        assaultCannon: { label: "SR5.Weapon.Range.Category.AssaultCannon", items: [] },
                        grenadeLauncher: { label: "SR5.Weapon.Range.Category.GrenadeLauncher", items: [] },
                        missileLauncher: { label: "SR5.Weapon.Range.Category.MissileLauncher", items: [] },
                        bow: { label: "SR5.Weapon.Range.Category.Bow", items: [] },
                        crossbow: { label: "SR5.Weapon.Range.Category.LightCrossbow", items: [] }, // Grouping all crossbows
                        harpoonGun: { label: "SR5.Weapon.Range.Category.HarpoonGun", items: [] },
                        flamethrower: { label: "SR5.Weapon.Range.Category.Flamethrower", items: [] },
                    }
                },
                melee: {
                    label: "SR5Marketplace.Marketplace.ItemTypes.MeleeWeapons",
                    items: [],
                    subsubcategories: {
                       blades: { label: "SR5.Skill.Blades", items: [] },
                       clubs: { label: "SR5.Skill.Clubs", items: [] },
                       exotic: { label: "SR5.Skill.ExoticMelee", items: [] },
                       unarmed: { label: "SR5.Skill.UnarmedCombat", items: [] },
                    }
                },
                thrown: {
                    label: "SR5.Weapon.Category.Thrown",
                    items: [],
                    subsubcategories: {
                        throwing_weapons: { label: "SR5.Skill.ThrowingWeapons", items: [] },
                        grenade: { label: "SR5.ItemTypes.Ammo", items: [] },
                    }
                }
            }
        },
        modification: {
            label: "SR5Marketplace.Marketplace.ItemTypes.Modifications",
            items: [],
            subcategories: {
                weapon: { label: "SR5Marketplace.Marketplace.ItemTypes.WeaponMods", items: [] },
                armor: { label: "SR5Marketplace.Marketplace.ItemTypes.ArmorMods", items: [] },
                vehicle: { label: "SR5Marketplace.Marketplace.ItemTypes.VehicleMods", items: [] },
                drone: { label: "SR5.Vehicle.Drone", items: [] },
            }
        },
        spell: {
            label: "SR5Marketplace.Marketplace.ItemTypes.Spells",
            items: [],
            subcategories: {
                combat: { label: "SR5.Spell.CatCombat", items: [] },
                detection: { label: "SR5.Spell.CatDetection", items: [] },
                health: { label: "SR5.Spell.CatHealth", items: [] },
                illusion: { label: "SR5.Spell.CatIllusion", items: [] },
                manipulation: { label: "SR5.Spell.CatManipulation", items: [] },
            }
        },
        armor: { 
            label: "SR5Marketplace.Marketplace.ItemTypes.Armor", 
            items: [],
            subcategories: {
                armor: { label: 'Armor', items: [] },
                cloaks: { label: 'Cloaks', items: [] },
                clothing: { label: 'Clothing', items: [] },
                'high-fashion-armor-clothing': { label: 'High Fashion', items: [] },
                'specialty-armor': { label: 'Specialty Armor', items: [] }
            }
        },
        cyberware: { label: "SR5Marketplace.Marketplace.ItemTypes.Cyberware", items: [] },
        bioware: { label: "SR5Marketplace.Marketplace.ItemTypes.Bioware", items: [] },
        device: { 
            label: "SR5Marketplace.Marketplace.ItemTypes.Devices", 
            items: [],
            subcategories: {
                commlink: { label: "SR5.DeviceCatCommlink", items: [] },
                cyberdeck: { label: "SR5.DeviceCatCyberdeck", items: [] },
                rcc: { label: "SR5.DeviceCatRCC", items: [] },
                living_persona: { label: "SR5.LivingPersona", items: [] },
            }
        },
        equipment: { label: "SR5Marketplace.Marketplace.ItemTypes.Equipment", items: [] },
        metamagic: { label: "SR5Marketplace.Marketplace.ItemTypes.Metamagic", items: [] },
        adept_power: { label: "SR5Marketplace.Marketplace.ItemTypes.AdeptPowers", items: [] },
        echo: { label: "SR5Marketplace.Marketplace.ItemTypes.Echo", items: [] },
        quality: { label: "SR5Marketplace.Marketplace.ItemTypes.Qualitys", items: [] },
        complex_form: { label: "SR5Marketplace.Marketplace.ItemTypes.ComplexForms", items: [] },
    };
    
    /**
     * A static mapping of item types and subtypes to their representative icons.
     */
    static ITEM_TYPE_ICONS = {
        // Main Types
        armor: "modules/sr5-marketplace/assets/icons/types/armor.webp",
        device: "modules/sr5-marketplace/assets/icons/types/Kommlink.webp",
        cyberware: "modules/sr5-marketplace/assets/icons/types/scann_woman_2.webp",
        bioware: "modules/sr5-marketplace/assets/icons/types/bioware.webp",
        equipment: "modules/sr5-marketplace/assets/icons/types/kletter.webp",
        spell: "modules/sr5-marketplace/assets/icons/types/spells.webp",
        modification: "modules/sr5-marketplace/assets/icons/types/modification.webp",

        // Weapon Sub-Subtypes
        weapon: {
            lightPistol: "modules/sr5-marketplace/assets/icons/weapons/light_pistol.webp",
            heavyPistol: "modules/sr5-marketplace/assets/icons/weapons/heavy_pistol.webp",
            machinePistol: "modules/sr5-marketplace/assets/icons/weapons/machine_pistol.webp",
            smg: "modules/sr5-marketplace/assets/icons/weapons/smg.webp",
            assaultRifle: "modules/sr5-marketplace/assets/icons/weapons/StormGun.webp",
            shotgun: "modules/sr5-marketplace/assets/icons/weapons/shotgun.webp",
            sniperRifle: "modules/sr5-marketplace/assets/icons/weapons/sniper_rifle.webp",
            bow: "modules/sr5-marketplace/assets/icons/weapons/bow.webp",
            blades: "modules/sr5-marketplace/assets/icons/weapons/melee_blade.webp",
            clubs: "modules/sr5-marketplace/assets/icons/weapons/melee_club.webp",
            thrown: "modules/sr5-marketplace/assets/icons/weapons/thrown.webp",
            default: "modules/sr5-marketplace/assets/icons/weapons/light_pistol.webp"
        },
        
        default: "icons/svg/item-bag.svg"
    };

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
     * Gets a representative image for an item based on its type or subtype.
     * @param {object|null} itemData The plain data object of an item.
     * @returns {string} The path to the representative icon.
     */
    getRepresentativeImage(itemData) {
        const icons = this.constructor.ITEM_TYPE_ICONS;
        if (!itemData) return icons.default;
    
        const type = itemData.type;
        const iconMapping = icons[type];
    
        if (typeof iconMapping === 'string') {
            return iconMapping;
        }
    
        if (typeof iconMapping === 'object') {
            let subKey = null;
            if (type === 'weapon') {
                const category = itemData.system?.category;
                if (category === 'range') {
                    subKey = getNested(itemData, 'system.range.ranges.category');
                } else if (category === 'melee') {
                    // Assuming melee weapons might have a 'type' like 'blades' or 'clubs'
                    subKey = itemData.system?.type;
                } else {
                    subKey = category; // for 'thrown'
                }
            }
            // Add other complex type logic here if needed
    
            return iconMapping[subKey] || iconMapping.default || icons.default;
        }
    
        return icons.default;
    }

    /**
     * Takes a flat array of items and organizes them into the nested structure
     * defined by ITEM_CATEGORIES.
     * @param {Array<object>} items - A flat array of item data objects.
     * @returns {object} A deeply nested object with items categorized.
     * @private
     */
    _categorizeItems(items) {
        const categorized = foundry.utils.deepClone(this.constructor.ITEM_CATEGORIES);

        for (const item of items) {
            const type = item.type;
            const categoryDef = categorized[type];

            if (!categoryDef) continue;

            // Add item to the top-level category
            categoryDef.items.push(item);

            // Handle Subcategories
            if (categoryDef.subcategories) {
                // Determine the subcategory key. Default to system.category or system.type.
                let subcatKey = getNested(item, 'system.category') || getNested(item, 'system.type');
                
                // Specific logic for certain item types
                if (type === 'modification') {
                    subcatKey = getNested(item, 'system.type');
                } else if (type === 'armor') {
                    subcatKey = getNested(item, 'system.type'); // Armor subcategories are in system.type
                }


                if (subcatKey && categoryDef.subcategories[subcatKey]) {
                    const subcatDef = categoryDef.subcategories[subcatKey];
                    subcatDef.items.push(item);

                    // Handle Sub-subcategories (currently specific to weapons)
                    if (subcatDef.subsubcategories) {
                        let subsubcatKey = null;
                        if (type === 'weapon' && subcatKey === 'range') {
                           subsubcatKey = getNested(item, 'system.range.ranges.category');
                           // Simple fallback for crossbows since they have multiple categories
                           if (subsubcatKey?.toLowerCase().includes('crossbow')) subsubcatKey = 'crossbow';
                        }
                        if (type === 'weapon' && subcatKey === 'melee') {
                           subsubcatKey = getNested(item, 'system.type'); // e.g., 'blades', 'clubs'
                        }
                         if (type === 'weapon' && subcatKey === 'thrown') {
                           // differentiate grenades from knives
                           subsubcatKey = item.name.toLowerCase().includes('grenade') ? 'grenade' : 'throwing_weapons';
                        }

                        if (subsubcatKey && subcatDef.subsubcategories[subsubcatKey]) {
                            subcatDef.subsubcategories[subsubcatKey].items.push(item);
                        }
                    }
                }
            }
        }
        return categorized;
    }
    
    /**
     * Creates an enriched category object by combining a label, items, and potential subcategories.
     * @param {object|undefined} source - The categorized source object from _categorizeItems.
     * @param {string} defaultLabel - A fallback label.
     * @returns {object} An enriched object for the final output.
     * @private
     */
    _createEnrichedCategory(source, defaultLabel) {
        const category = {
            label: source?.label || defaultLabel,
            items: source?.items || []
        };
        if (source?.subcategories) {
            category.subcategories = source.subcategories;
        }
        if (source?.subsubcategories) {
            category.subsubcategories = source.subsubcategories;
        }
        return category;
    }

    /**
     * Transforms the deeply categorized item data into the flat structure required by the 'itemsByType' getter.
     * @param {object} categorized - The output from _categorizeItems.
     * @param {Array<object>} allIncludedItems - The flat list of all items being processed.
     * @returns {object} The final flat object for the UI.
     * @private
     */
    _transformToAllItems(categorized, allIncludedItems) {
        return {
            filteredItems: { label: "SR5Marketplace.Marketplace.ItemTypes.AllItems", items: allIncludedItems },

            // Enriched Base Items
            rangedWeapons: this._createEnrichedCategory(getNested(categorized, 'weapon.subcategories.range'), "SR5Marketplace.Marketplace.ItemTypes.RangedWeapons"),
            meleeWeapons: this._createEnrichedCategory(getNested(categorized, 'weapon.subcategories.melee'), "SR5Marketplace.Marketplace.ItemTypes.MeleeWeapons"),
            armor: this._createEnrichedCategory(categorized.armor, "SR5Marketplace.Marketplace.ItemTypes.Armor"),
            cyberware: this._createEnrichedCategory(categorized.cyberware, "SR5Marketplace.Marketplace.ItemTypes.Cyberware"),
            bioware: this._createEnrichedCategory(categorized.bioware, "SR5Marketplace.Marketplace.ItemTypes.Bioware"),
            devices: this._createEnrichedCategory(categorized.device, "SR5Marketplace.Marketplace.ItemTypes.Devices"),
            equipment: this._createEnrichedCategory(categorized.equipment, "SR5Marketplace.Marketplace.ItemTypes.Equipment"),
            spells: this._createEnrichedCategory(categorized.spell, "SR5Marketplace.Marketplace.ItemTypes.Spells"),
            metamagic: this._createEnrichedCategory(categorized.metamagic, "SR5Marketplace.Marketplace.ItemTypes.Metamagic"),
            adeptPower: this._createEnrichedCategory(categorized.adept_power, "SR5Marketplace.Marketplace.ItemTypes.AdeptPowers"),
            echo: this._createEnrichedCategory(categorized.echo, "SR5Marketplace.Marketplace.ItemTypes.Echo"),
            qualitys: this._createEnrichedCategory(categorized.quality, "SR5Marketplace.Marketplace.ItemTypes.Qualitys"),
            complex_form: this._createEnrichedCategory(categorized.complex_form, "SR5Marketplace.Marketplace.ItemTypes.complex_form"),

            // Enriched Modifications
            weaponMods: this._createEnrichedCategory(getNested(categorized, 'modification.subcategories.weapon'), "SR5Marketplace.Marketplace.ItemTypes.WeaponMods"),
            armorMods: this._createEnrichedCategory(getNested(categorized, 'modification.subcategories.armor'), "SR5Marketplace.Marketplace.ItemTypes.ArmorMods"),
            vehicleMods: this._createEnrichedCategory(getNested(categorized, 'modification.subcategories.vehicle'), "SR5Marketplace.Marketplace.ItemTypes.VehicleMods"),
        };
    }

    /**
     * Transforms categorized data into the flat structure for the 'baseItemsByType' getter.
     * @param {object} categorized - The output from _categorizeItems.
     * @param {Array<object>} allIncludedItems - The flat list of all base items being processed.
     * @returns {object} The final flat object for the UI.
     * @private
     */
    _transformToBaseItems(categorized, allIncludedItems) {
        const allItemsTransformed = this._transformToAllItems(categorized, allIncludedItems);
        // Simply remove the modification keys from the full structure
        delete allItemsTransformed.weaponMods;
        delete allItemsTransformed.armorMods;
        delete allItemsTransformed.vehicleMods;
        // The top-level key should be for all *base* items
        allItemsTransformed.filteredItems.items = allIncludedItems;
        return allItemsTransformed;
    }
    
    /**
     * Transforms categorized data into the flat structure for the 'modificationsByType' getter.
     * @param {object} categorized - The output from _categorizeItems.
     * @param {Array<object>} allIncludedItems - The flat list of all modification items being processed.
     * @returns {object} The final flat object for the UI.
     * @private
     */
    _transformToModifications(categorized, allIncludedItems) {
        return {
            allModifications: this._createEnrichedCategory(categorized.modification, "SR5Marketplace.Marketplace.ItemTypes.AllMods"),
            weaponMods: this._createEnrichedCategory(getNested(categorized, 'modification.subcategories.weapon'), "SR5Marketplace.Marketplace.ItemTypes.WeaponMods"),
            armorMods: this._createEnrichedCategory(getNested(categorized, 'modification.subcategories.armor'), "SR5Marketplace.Marketplace.ItemTypes.ArmorMods"),
            vehicleMods: this._createEnrichedCategory(getNested(categorized, 'modification.subcategories.vehicle'), "SR5Marketplace.Marketplace.ItemTypes.VehicleMods"),
        };
    }

    /**
     * Gets a categorized list of items filtered by a specific shop's inventory.
     * @param {string} shopActorUuid The UUID of the shop actor.
     * @returns {Promise<object>} A categorized object of items (`itemsByType` format).
     */
    async getShopItems(shopActorUuid) {
        const shopActor = await fromUuid(shopActorUuid);
        if (!shopActor?.system?.shop?.inventory) return this._transformToAllItems({}, []);

        const allIndexedItems = this.getItems();
        const shopItemUuids = new Set(
            Object.values(shopActor.system.shop.inventory).map(item => item.itemUuid)
        );
        const shopItems = allIndexedItems.filter(item => shopItemUuids.has(item.uuid));
        
        const categorized = this._categorizeItems(shopItems);
        return this._transformToAllItems(categorized, shopItems);
    }

    /**
     * Getter that organizes items by type for UI rendering, including modifications.
     */
    get itemsByType() {
        const allItems = this.getItems();
        const excludedTypes = ["call_in_action", "critter_power", "host", "sprite_power", "contact"];
        const filteredItems = allItems.filter(item => !excludedTypes.includes(item.type));

        const categorized = this._categorizeItems(filteredItems);
        return this._transformToAllItems(categorized, filteredItems);
    }

    /**
     * Getter that returns a categorized list of ONLY non-modification items.
     */
    get baseItemsByType() {
        const allItems = this.getItems();
        const excludedTypes = ["modification", "call_in_action", "critter_power", "host", "sprite_power", "contact"];
        const baseItems = allItems.filter(item => !excludedTypes.includes(item.type));

        const categorized = this._categorizeItems(baseItems);
        return this._transformToBaseItems(categorized, baseItems);
    }

    /**
     * Getter that returns a categorized list of ONLY modification items.
     */
    get modificationsByType() {
        const allItems = this.getItems();
        const allModifications = allItems.filter(item => item.type === "modification");

        const categorized = this._categorizeItems(allModifications);
        return this._transformToModifications(categorized, allModifications);
    }
}