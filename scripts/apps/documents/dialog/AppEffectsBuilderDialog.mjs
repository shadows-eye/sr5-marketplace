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
     * Builds the complete context for the "Effects" tab.
     * It receives the builderState from the main application.
     * @param {object} builderState - The full state object from the BuilderStateService.
     * @returns {Promise<object>} The context object for the Effects.html template.
     */
    async buildEffectsContext(builderState) {
        const context = {
            isCreating: !!builderState.draftEffect,
            draftEffect: builderState.draftEffect,
            effectGroups: this._getEffectGroups(builderState)
        };

        if (context.isCreating) {
            const mappableKeys = SystemDataMapperService.getMappableKeys();
            const selectedKey = context.draftEffect.changes[0].key;

            // Prepare actor keys for the grid
            const mergedActorKeys = this.#_getMergedActorKeys(mappableKeys.actors);
            context.actorKeyGroups = this.#_prepareGroupsForGrid(mergedActorKeys, selectedKey);

            // Prepare item keys for the grid
            const itemType = builderState.baseItem?.type;
            if (itemType && mappableKeys.items[itemType]) {
                const itemKeyData = { [`${builderState.baseItem.name} Keys`]: mappableKeys.items[itemType] };
                context.itemKeyGroups = this.#_prepareGroupsForGrid(itemKeyData, selectedKey);
            }

            context.changeModes = Object.entries(CONST.ACTIVE_EFFECT_MODES).map(([key, value]) => ({
                value: value, label: `EFFECT.MODE_${key}`
            }));
        }
        console.log("Marketplace Builder | Effects Tab Context:", context);
        return context;
    }

    /**
     * Takes a map of key groups, sorts them, and adds grid-aware properties
     * for a dynamic bento grid layout.
     * @param {object} keyGroups - An object where keys are group names and values are arrays of key data.
     * @param {string|null} selectedKey - The currently selected key path to determine expansion.
     * @returns {Array<object>} An array of group objects ready for the template.
     * @private
     */
    #_prepareGroupsForGrid(keyGroups, selectedKey) {
        const finalGroups = [];
        const sortedGroupNames = Object.keys(keyGroups).sort((a, b) => a.localeCompare(b));

        for (const groupName of sortedGroupNames) {
            const groupData = keyGroups[groupName];
            const keyCount = groupData.length;
            
            // --- BENTO BOX SIZING LOGIC ---
            let gridSpan = 1;
            let gridRowSpan = 1;
            
            if (keyCount > 30) {        // Very Large Group (e.g., Skills)
                gridSpan = 5;
                gridRowSpan = 1; // A wide banner
            } else if (keyCount > 15) { // Large Group (e.g., Modifiers)
                gridSpan = 4;
                gridRowSpan = 2; // A large square
            } else if (keyCount > 8) {  // Medium Group (e.g., Attributes)
                gridSpan = 3;
                gridRowSpan = 1; // A medium rectangle
            }
            // Small groups default to a 1x1 square

            const isExpanded = groupData.some(key => key.path === selectedKey);
            let contentColumns = gridSpan > 1 ? 2 : 1; // Content inside gets 1 or 2 columns

            finalGroups.push({ groupName, groupData, isExpanded, gridSpan, gridRowSpan, contentColumns });
        }
        return finalGroups;
    }

    /**
     * Merges all mappable key groups from all actor types into a single object.
     * @param {object} allActorKeys - The `mappableKeys.actors` object.
     * @returns {object} A single object with all unique key groups.
     * @private
     */
    #_getMergedActorKeys(allActorKeys) {
        // This method is now simplified to only do the merge.
        const merged = {};
        for (const actorType in allActorKeys) {
            const keyGroups = allActorKeys[actorType];
            for (const groupName in keyGroups) {
                if (!merged[groupName]) {
                    merged[groupName] = [];
                }
                const existingPaths = new Set(merged[groupName].map(k => k.path));
                const newKeys = keyGroups[groupName].filter(k => !existingPaths.has(k.path));
                merged[groupName].push(...newKeys);
            }
        }
        return merged;
    }

    /**
     * Helper method to organize effects into groups for display.
     * @private
     */
    _getEffectGroups(builderState) {
        if (!builderState?.baseItem) return [];
        const groups = [];
        // Consolidate all items that can have effects
        const allItems = [builderState.baseItem, ...Object.values(builderState.changes)];
        const customMods = builderState.modifications || [];

        for (const item of allItems) {
            if (!item?.uuid) continue;

            const finalEffects = [];
            const itemInnateEffects = item.effects || [];
            
            // Get custom mods specific to THIS item
            const itemCustomMods = customMods.filter(m => m.sourceUuid === item.uuid);

            // --- NEW LOGIC: Filter out overridden innate effects ---
            for (const innate of itemInnateEffects) {
                // Check if any custom mod for this item is overriding this specific innate effect.
                const isOverridden = itemCustomMods.some(m => m.originalId === innate._id);
                // Only add the innate effect to the list if it's NOT overridden.
                if (!isOverridden) {
                    finalEffects.push(innate);
                }
            }

            // Now, add all the custom mods for this item (including our new overrides).
            finalEffects.push(...itemCustomMods);
            
            if (finalEffects.length > 0) {
                groups.push({
                    groupName: (item === builderState.baseItem) 
                        ? `Base Item: ${item.name}` 
                        : `Slot (${Object.keys(builderState.changes).find(k => builderState.changes[k] === item)}): ${item.name}`,
                    sourceUuid: item.uuid,
                    effects: finalEffects
                });
            }
        }
        return groups;
    }
}