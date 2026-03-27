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

    constructor() {
        this._globalItemsCache = null;
        this._indexPromise = null; 
        
        // --- NEW: Cache the heavy categorized objects ---
        this._categorizedAll = null;
        this._categorizedBase = null;
        this._categorizedMods = null;
    }

    invalidateCache() {
        if (this._globalItemsCache) {
            console.log("SR5 Marketplace | Item changes detected. Invalidating index cache.");
        }
        this._globalItemsCache = null;
        this._categorizedAll = null;
        this._categorizedBase = null;
        this._categorizedMods = null;
        this._indexPromise = null;
    }

    async buildIndex() {
        if (this._globalItemsCache) return this._globalItemsCache;
        if (this._indexPromise) return this._indexPromise;

        this._indexPromise = (async () => {
            const excludedTypes = ["call_in_action", "critter_power", "host", "sprite_power", "contact"];
            let allItems = [];

            // 1. Fetch custom items created in the local World
            for (const item of game.items.contents) {
                if (!excludedTypes.includes(item.type) && !item.name.includes('#[CF_tempEntity]')) {
                    const itemData = item.toObject(false);
                    itemData.uuid = item.uuid;
                    allItems.push(itemData);
                }
            }

            // 2. Fetch from all visible Item Compendiums
            const packs = game.packs.filter(p => p.metadata.type === "Item" && p.visible);
            for (const pack of packs) {
                const index = await pack.getIndex({
                    fields: [
                        "system.category", "system.type", "system.technology.cost", 
                        "system.technology.rating", "system.technology.availability", 
                        "system.karma", "system.essence", "system.quantity", 
                        "system.range.ranges.category"
                    ]
                });

                for (const entry of index) {
                    if (!excludedTypes.includes(entry.type) && !entry.name.includes('#[CF_tempEntity]')) {
                        entry.uuid = entry.uuid || `Compendium.${pack.collection}.${entry._id}`;
                        allItems.push(entry);
                    }
                }
            }

            // --- THE FIX: Pre-calculate and cache the heavy category objects ---
            this._globalItemsCache = allItems;
            
            const categorizedAll = this._categorizeItems(allItems);
            this._categorizedAll = this._transformToAllItems(categorizedAll, allItems);

            const baseItems = allItems.filter(item => item.type !== "modification");
            const categorizedBase = this._categorizeItems(baseItems);
            this._categorizedBase = this._transformToBaseItems(categorizedBase, baseItems);

            const modItems = allItems.filter(item => item.type === "modification");
            const categorizedMods = this._categorizeItems(modItems);
            this._categorizedMods = this._transformToModifications(categorizedMods, modItems);

            this._indexPromise = null;
            return allItems;
        })();

        return this._indexPromise;
    }

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
                        crossbow: { label: "SR5.Weapon.Range.Category.LightCrossbow", items: [] },
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
        armor: "modules/sr5-marketplace/assets/icons/types/armor.webp",
        device: "modules/sr5-marketplace/assets/icons/types/commlink.webp",
        cyberware: "modules/sr5-marketplace/assets/icons/types/cyberware.webp",
        bioware: "modules/sr5-marketplace/assets/icons/types/bioware.webp",
        equipment: "modules/sr5-marketplace/assets/icons/types/equipment.webp",
        spell: "modules/sr5-marketplace/assets/icons/types/spell.webp",
        modification: "modules/sr5-marketplace/assets/icons/types/modification.webp",
        weapon: {
            lightPistol: "modules/sr5-marketplace/assets/icons/weapons/light_pistol.webp",
            taser: "modules/sr5-marketplace/assets/icons/weapons/taser.webp",
            heavyPistol: "modules/sr5-marketplace/assets/icons/weapons/heavy_pistol.webp",
            machinePistol: "modules/sr5-marketplace/assets/icons/weapons/machine_pistol.webp",
            smg: "modules/sr5-marketplace/assets/icons/weapons/smg.webp",
            assaultRifle: "modules/sr5-marketplace/assets/icons/weapons/stormgun.webp",
            shotgun: "modules/sr5-marketplace/assets/icons/weapons/shotgun.webp",
            sniperRifle: "modules/sr5-marketplace/assets/icons/weapons/sniper_rifle.webp",
            bow: "modules/sr5-marketplace/assets/icons/weapons/bow.webp",
            blades: "modules/sr5-marketplace/assets/icons/weapons/melee_blade.webp",
            clubs: "modules/sr5-marketplace/assets/icons/weapons/melee_club.webp",
            thrown: "modules/sr5-marketplace/assets/icons/weapons/thrown.webp",
            default: "modules/sr5-marketplace/assets/icons/weapons/default.webp"
        },
        default: "modules/sr5-marketplace/assets/icons/types/equipment.webp"
    };

    /**
     * Retrieves items for the UI, pulling instantly from the pre-calculated category cache.
     */
    async fetchGlobalItems(filterType = 'all') {
        // Ensure index is built
        await this.buildIndex();

        // Immediately return the cached categorized object (0ms UI render!)
        if (filterType === 'base') return this._categorizedBase;
        if (filterType === 'modifications') return this._categorizedMods;
        return this._categorizedAll;
    }

    /**
     * Gets a categorized list of items filtered by a specific shop's inventory.
     * @param {string} shopActorUuid The UUID of the shop actor.
     * @returns {Promise<object>} A categorized object of items.
     */
    async getShopItems(shopActorUuid) {
        const shopActor = await fromUuid(shopActorUuid);
        if (!shopActor?.system?.shop?.inventory) return this._transformToAllItems({}, []);

        const shopItems = [];
        // Resolve the UUIDs from the shop's inventory into lightweight objects
        for (const invItem of Object.values(shopActor.system.shop.inventory)) {
            const item = await fromUuid(invItem.itemUuid);
            if (item) {
                const itemData = item.toObject(false);
                itemData.uuid = item.uuid;
                shopItems.push(itemData);
            }
        }
        
        const categorized = this._categorizeItems(shopItems);
        return this._transformToAllItems(categorized, shopItems);
    }

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
                    subKey = itemData.system?.type;
                } else {
                    subKey = category; // for 'thrown'
                }
            }
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

            categoryDef.items.push(item);

            if (categoryDef.subcategories) {
                let subcatKey = getNested(item, 'system.category') || getNested(item, 'system.type');
                
                if (type === 'modification') {
                    subcatKey = getNested(item, 'system.type');
                } else if (type === 'armor') {
                    subcatKey = getNested(item, 'system.type'); 
                }

                if (subcatKey && categoryDef.subcategories[subcatKey]) {
                    const subcatDef = categoryDef.subcategories[subcatKey];
                    subcatDef.items.push(item);

                    if (subcatDef.subsubcategories) {
                        let subsubcatKey = null;
                        if (type === 'weapon' && subcatKey === 'range') {
                           subsubcatKey = getNested(item, 'system.range.ranges.category');
                           if (subsubcatKey?.toLowerCase().includes('crossbow')) subsubcatKey = 'crossbow';
                        }
                        if (type === 'weapon' && subcatKey === 'melee') {
                           subsubcatKey = getNested(item, 'system.type'); 
                        }
                         if (type === 'weapon' && subcatKey === 'thrown') {
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
        delete allItemsTransformed.weaponMods;
        delete allItemsTransformed.armorMods;
        delete allItemsTransformed.vehicleMods;
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
}