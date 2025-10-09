/**
 * A centralized API to safely store and provide access to the SR5e system's global objects.
 * This is populated during the 'ready' hook to avoid timing issues with CONFIG.SR5.
 */
class SR5SystemAPI {
    // --- Live System Classes/Objects ---
    static tests = [];
    static ActionFlow = null;
    static documentTypes = null;
    
    // --- Raw SR5 Config Data ---
    static config = null;

    // --- Pre-localized data for direct use in templates ---
    static compendiums_l = {};
    static itemTypes_l = {};
    static attributes_l = {};
    static limits_l = {};
    static specialTypes_l = {};
    static damageTypes_l = {};
    static biofeedbackOptions_l = {};
    static weaponRangeCategories_l = {};
    static elementTypes_l = {};
    static spellCategories_l = {};
    static spellTypes_l = {};
    static spellRanges_l = {};
    static combatSpellTypes_l = {};
    static detectionSpellTypes_l = {};
    static illusionSpellTypes_l = {};
    static illusionSpellSenses_l = {};
    static attributeRolls_l = {};
    static matrixTargets_l = {};
    static gridCategories_l = {};
    static durations_l = {};
    static weaponCategories_l = {};
    static weaponCliptypes_l = {};
    static weaponRanges_l = {};
    static qualityTypes_l = {};
    static adeptPower_l = {};
    static deviceCategories_l = {};
    static cyberwareGrades_l = {};
    static knowledgeSkillCategories_l = {};
    static activeSkills_l = {};
    static actionTypes_l = {};
    static actionCategories_l = {};
    static matrixAttributes_l = {};
    static initiativeCategories_l = {};
    static modificationTypes_l = {};
    static mountPoints_l = {};
    static modificationCategories_l = {};
    static lifestyleTypes_l = {};
    static actorModifiers_l = {};
    static modifierTypes_l = {};
    static programTypes_l = {};
    static spiritTypes_l = {};
    static critterPower_l = {};
    static spriteTypes_l = {};
    static spritePower_l = {};
    static vehicle_l = {};
    static ic_l = {};
    static character_l = {};
    static rangeWeaponModeLabel_l = {};
    static wirelessModes_l = {};
    static effectApplyTo_l = {};

    /**
     * Initializes the API by capturing and processing the live SR5e objects.
     * This MUST be called from the 'ready' hook.
     */
    static async init() {
        if (game.system.id !== "shadowrun5e") {
            ui.notifications.error("SR5 Marketplace requires the Shadowrun 5e system to be active.");
            return;
        }

        // 1. Capture the live objects
        this.config = CONFIG.SR5;
        this.ActionFlow = game.shadowrun5e?.ActionFlow;
        this.documentTypes = game.system.documentTypes;
        // Correctly capture and process the tests object
        const tests = game.shadowrun5e?.tests;
        if (tests) {
            this.tests = Object.values(tests).map(test => ({
                id: test.name,
                value: game.i18n.localize(test.label)
            }));
        }

        if (!this.config) {
            console.error("SR5 Marketplace | CONFIG.SR5 was not found. Cannot initialize system API.");
            return;
        }

        // 2. Process and localize the entire config object recursively
        for (const key in this.config) {
            if (Object.hasOwnProperty.call(this.config, key)) {
                const localizedKey = `${key}_l`;
                // Check if the target property exists on our class before assigning
                if (Object.hasOwnProperty.call(this, localizedKey)) {
                    this[localizedKey] = this._localizeObject(this.config[key]);
                }
            }
        }
        
        //console.log("SR5 Marketplace | System API Initialized and data processed.", this);
    }

    /**
     * A helper function to recursively iterate over a config object and localize its string values.
     * @param {any} data The data to process.
     * @returns {any} A new object/value with strings replaced by their localizations.
     * @private
     */
    static _localizeObject(data) {
        if (typeof data === 'string') {
            return game.i18n.localize(data) || data;
        }
        if (Array.isArray(data)) {
            return data.map(item => this._localizeObject(item));
        }
        if (typeof data === 'object' && data !== null) {
            const localized = {};
            for (const [key, value] of Object.entries(data)) {
                localized[key] = this._localizeObject(value);
            }
            return localized;
        }
        // Return numbers, booleans, etc. as-is
        return data;
    }
}

// Export the class itself to be used as a static API
export const SR5_API = SR5SystemAPI;