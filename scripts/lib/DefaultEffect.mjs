/**
 * A factory class to create a default, plain JavaScript object that mimics
 * the data structure of a Shadowrun 5e ActiveEffect.
 */
export class DefaultEffect {
    /**
     * Creates a new, default effect data object.
     * @param {string} sourceUuid - The UUID of the item that will own this effect.
     * @returns {Promise<object>} A promise that resolves to the default effect data.
     */
    static async create(sourceUuid) {
        const sourceItem = await fromUuid(sourceUuid);
        const effectName = sourceItem ? `${sourceItem.name} Effect` : "New Effect";

        return {
            _id: foundry.utils.randomID(),
            name: effectName,
            img: "icons/svg/aura.svg",
            type: "base",
            system: {
                applyTo: null,
                // ... other system defaults
                selection_tests: [],
                selection_categories: [],
                selection_skills: [],
                selection_attributes: [],
                selection_limits: []
            },
            // --- THIS IS THE FIX ---
            // Initialize the changes object with all required properties.
            changes: {
                "0": {
                    key: null,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD, // A sensible default mode
                    value: "" // The crucial addition of an empty value
                }
            },
            disabled: false,
            duration: { startTime: null, combat: null },
            description: "",
            origin: null,
            tint: "#ffffff",
            transfer: true,
            statuses: [],
            sourceUuid: sourceUuid,
            isEdit: false,
            targetType: null
        };
    }
}