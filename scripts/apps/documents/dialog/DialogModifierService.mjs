/**
 * @typedef {object} Modifier
 * @property {string} description - The localization key for the modifier's description.
 * @property {string} label - The short, non-localized label for the modifier (e.g., "Friendly").
 * @property {number} value - The numeric value of the modifier (e.g., 2, -1).
 */
export class DialogTestModifierService {
    /**
     * The complete database of all known situational modifiers, grouped by skill.
     * @type {Object.<string, ModifierGroup>}
     * @private
     */
    static #MODIFIER_DATABASE = {
        general: {
            title: "SR5Marketplace.Marketplace.Modifiers.General.title",
            items: [
                { description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeFriendly",    label: "Friendly",          value: 2 },
                { description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeNeutral",     label: "Neutral",           value: 0 },
                { description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeMistrustful", label: "Mistrustful",       value: -1 },
                { description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeBiased",      label: "Biased",            value: -2 },
                { description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeAverse",      label: "Averse",            value: -3 },
                { description: "SR5Marketplace.Marketplace.Modifiers.General.npcAttitudeHostile",     label: "Hostile",           value: -4 },
                { description: "SR5Marketplace.Marketplace.Modifiers.General.resultAdvantageous",   label: "Advantageous",      value: 1 },
                { description: "SR5Marketplace.Marketplace.Modifiers.General.resultInsignificant",  label: "Insignificant",     value: 0 },
                { description: "SR5Marketplace.Marketplace.Modifiers.General.resultAnnoying",       label: "Annoying",          value: -1 },
                { description: "SR5Marketplace.Marketplace.Modifiers.General.resultDangerous",      label: "Dangerous",         value: -3 },
                { description: "SR5Marketplace.Marketplace.Modifiers.General.resultCatastrophic",   label: "Catastrophic",      value: -4 }
            ]
        },
        negotiation: {
            title: "SR5Marketplace.Marketplace.Modifiers.Negotiation.title",
            items: [
                { description: "SR5Marketplace.Marketplace.Modifiers.Negotiation.notEnoughInfo",    label: "Insufficient Info", value: -2 },
                { description: "SR5Marketplace.Marketplace.Modifiers.Negotiation.hasLeverage",      label: "Leverage",          value: 2 }
            ]
        },
        etiquette: {
            title: "SR5Marketplace.Marketplace.Modifiers.Etiquette.title",
            items: [
                { description: "SR5Marketplace.Marketplace.Modifiers.Etiquette.improperlyDressed",  label: "Improperly Dressed", value: -2 },
                { description: "SR5Marketplace.Marketplace.Modifiers.Etiquette.obviouslyNervous",   label: "Nervous",            value: -2 }
            ]
        },
        intimidation: {
            title: "SR5Marketplace.Marketplace.Modifiers.Intimidation.title",
            items: [
                { description: "SR5Marketplace.Marketplace.Modifiers.Intimidation.physicallyImposing", label: "Physically Imposing", value: 2 },
                { description: "SR5Marketplace.Marketplace.Modifiers.Intimidation.outnumbered",        label: "Outnumbered",         value: -2 },
                { description: "SR5Marketplace.Marketplace.Modifiers.Intimidation.hasWeapon",          label: "Has Weapon/Magic",    value: 2 }
            ]
        },
        con: {
            title: "SR5Marketplace.Marketplace.Modifiers.Con.title",
            items: [
                { description: "SR5Marketplace.Marketplace.Modifiers.Con.plausibleEvidence",    label: "Plausible Evidence", value: 2 },
                { description: "SR5Marketplace.Marketplace.Modifiers.Con.targetDistracted",     label: "Target Distracted",  value: 1 }
            ]
        }
    };

    static #SOCIAL_MODIFIER_GROUPS = {
        attitude: ["Friendly", "Neutral", "Mistrustful", "Biased", "Averse", "Hostile"],
        result: ["Advantageous", "Insignificant", "Annoying", "Dangerous", "Catastrophic"]
    };

    /**
     * Gets a list of relevant modifier groups for a given test context.
     * @param {object} context - The context of the test.
     * @param {string} context.skill - The skill ID (e.g., 'negotiation').
     * @returns {ModifierGroup[]} An array of modifier groups to be rendered.
     */
    static getModifiersForTest({ skill }) {
        const db = this.#MODIFIER_DATABASE;
        const groups = [db.general]; // Always include general modifiers.

        // Add the skill-specific group if it exists in our database.
        if (skill && db[skill]) {
            groups.push(db[skill]);
        }

        return groups;
    }

    /**
     * @summary Applies exclusivity rules to a list of modifiers.
     * @description Takes a list of currently applied modifiers and a new modifier to toggle.
     * It enforces rules (e.g., only one "Attitude" modifier) and returns the new, correct array.
     * @param {Array} currentModifiers - The array of currently applied modifiers.
     * @param {object} newModifier - The modifier object that was just clicked.
     * @returns {Array} The new array of modifiers.
     */
    static calculateNewModifierList(currentModifiers, newModifier) {
        const applied = [...(currentModifiers ?? [])]; // Work on a copy
        const { label } = newModifier;
        const existingIndex = applied.findIndex(m => m.label === label);

        if (existingIndex > -1) {
            // If the clicked modifier is already active, remove it.
            applied.splice(existingIndex, 1);
        } else {
            // If it's a new modifier, find which exclusive group it belongs to, if any.
            const groupKey = Object.keys(this.#SOCIAL_MODIFIER_GROUPS).find(key => 
                this.#SOCIAL_MODIFIER_GROUPS[key].includes(label)
            );

            let finalList = applied;
            if (groupKey) {
                // If it's in an exclusive group, first filter out any other members of that group.
                const groupMembers = this.#SOCIAL_MODIFIER_GROUPS[groupKey];
                finalList = applied.filter(mod => !groupMembers.includes(mod.label));
            }
            
            // Add the new modifier.
            finalList.push(newModifier);
            return finalList;
        }
        return applied; // Return the modified list
    }
}