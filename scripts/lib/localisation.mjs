import { MODULE_ID } from '../lib/constants.mjs';

/**
 * @summary A centralized service for handling all module-specific localization.
 * @description This ensures that all text is retrieved through a single, reliable point
 * and correctly prefixes keys with the module ID.
 */
export class LocalizationService {
    /**
     * Gets a localized string for the given key.
     * @param {string} key - The key for the string (e.g., "Marketplace.Time.Hours").
     * @param {object} [data={}] - Data for interpolation (e.g., { name: "Chummer" }).
     * @returns {string} The localized and formatted string.
     */
    static get(key, data = {}) {
        // Construct the full key, e.g., "SR5Marketplace.Marketplace.Time.Hours"
        const fullKey = `SR5Marketplace.${key}`;
        return game.i18n.format(fullKey, data);
    }
}