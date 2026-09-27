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
    static SETTING_CUSTOM_ITEM_COMPENDIUM = "customItemCompendium";
    static SETTING_CUSTOM_VEHICLE_COMPENDIUM = "customVehicleCompendium";

    /**
     * Retrieves the configured compendium collection ID for custom items, or "world".
     * @returns {string}
     */
    static getCustomItemCompendium() {
        if (typeof game === "undefined" || !game.settings) return "world";
        try {
            return game.settings.get("sr5-marketplace", this.SETTING_CUSTOM_ITEM_COMPENDIUM) || "world";
        } catch (err) {
            return "world";
        }
    }

    /**
     * Sets the target compendium for custom items.
     * @param {string} collectionId
     * @returns {Promise<void>}
     */
    /**
     * Sets the target compendium for custom items.
     * @param {string} collectionId
     * @returns {Promise<void>}
     */
    static async setCustomItemCompendium(collectionId) {
        if (!game.settings || !game.user?.isGM) return;
        const targetId = collectionId || "world";
        await game.settings.set("sr5-marketplace", this.SETTING_CUSTOM_ITEM_COMPENDIUM, targetId);
        if (targetId !== "world" && typeof game !== "undefined" && game.packs) {
            const pack = game.packs.get(targetId);
            if (pack?.locked) {
                try {
                    await pack.configure({ locked: false });
                    console.log(`SR5 Marketplace | Automatically unlocked compendium: ${pack.metadata.label}`);
                } catch (err) {
                    console.warn(`SR5 Marketplace | Could not unlock compendium ${targetId}:`, err);
                }
            }
        }
        this.invalidateItemCache();
    }

    /**
     * Retrieves the configured compendium collection ID for custom vehicles, or "world".
     * @returns {string}
     */
    static getCustomVehicleCompendium() {
        if (typeof game === "undefined" || !game.settings) return "world";
        try {
            return game.settings.get("sr5-marketplace", this.SETTING_CUSTOM_VEHICLE_COMPENDIUM) || "world";
        } catch (err) {
            return "world";
        }
    }

    /**
     * Sets the target compendium for custom vehicles.
     * @param {string} collectionId
     * @returns {Promise<void>}
     */
    static async setCustomVehicleCompendium(collectionId) {
        if (!game.settings || !game.user?.isGM) return;
        const targetId = collectionId || "world";
        await game.settings.set("sr5-marketplace", this.SETTING_CUSTOM_VEHICLE_COMPENDIUM, targetId);
        if (targetId !== "world" && typeof game !== "undefined" && game.packs) {
            const pack = game.packs.get(targetId);
            if (pack?.locked) {
                try {
                    await pack.configure({ locked: false });
                    console.log(`SR5 Marketplace | Automatically unlocked compendium: ${pack.metadata.label}`);
                } catch (err) {
                    console.warn(`SR5 Marketplace | Could not unlock compendium ${targetId}:`, err);
                }
            }
        }
        this.invalidateItemCache();
    }

    /**
     * Returns a map of choices for custom item compendiums (World Directory + Item compendiums).
     * @returns {Record<string, string>}
     */
    static getItemCompendiumChoices() {
        const defaultLabel = game.i18n?.localize("SR5Marketplace.CompendiumSettings.WorldDirectory") || "World Directory (Default)";
        const choices = { "world": defaultLabel };
        if (typeof game !== "undefined" && game.packs) {
            for (const pack of game.packs) {
                if (pack.metadata.type === "Item") {
                    choices[pack.collection] = `${pack.metadata.label} (${pack.collection})`;
                }
            }
        }
        return choices;
    }

    /**
     * Returns a map of choices for custom vehicle compendiums (World Directory + Actor compendiums).
     * @returns {Record<string, string>}
     */
    static getVehicleCompendiumChoices() {
        const defaultLabel = game.i18n?.localize("SR5Marketplace.CompendiumSettings.WorldDirectory") || "World Directory (Default)";
        const choices = { "world": defaultLabel };
        if (typeof game !== "undefined" && game.packs) {
            for (const pack of game.packs) {
                if (pack.metadata.type === "Actor") {
                    choices[pack.collection] = `${pack.metadata.label} (${pack.collection})`;
                }
            }
        }
        return choices;
    }

    /**
     * Refreshes the choices map on the registered game settings dynamically.
     */
    static updateCompendiumSettingChoices() {
        if (typeof game === "undefined" || !game.settings?.settings) return;
        const itemSetting = game.settings.settings.get("sr5-marketplace.customItemCompendium");
        if (itemSetting) {
            itemSetting.choices = this.getItemCompendiumChoices();
        }
        const vehicleSetting = game.settings.settings.get("sr5-marketplace.customVehicleCompendium");
        if (vehicleSetting) {
            vehicleSetting.choices = this.getVehicleCompendiumChoices();
        }
    }

    /**
     * Retrieves the set of explicitly allowed compendium collection IDs.
     * Returns null if no restriction is active (i.e. all visible compendiums allowed).
     * Returns Set<string> (including an empty set) when configured.
     * @returns {Set<string>|null}
     */
    static getAllowedCompendiums() {
        if (typeof game === "undefined" || !game.settings) return null;
        try {
            const raw = game.settings.get("sr5-marketplace", this.SETTING_ALLOWED_COMPENDIUMS);
            if (Array.isArray(raw)) {
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
        // Always allow the configured custom save destinations
        const customItemPack = this.getCustomItemCompendium();
        if (customItemPack && customItemPack !== "world" && customItemPack === collectionId) return true;
        const customVehiclePack = this.getCustomVehicleCompendium();
        if (customVehiclePack && customVehiclePack !== "world" && customVehiclePack === collectionId) return true;

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
     * Helper to invalidate the global items cache and re-render open marketplace if active.
     */
    static invalidateItemCache() {
        if (game.sr5marketplace?.api?.itemData?.invalidateCache) {
            game.sr5marketplace.api.itemData.invalidateCache();
        }
        const openMarketplace = foundry.applications?.instances?.get("inGameMarketplace");
        if (openMarketplace?.rendered) {
            openMarketplace.render(true);
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

    /**
     * Saves or updates an item document according to the custom compendium settings.
     * @param {object} itemData The data representing the item.
     * @param {object} [options]
     * @param {boolean} [options.notify=false] Whether to trigger UI notifications.
     * @param {string} [options.existingUuid=null] UUID of the source item.
     * @returns {Promise<Item|null>}
     */
    static async saveOrUpdateItem(itemData, { notify = false, existingUuid = null } = {}) {
        if (!itemData) return null;
        const targetId = this.getCustomItemCompendium();
        let targetPack = null;
        if (targetId && targetId !== "world" && typeof game !== "undefined" && game.packs) {
            targetPack = game.packs.get(targetId);
            if (targetPack?.locked) {
                try {
                    await targetPack.configure({ locked: false });
                    console.log(`SR5 Marketplace | Automatically unlocked compendium on save: ${targetPack.metadata.label}`);
                } catch (err) {
                    console.warn(`SR5 Marketplace | Failed to unlock compendium ${targetPack.metadata.label}:`, err);
                }
            }
            if (targetPack?.locked) {
                if (notify) {
                    const warnMsg = game.i18n?.format("SR5Marketplace.CompendiumSettings.PackLockedWarning", { name: targetPack.metadata.label })
                        || `Target compendium "${targetPack.metadata.label}" is locked. Saving to World directory instead.`;
                    ui.notifications?.warn(warnMsg);
                }
                targetPack = null;
            }
        }

        const lookupUuid = existingUuid || itemData.uuid;
        const existingItem = lookupUuid ? await fromUuid(lookupUuid).catch(() => null) : null;
        const canUpdateExisting = existingItem && existingItem.isOwner && !existingItem.compendium?.locked && (
            (targetPack && existingItem.pack === targetPack.collection) ||
            (!targetPack && !existingItem.pack)
        );

        let savedDoc = null;
        if (canUpdateExisting) {
            savedDoc = await existingItem.update(itemData);
            if (notify) {
                const locName = targetPack ? targetPack.metadata.label : (game.i18n?.localize("SR5Marketplace.CompendiumSettings.WorldDirectory") || "World directory");
                ui.notifications?.info(`Item "${savedDoc.name}" was successfully updated in ${locName}.`);
            }
        } else {
            const clone = foundry.utils.deepClone(itemData);
            delete clone._id;
            delete clone._stats;
            if (targetPack) {
                savedDoc = await Item.create(clone, { pack: targetPack.collection });
                if (notify) {
                    ui.notifications?.info(`Item "${savedDoc.name}" was successfully saved to compendium "${targetPack.metadata.label}".`);
                }
            } else {
                savedDoc = await Item.create(clone);
                if (notify) {
                    ui.notifications?.info(`Item "${savedDoc.name}" was successfully created in the World directory.`);
                }
            }
        }

        return savedDoc;
    }

    /**
     * Saves or updates a vehicle actor according to the custom compendium settings.
     * @param {object} vehicleData The data representing the vehicle actor.
     * @param {object} [options]
     * @param {boolean} [options.notify=false] Whether to trigger UI notifications.
     * @param {string} [options.existingUuid=null] UUID of the source vehicle.
     * @param {string} [options.userId=null] Requesting user ID for non-GM creation.
     * @returns {Promise<Actor|null>}
     */
    static async saveOrUpdateVehicle(vehicleData, { notify = false, existingUuid = null, userId = null } = {}) {
        if (!vehicleData) return null;
        const targetId = this.getCustomVehicleCompendium();
        let targetPack = null;
        if (targetId && targetId !== "world" && typeof game !== "undefined" && game.packs) {
            targetPack = game.packs.get(targetId);
            if (targetPack?.locked) {
                try {
                    await targetPack.configure({ locked: false });
                    console.log(`SR5 Marketplace | Automatically unlocked compendium on save: ${targetPack.metadata.label}`);
                } catch (err) {
                    console.warn(`SR5 Marketplace | Failed to unlock compendium ${targetPack.metadata.label}:`, err);
                }
            }
            if (targetPack?.locked) {
                if (notify) {
                    const warnMsg = game.i18n?.format("SR5Marketplace.CompendiumSettings.PackLockedWarning", { name: targetPack.metadata.label })
                        || `Target compendium "${targetPack.metadata.label}" is locked. Saving to World directory instead.`;
                    ui.notifications?.warn(warnMsg);
                }
                targetPack = null;
            }
        }

        const lookupUuid = existingUuid || vehicleData.uuid;
        const existingActor = lookupUuid ? await fromUuid(lookupUuid).catch(() => null) : null;
        const canUpdateExisting = existingActor && existingActor.isOwner && !existingActor.compendium?.locked && (
            (targetPack && existingActor.pack === targetPack.collection) ||
            (!targetPack && !existingActor.pack)
        );

        let savedDoc = null;
        if (canUpdateExisting) {
            savedDoc = await existingActor.update(vehicleData);
            if (notify) {
                const locName = targetPack ? targetPack.metadata.label : (game.i18n?.localize("SR5Marketplace.CompendiumSettings.WorldDirectory") || "World directory");
                ui.notifications?.info(`Vehicle "${savedDoc.name}" was successfully updated in ${locName}.`);
            }
        } else if (game.user?.isGM) {
            const clone = foundry.utils.deepClone(vehicleData);
            delete clone._id;
            delete clone._stats;
            if (targetPack) {
                savedDoc = await Actor.create(clone, { pack: targetPack.collection });
                if (notify) {
                    ui.notifications?.info(`Vehicle "${savedDoc.name}" was successfully saved to compendium "${targetPack.metadata.label}".`);
                }
            } else {
                savedDoc = await Actor.create(clone);
                if (notify) {
                    ui.notifications?.info(`Vehicle "${savedDoc.name}" was successfully created in the World directory.`);
                }
            }
        } else {
            // Non-GM request to GM via socket
            game.socket.emit(`module.sr5-marketplace`, {
                action: "create_actor",
                actorData: vehicleData,
                targetPack: targetPack ? targetPack.collection : null,
                userId: userId || game.user.id
            });
            if (notify) {
                ui.notifications?.info(`Request sent to GM to create vehicle "${vehicleData.name}".`);
            }
        }

        return savedDoc;
    }
}

