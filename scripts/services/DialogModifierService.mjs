/**
 * @typedef {object} Modifier
 * @property {string} description - The human-readable description of the modifier.
 * @property {string} value - A JSON string containing the label and numeric value for the checkbox.
 */

/**
 * @typedef {object} ModifierGroup
 * @property {string} title - The title of the modifier group (e.g., "General Modifiers").
 * @property {string} key - A unique key for the group (e.g., "general").
 * @property {Modifier[]} items - An array of modifier objects in this group.
 */

/**
 * A service to provide situational modifiers for social tests.
 */
export class DialogModifierService {
    /**
     * The complete database of all known situational modifiers, grouped by skill.
     * @type {Object.<string, ModifierGroup>}
     * @private
     */
    static #MODIFIER_DATABASE = {
        general: {
            title: "SR5.Marketplace.Modifiers.General.title",
            items: [
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeFriendly", value: '{ "label": "Friendly", "value": 2 }' },
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeNeutral", value: '{ "label": "Neutral", "value": 0 }' },
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeMistrustful", value: '{ "label": "Mistrustful", "value": -1 }' },
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeBiased", value: '{ "label": "Biased", "value": -2 }' },
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeAverse", value: '{ "label": "Averse", "value": -3 }' },
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeHostile", value: '{ "label": "Hostile", "value": -4 }' },
                { description: "SR5.Marketplace.Modifiers.General.resultAdvantageous", value: '{ "label": "Advantageous", "value": 1 }' },
                { description: "SR5.Marketplace.Modifiers.General.resultInsignificant", value: '{ "label": "Insignificant", "value": 0 }' },
                { description: "SR5.Marketplace.Modifiers.General.resultAnnoying", value: '{ "label": "Annoying", "value": -1 }' },
                { description: "SR5.Marketplace.Modifiers.General.resultDangerous", value: '{ "label": "Dangerous", "value": -3 }' },
                { description: "SR5.Marketplace.Modifiers.General.resultCatastrophic", value: '{ "label": "Catastrophic", "value": -4 }' },
            ]
        },
        negotiation: {
            title: "SR5.Marketplace.Modifiers.Negotiation.title",
            items: [
                { description: "SR5.Marketplace.Modifiers.Negotiation.notEnoughInfo", value: '{ "label": "Insufficient Info", "value": -2 }' },
                { description: "SR5.Marketplace.Modifiers.Negotiation.hasLeverage", value: '{ "label": "Leverage", "value": 2 }' }
            ]
        },
        etiquette: {
            title: "SR5.Marketplace.Modifiers.Etiquette.title",
            items: [
                { description: "SR5.Marketplace.Modifiers.Etiquette.improperlyDressed", value: '{ "label": "Improperly Dressed", "value": -2 }' },
                { description: "SR5.Marketplace.Modifiers.Etiquette.obviouslyNervous", value: '{ "label": "Nervous", "value": -2 }' }
            ]
        },
        intimidation: {
            title: "SR5.Marketplace.Modifiers.Intimidation.title",
            items: [
                { description: "SR5.Marketplace.Modifiers.Intimidation.physicallyImposing", value: '{ "label": "Physically Imposing", "value": 2 }' },
                { description: "SR5.Marketplace.Modifiers.Intimidation.outnumbered", value: '{ "label": "Outnumbered", "value": -2 }' },
                { description: "SR5.Marketplace.Modifiers.Intimidation.hasWeapon", value: '{ "label": "Has Weapon/Magic", "value": 2 }' },
            ]
        },
        con: {
            title: "SR5.Marketplace.Modifiers.Con.title",
            items: [
                { description: "SR5.Marketplace.Modifiers.Con.plausibleEvidence", value: '{ "label": "Plausible Evidence", "value": 2 }' },
                { description: "SR5.Marketplace.Modifiers.Con.targetDistracted", value: '{ "label": "Target Distracted", "value": 1 }' },
            ]
        }
        // Add other skill groups like 'leadership' here if needed.
    };

    /**
     * Gets a list of relevant modifier groups for a given test context.
     * @param {object} context - The context of the test.
     * @param {string} context.selectedSkill - The skill ID (e.g., 'negotiation').
     * @returns {ModifierGroup[]} An array of modifier groups to be rendered.
     */
    static getModifiersForTest({ selectedSkill }) {
        const groups = [this.#MODIFIER_DATABASE.general]; // Always include general modifiers.

        // Add the skill-specific group if it exists in our database.
        if (selectedSkill && this.#MODIFIER_DATABASE[selectedSkill]) {
            groups.push(this.#MODIFIER_DATABASE[selectedSkill]);
        }

        return groups;
    }
}