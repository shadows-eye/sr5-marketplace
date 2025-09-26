import { AppDialogBuilder } from './AppDialogBuilder.mjs';

/**
 * A specialized dialog builder for the "Effects" tab of the Item Builder.
 * It extends the base AppDialogBuilder to handle the specific logic for
 * organizing and presenting Active Effects.
 */
export class AppEffectsBuilderDialog extends AppDialogBuilder {
    constructor() {
        super();
    }

    /**
     * Builds the context required for rendering the Effects tab in the Item Builder.
     * It groups effects by their source item (base item and slotted items).
     * @param {object} builderState - The full state object from the BuilderStateService.
     * @returns {Promise<object>} The context object for the Effects.html template.
     */
    async buildEffectsContext(builderState) {
        if (!builderState?.baseItem) {
            return { effectGroups: [] }; // Return empty if there's no base item
        }

        const effectGroups = [];

        // 1. Process the Base Item's effects
        const baseItem = builderState.baseItem;
        effectGroups.push({
            groupName: `Base Item: ${baseItem.name}`,
            sourceUuid: baseItem.uuid,
            effects: baseItem.effects || [],
            hasEffects: (baseItem.effects?.length > 0)
        });

        // 2. Process effects from items in the slots ('changes' object)
        for (const slotId in builderState.changes) {
            const slottedItem = builderState.changes[slotId];
            if (slottedItem && slottedItem.uuid) { // Check if it's a valid item
                effectGroups.push({
                    groupName: `Slot (${slotId}): ${slottedItem.name}`,
                    sourceUuid: slottedItem.uuid,
                    effects: slottedItem.effects || [],
                    hasEffects: (slottedItem.effects?.length > 0)
                });
            }
        }

        return { effectGroups };
    }
}