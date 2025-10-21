/**
 * A centralized API to safely store and provide access to the SR5e system's global objects.
 * This is populated during the 'ready' hook to avoid timing issues with CONFIG.SR5.
 */
export class SR5SystemAPI {
    constructor() {
        // --- Live System Classes/Objects ---
        this.tests = [];
        this.ActionFlow = null;
        this.documentTypes = null;
        
        // --- Raw SR5 Config Data ---
        this.config = null;

        // --- Pre-localized data for direct use in templates ---
        this.compendiums_l = {};
        this.itemTypes_l = {};
        this.attributes_l = {};
        this.limits_l = {};
        this.specialTypes_l = {};
        this.damageTypes_l = {};
        this.biofeedbackOptions_l = {};
        this.weaponRangeCategories_l = {};
        this.elementTypes_l = {};
        this.spellCategories_l = {};
        this.spellTypes_l = {};
        this.spellRanges_l = {};
        this.combatSpellTypes_l = {};
        this.detectionSpellTypes_l = {};
        this.illusionSpellTypes_l = {};
        this.illusionSpellSenses_l = {};
        this.attributeRolls_l = {};
        this.matrixTargets_l = {};
        this.gridCategories_l = {};
        this.durations_l = {};
        this.weaponCategories_l = {};
        this.weaponCliptypes_l = {};
        this.weaponRanges_l = {};
        this.qualityTypes_l = {};
        this.adeptPower_l = {};
        this.deviceCategories_l = {};
        this.cyberwareGrades_l = {};
        this.knowledgeSkillCategories_l = {};
        this.activeSkills_l = {};
        this.actionTypes_l = {};
        this.actionCategories_l = {};
        this.matrixAttributes_l = {};
        this.initiativeCategories_l = {};
        this.modificationTypes_l = {};
        this.mountPoints_l = {};
        this.modificationCategories_l = {};
        this.lifestyleTypes_l = {};
        this.actorModifiers_l = {};
        this.modifierTypes_l = {};
        this.programTypes_l = {};
        this.spiritTypes_l = {};
        this.critterPower_l = {};
        this.spriteTypes_l = {};
        this.spritePower_l = {};
        this.vehicle_l = {};
        this.ic_l = {};
        this.character_l = {};
        this.rangeWeaponModeLabel_l = {};
        this.wirelessModes_l = {};
        this.effectApplyTo_l = {};
    }

    /**
     * Initializes the API by capturing and processing the live SR5e objects.
     * This MUST be called from the 'ready' hook.
     */
    async init() {
        if (game.system.id !== "shadowrun5e") {
            ui.notifications.error("SR5 Marketplace requires the Shadowrun 5e system to be active.");
            return;
        }

        // 1. Capture the live objects
        this.config = CONFIG.SR5;
        this.ActionFlow = game.shadowrun5e?.ActionFlow;
        this.documentTypes = game.system.documentTypes;
        
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
                if (Object.hasOwnProperty.call(this, localizedKey)) {
                    this[localizedKey] = this._localizeObject(this.config[key]);
                }
            }
        }
    }

    /**
     * A helper function to recursively iterate over a config object and localize its string values.
     * @param {any} data The data to process.
     * @returns {any} A new object/value with strings replaced by their localizations.
     * @private
     */
    _localizeObject(data) {
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
        return data;
    }
}