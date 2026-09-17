/**
 * Service managing global marketplace settings:
 * - Allowed compendiums filtering for players and GM
 * - Local World item inclusion toggle
 * - Saved global default search filter tags
 */
export class MarketplaceSettingsService {
    static SETTING_ALLOWED_COMPENDIUMS = "allowedCompendiums";
    static SETTING_ALLOW_WORLD_ITEMS = "allowWorldItemsInMarket";
    static SETTING_GLOBAL_FILTER_TAGS = "globalDefaultFilterTags";

    /**
     * Retrieves the set of explicitly allowed compendium collection IDs.
     * Returns null if no restriction is active (i.e. all visible compendiums allowed).
     * @returns {Set<string>|null}
     */
    static getAllowedCompendiums() {
        if (typeof game === "undefined" || !game.settings) return null;
        try {
            const raw = game.settings.get("sr5-marketplace", this.SETTING_ALLOWED_COMPENDIUMS);
            if (Array.isArray(raw) && raw.length > 0) {
                return new Set(raw);
            }
        } catch (err) {
            console.warn("MarketplaceSettingsService | Error reading allowedCompendiums:", err);
        }
        return null; // All compendiums allowed by default
    }

    /**
     * Determines whether a specific compendium pack is allowed in standard indexing.
     * @param {string} collectionId The collection identifier (e.g. "shadowrun5e.items")
     * @returns {boolean}
     */
    static isCompendiumAllowed(collectionId) {
        if (!collectionId) return false;
        const allowedSet = this.getAllowedCompendiums();
        if (!allowedSet) return true; // Default: all allowed
        return allowedSet.has(collectionId);
    }

    /**
     * Persists the list of allowed compendiums and invalidates the item cache.
     * @param {Array<string>} collectionIds 
     * @returns {Promise<void>}
     */
    static async setAllowedCompendiums(collectionIds) {
        if (!game.settings) return;
        const ids = Array.isArray(collectionIds) ? collectionIds : [];
        await game.settings.set("sr5-marketplace", this.SETTING_ALLOWED_COMPENDIUMS, ids);
        
        // Invalidate index cache so marketplace updates dynamically
        this.invalidateItemCache();
    }

    /**
     * Checks if local World items are allowed to appear in the global marketplace.
     * @returns {boolean}
     */
    static isWorldItemsAllowed() {
        if (typeof game === "undefined" || !game.settings) return true;
        try {
            return Boolean(game.settings.get("sr5-marketplace", this.SETTING_ALLOW_WORLD_ITEMS));
        } catch (err) {
            return true;
        }
    }

    /**
     * Toggles whether local World items appear in the global marketplace.
     * @param {boolean} allowed 
     * @returns {Promise<void>}
     */
    static async setWorldItemsAllowed(allowed) {
        if (!game.settings) return;
        await game.settings.set("sr5-marketplace", this.SETTING_ALLOW_WORLD_ITEMS, Boolean(allowed));
        this.invalidateItemCache();
    }

    /**
     * Retrieves saved global default filter tags.
     * @returns {Array<string>}
     */
    static getGlobalDefaultFilterTags() {
        if (typeof game === "undefined" || !game.settings) return [];
        try {
            const tags = game.settings.get("sr5-marketplace", this.SETTING_GLOBAL_FILTER_TAGS);
            return Array.isArray(tags) ? tags : [];
        } catch (err) {
            return [];
        }
    }

    /**
     * Persists global default filter tags.
     * @param {Array<string>} tags 
     * @returns {Promise<void>}
     */
    static async setGlobalDefaultFilterTags(tags) {
        if (!game.settings) return;
        const cleanTags = Array.isArray(tags) ? tags.map(t => String(t).trim().toLowerCase()).filter(Boolean) : [];
        await game.settings.set("sr5-marketplace", this.SETTING_GLOBAL_FILTER_TAGS, cleanTags);
    }

    /**
     * Helper to invalidate the global items cache.
     */
    static invalidateItemCache() {
        if (game.sr5marketplace?.api?.itemData?.invalidateCache) {
            game.sr5marketplace.api.itemData.invalidateCache();
        }
    }

    /**
     * Builds an enriched list of all visible Item and Actor compendiums with breakdown counts.
     * @returns {Promise<Array<object>>}
     */
    static async getEnrichedCompendiumList() {
        if (typeof game === "undefined" || !game.packs) return [];

        const packs = game.packs.filter(p => (p.metadata.type === "Item" || p.metadata.type === "Actor") && p.visible);
        const allowedSet = this.getAllowedCompendiums();

        const enriched = await Promise.all(packs.map(async (pack) => {
            const counts = {
                weapons: 0,
                gear: 0,
                armor: 0,
                vehicles: 0,
                total: 0
            };

            try {
                const index = await pack.getIndex({ fields: ["type", "system.type"] });
                counts.total = index.size;

                for (const entry of index) {
                    const type = entry.type;
                    if (type === "weapon") counts.weapons++;
                    else if (type === "armor") counts.armor++;
                    else if (type === "vehicle" || type === "drone") counts.vehicles++;
                    else counts.gear++;
                }
            } catch (err) {
                console.warn(`MarketplaceSettingsService | Failed to index pack ${pack.collection}:`, err);
            }

            const isActorPack = pack.metadata.type === "Actor";
            const pkg = pack.metadata.packageName || pack.metadata.package || pack.metadata.system || "system";

            return {
                id: pack.collection,
                title: pack.metadata.label || pack.collection,
                package: pkg,
                type: pack.metadata.type,
                icon: isActorPack ? "fa-solid fa-car" : "fa-solid fa-box-archive",
                locked: Boolean(pack.locked),
                counts,
                enabled: allowedSet ? allowedSet.has(pack.collection) : true
            };
        }));

        enriched.sort((a, b) => a.title.localeCompare(b.title, game.i18n.lang));
        return enriched;
    }
}
