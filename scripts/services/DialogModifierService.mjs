/**
 * @typedef {object} Modifier
 * @property {string} description - The localization key for the modifier's description.
 * @property {string} label - The short, non-localized label for the modifier (e.g., "Friendly").
 * @property {number} value - The numeric value of the modifier (e.g., 2, -1).
 */

/**
 * @typedef {object} ModifierGroup
 * @property {string} title - The localization key for the group's title.
 * @property {Modifier[]} items - An array of modifier objects in this group.
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
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeFriendly",    label: "Friendly",          value: 2 },
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeNeutral",     label: "Neutral",           value: 0 },
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeMistrustful", label: "Mistrustful",       value: -1 },
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeBiased",      label: "Biased",            value: -2 },
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeAverse",      label: "Averse",            value: -3 },
                { description: "SR5.Marketplace.Modifiers.General.npcAttitudeHostile",     label: "Hostile",           value: -4 },
                { description: "SR5.Marketplace.Modifiers.General.resultAdvantageous",   label: "Advantageous",      value: 1 },
                { description: "SR5.Marketplace.Modifiers.General.resultInsignificant",  label: "Insignificant",     value: 0 },
                { description: "SR5.Marketplace.Modifiers.General.resultAnnoying",       label: "Annoying",          value: -1 },
                { description: "SR5.Marketplace.Modifiers.General.resultDangerous",      label: "Dangerous",         value: -3 },
                { description: "SR5.Marketplace.Modifiers.General.resultCatastrophic",   label: "Catastrophic",      value: -4 }
            ]
        },
        negotiation: {
            title: "SR5.Marketplace.Modifiers.Negotiation.title",
            items: [
                { description: "SR5.Marketplace.Modifiers.Negotiation.notEnoughInfo",    label: "Insufficient Info", value: -2 },
                { description: "SR5.Marketplace.Modifiers.Negotiation.hasLeverage",      label: "Leverage",          value: 2 }
            ]
        },
        etiquette: {
            title: "SR5.Marketplace.Modifiers.Etiquette.title",
            items: [
                { description: "SR5.Marketplace.Modifiers.Etiquette.improperlyDressed",  label: "Improperly Dressed", value: -2 },
                { description: "SR5.Marketplace.Modifiers.Etiquette.obviouslyNervous",   label: "Nervous",            value: -2 }
            ]
        },
        intimidation: {
            title: "SR5.Marketplace.Modifiers.Intimidation.title",
            items: [
                { description: "SR5.Marketplace.Modifiers.Intimidation.physicallyImposing", label: "Physically Imposing", value: 2 },
                { description: "SR5.Marketplace.Modifiers.Intimidation.outnumbered",        label: "Outnumbered",         value: -2 },
                { description: "SR5.Marketplace.Modifiers.Intimidation.hasWeapon",          label: "Has Weapon/Magic",    value: 2 }
            ]
        },
        con: {
            title: "SR5.Marketplace.Modifiers.Con.title",
            items: [
                { description: "SR5.Marketplace.Modifiers.Con.plausibleEvidence",    label: "Plausible Evidence", value: 2 },
                { description: "SR5.Marketplace.Modifiers.Con.targetDistracted",     label: "Target Distracted",  value: 1 }
            ]
        }
    };

    /**
     * Gets a list of relevant modifier groups for a given test context.
     * @param {object} context - The context of the test.
     * @param {string} context.selectedSkill - The skill ID (e.g., 'negotiation').
     * @returns {ModifierGroup[]} An array of modifier groups to be rendered.
     */
    static getModifiersForTest({ selectedSkill }) {
        const db = this.#MODIFIER_DATABASE;
        const groups = [db.general]; // Always include general modifiers.

        // Add the skill-specific group if it exists in our database.
        if (selectedSkill && db[selectedSkill]) {
            groups.push(db[selectedSkill]);
        }

        return groups;
    }
}