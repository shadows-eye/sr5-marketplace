import { AppDialogBuilder } from './AppDialogBuilder.mjs';
import { SystemDataMapperService } from '../../../services/SystemDataMapperService.mjs';

/**
 * A specialized dialog builder for the "Effects" tab of the Item Builder.
 * It extends the base AppDialogBuilder to handle the specific logic for
 * organizing and presenting Active Effects, both for viewing and creation.
 */
export class AppEffectsBuilderDialog extends AppDialogBuilder {
    constructor() {
        super();
    }

    /**
     * Builds the context for the entire "Effects" tab.
     * It determines if we are viewing existing effects or actively creating a new one,
     * and provides all necessary data for the UI.
     * @param {object} builderState - The full state object from the BuilderStateService.
     * @returns {Promise<object>} The context object for the Effects.html template.
     */
    async buildEffectsContext(builderState) {
        const isCreating = !!builderState.draftEffect;
        const effectGroups = this._getEffectGroups(builderState);

        const context = {
            isCreating,
            draftEffect: builderState.draftEffect,
            effectGroups
        };

        // If we are in "creation mode", also load all the data needed for the builder UI.
        if (isCreating) {
            const allActorKeys = SystemDataMapperService.getAllMappableActorKeys();
            const allItemKeys = SystemDataMapperService.getAllMappableItemKeys();

            // Add the list of type names for the <select> dropdowns.
            context.actorTypes = Object.keys(allActorKeys);
            context.itemTypes = Object.keys(allItemKeys);

            // If a document type has already been selected in the draft,
            // pass its specific keys to the template for rendering the buttons.
            const selectedType = builderState.draftEffect.documentType;
            if (selectedType) {
                context.mappableKeys = allActorKeys[selectedType] || allItemKeys[selectedType];
            }
        }
        
        return context;
    }

    /**
     * Helper method to organize effects into groups for display.
     * It combines innate effects from items with custom effects from the 'modifications' array.
     * @private
     */
    _getEffectGroups(builderState) {
        if (!builderState?.baseItem) return [];
        
        const groups = [];
        const allItems = [builderState.baseItem, ...Object.values(builderState.changes)];
        const customMods = builderState.modifications || [];

        for (const item of allItems) {
            if (!item?.uuid) continue;

            const finalEffects = [];
            const itemInnateEffects = item.effects || [];
            
            // 1. Get all custom mods that belong to this item
            const itemCustomMods = customMods.filter(m => m.sourceUuid === item.uuid);

            // 2. For each innate effect, check if there is an override for it in the custom mods
            for (const innate of itemInnateEffects) {
                const override = itemCustomMods.find(m => m._id === innate._id);
                if (override) {
                    finalEffects.push({ ...override, isOverride: true }); // Show the override
                } else {
                    finalEffects.push(innate); // Show the original
                }
            }

            // 3. Add any brand-new custom mods that aren't overrides
            for (const mod of itemCustomMods) {
                if (!itemInnateEffects.some(e => e._id === mod._id)) {
                    finalEffects.push(mod);
                }
            }
            
            groups.push({
                groupName: (item === builderState.baseItem) 
                    ? `Base Item: ${item.name}` 
                    : `Slot (${Object.keys(builderState.changes).find(k => builderState.changes[k] === item)}): ${item.name}`,
                sourceUuid: item.uuid,
                effects: finalEffects
            });
        }
        return groups;
    }
}