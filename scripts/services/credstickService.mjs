import { MODULE_ID } from "../lib/constants.mjs";

export const CREDSTICK_TYPES = {
    standard: { key: "standard", labelKey: "SR5Marketplace.Marketplace.Credstick.Types.standard", rating: 1, cost: 5, avail: "0", max: 5000, color: "#888888" },
    silver:   { key: "silver",   labelKey: "SR5Marketplace.Marketplace.Credstick.Types.silver",   rating: 2, cost: 20, avail: "0", max: 20000, color: "#c0c0c0" },
    gold:     { key: "gold",     labelKey: "SR5Marketplace.Marketplace.Credstick.Types.gold",     rating: 3, cost: 100, avail: "5", max: 100000, color: "#ffd700" },
    platinum: { key: "platinum", labelKey: "SR5Marketplace.Marketplace.Credstick.Types.platinum", rating: 4, cost: 500, avail: "10", max: 500000, color: "#e5e4e2" },
    ebony:    { key: "ebony",    labelKey: "SR5Marketplace.Marketplace.Credstick.Types.ebony",    rating: 5, cost: 1000, avail: "20", max: 1000000, color: "#2b2b2b" }
};

export class CredstickService {

    /**
     * Checks if an item is configured as a credstick.
     * @param {Item} item 
     * @returns {boolean}
     */
    static isCredstick(item) {
        if (!item) return false;
        const flags = item.flags?.[MODULE_ID];
        if (flags?.credstick !== undefined) {
            return !!flags.credstick;
        }
        // Fallback: check item name or category if flags are not set yet
        const name = (item.name || "").toLowerCase();
        const category = (item.system?.technology?.category || item.system?.category || "").toLowerCase();
        return name.includes("credstick") || category.includes("credstick") || category.includes("id-credsticks");
    }

    /**
     * Ensures an item has credstick configuration flags initialized when opened.
     * ONLY touches items that are actually credsticks!
     * @param {Item} item 
     * @returns {Promise<Item|void>}
     */
    static async ensureCredstickFlags(item) {
        if (!item || !item.isOwner) return;
        const isCred = this.isCredstick(item);
        if (!isCred) return;

        const flags = item.flags?.[MODULE_ID];
        if (!flags || flags.credstick === undefined) {
            const typeKey = this._inferTypeFromName(item.name) || "standard";
            const preset = CREDSTICK_TYPES[typeKey] || CREDSTICK_TYPES.standard;
            const currentValue = item.system?.technology?.cost ?? item.system?.cost ?? 0;
            
            const updateData = {
                [`flags.${MODULE_ID}`]: {
                    credstick: true,
                    credstickType: typeKey,
                    currentValue: Number(currentValue) || 0,
                    maxValue: preset.max
                }
            };

            if (item.system) {
                if (item.system.technology) {
                    updateData["system.technology.rating"] = preset.rating;
                    updateData["system.technology.cost"] = preset.cost;
                    updateData["system.technology.availability"] = preset.avail;
                }
                if ("rating" in item.system) updateData["system.rating"] = preset.rating;
                if ("cost" in item.system) updateData["system.cost"] = preset.cost;
                if ("availability" in item.system) updateData["system.availability"] = preset.avail;
            }

            return await item.update(updateData);
        }
    }

    /**
     * Retrieves the current credstick data from an item's flags.
     * @param {Item} item 
     * @returns {object}
     */
    static getCredstickData(item) {
        if (!item) {
            return { credstick: false, credstickType: "standard", currentValue: 0, maxValue: 5000, isOverCapacity: false, badgeColor: "#888888", balanceColor: "#fbbf24" };
        }
        const flags = item.flags?.[MODULE_ID] || {};
        const isCred = this.isCredstick(item);
        const typeKey = flags.credstickType || this._inferTypeFromName(item.name) || "standard";
        const preset = CREDSTICK_TYPES[typeKey] || CREDSTICK_TYPES.standard;

        let currentValue = flags.currentValue;
        if (currentValue === undefined) {
            currentValue = item.system?.technology?.cost ?? item.system?.cost ?? item.system?.nuyen ?? item.system?.value ?? 0;
        }

        const maxValue = flags.maxValue ?? preset.max;
        const numericCurrent = Number(currentValue) || 0;
        const numericMax = Number(maxValue) || preset.max;

        const isOverCapacity = numericCurrent > numericMax;
        const balanceColor = isOverCapacity ? "#ef4444" : "#fbbf24";

        return {
            credstick: isCred,
            credstickType: typeKey,
            currentValue: numericCurrent,
            maxValue: numericMax,
            preset,
            isOverCapacity,
            badgeColor: preset.color,
            balanceColor
        };
    }

    /**
     * Infers credstick type from item name if unflagged.
     * @param {string} name 
     * @returns {string}
     * @private
     */
    static _inferTypeFromName(name = "") {
        const lower = name.toLowerCase();
        if (lower.includes("ebony")) return "ebony";
        if (lower.includes("platinum")) return "platinum";
        if (lower.includes("gold")) return "gold";
        if (lower.includes("silver")) return "silver";
        if (lower.includes("credstick") || lower.includes("standard")) return "standard";
        return "standard";
    }

    /**
     * Updates an item's credstick configuration flags and technology data.
     * Automatically sets item cost, rating, and availability to preset values.
     * @param {Item} item 
     * @param {object} updates 
     * @returns {Promise<Item>}
     */
    static async updateCredstickConfig(item, updates = {}) {
        if (!item) return;

        const currentData = this.getCredstickData(item);
        const newCredstick = updates.credstick !== undefined ? !!updates.credstick : currentData.credstick;
        const newType = updates.credstickType || currentData.credstickType;
        const preset = CREDSTICK_TYPES[newType] || CREDSTICK_TYPES.standard;

        const typeChanged = updates.credstickType && updates.credstickType !== currentData.credstickType;

        const newMaxValue = updates.maxValue !== undefined ? Number(updates.maxValue) : (typeChanged ? preset.max : currentData.maxValue);
        const newCurrentValue = updates.currentValue !== undefined ? Number(updates.currentValue) : currentData.currentValue;

        const flagUpdates = {
            credstick: newCredstick,
            credstickType: newType,
            currentValue: newCurrentValue,
            maxValue: newMaxValue
        };

        const updateData = {
            [`flags.${MODULE_ID}`]: flagUpdates
        };

        // If credstick is active, automatically sync system technology rating, cost, and availability to preset values
        if (newCredstick && item.system) {
            if (item.system.technology) {
                updateData["system.technology.rating"] = preset.rating;
                updateData["system.technology.cost"] = preset.cost;
                updateData["system.technology.availability"] = preset.avail;
            }
            if ("rating" in item.system) updateData["system.rating"] = preset.rating;
            if ("cost" in item.system) updateData["system.cost"] = preset.cost;
            if ("availability" in item.system) updateData["system.availability"] = preset.avail;
        }

        return await item.update(updateData);
    }

    /**
     * Deducts an amount from a credstick item's current balance.
     * @param {Item} item 
     * @param {number} amount 
     * @returns {Promise<Item>}
     */
    static async deductCredstickFunds(item, amount) {
        if (!item) return;
        const data = this.getCredstickData(item);
        const newBalance = Math.max(0, data.currentValue - amount);
        return await this.updateCredstickConfig(item, { currentValue: newBalance });
    }
}
