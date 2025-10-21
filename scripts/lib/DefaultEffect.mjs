/**
 * A factory class to create a default, plain JavaScript object that mimics
 * the data structure of a Shadowrun 5e ActiveEffect.
 */
export class DefaultEffect {
    /**
     * Creates a new, default effect object.
     * @param {string} sourceUuid The UUID of the item this effect will belong to.
     * @returns {Promise<object>} A promise that resolves to the default effect data object.
     */
    static async create(sourceUuid) {
        const sourceItem = await fromUuid(sourceUuid);
        const itemName = sourceItem?.name || "New";

        return {
            _id: foundry.utils.randomID(),
            name: `${itemName} Effect`,
            img: "icons/svg/aura.svg",
            type: "base", // Standard type for custom effects
            system: {
                applyTo: "actor", // Default to 'actor' to ensure the UI renders correctly
                appliedByTest: false,
                onlyForEquipped: false,
                onlyForWireless: false,
                onlyForItemTest: false,
                selection_attributes: [],
                selection_categories: [],
                selection_limits: [],
                selection_skills: [],
                selection_tests: []
            },
            changes: [{
                key: "",
                mode: CONST.ACTIVE_EFFECT_MODES.ADD, // A sensible default mode
                value: ""
            }],
            disabled: false,
            duration: { startTime: null, combat: null },
            description: "",
            origin: null,
            tint: "#ffffff",
            transfer: true,
            statuses: [],
            // --- UI-specific properties ---
            sourceUuid: sourceUuid,
            isEdit: false
        };
    }
}