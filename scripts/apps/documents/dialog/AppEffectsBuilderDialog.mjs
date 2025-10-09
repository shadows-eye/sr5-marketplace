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
            effectGroups: this._getEffectGroups(builderState),
            isDerivedValueSelectorVisible: builderState.isDerivedValueSelectorVisible 
        };

        if (context.isCreating) {
            const mappableKeys = SystemDataMapperService.getMappableKeys();
            const selectedKey = context.draftEffect.changes?.[0]?.key ?? "";

            context.actorKeyGroups = this.#_prepareGroupsForGrid(this.#_getMergedActorKeys(mappableKeys.actors), selectedKey);
            context.rollKeyGroups = this.#_prepareGroupsForGrid(mappableKeys.rolls, selectedKey);
            context.modifierKeyGroups = this.#_prepareGroupsForGrid(mappableKeys.modifiers, selectedKey);
            
            const activeMode = context.draftEffect.targetType || context.draftEffect.system?.applyTo;
            context.isActorMode = (activeMode === 'actor' || activeMode === 'targeted_actor');
            context.isTestMode = (activeMode === 'test_all' || activeMode === 'test_item');
            context.isModifierMode = (activeMode === 'modifier');

            if (context.actorKeyGroups) {
                context.derivedValueKeyGroups = context.actorKeyGroups.map(group => {
                    const filteredData = group.groupData.filter(key => key.path.startsWith("system."));
                    return { ...group, groupData: filteredData };
                }).filter(group => group.groupData.length > 0);
            } else {
                context.derivedValueKeyGroups = [];
            }

            // Prepare data for the Test Filter selectors ---
            context.selection_test_options = this._getTestOptions();
            context.selection_category_options = this._getCategoryOptions();
            context.selection_skill_options = this._getSkillOptions();
            context.selection_attribute_options = this._getAttributeOptions();
            context.selection_limit_options = this._getLimitOptions();
            // --- END ---

            context.changeModes = Object.entries(CONST.ACTIVE_EFFECT_MODES).map(([key, value]) => ({
                value: value, label: `EFFECT.MODE_${key}`
            }));
        }
        
        console.log("Effects Tab Context:", context);
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
                gridSpan = 2;
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
        if (!allActorKeys) return {};
        const merged = {};
        for (const actorType in allActorKeys) {
            const keyGroups = allActorKeys[actorType];
            for (const groupName in keyGroups) {
                if (!merged[groupName]) merged[groupName] = [];
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
        const customMods = builderState.modifications || [];

        // --- NEW LOGIC: Always create a group for the base item ---
        const baseItem = builderState.baseItem;
        const finalBaseEffects = [];
        const baseInnateEffects = baseItem.effects || [];
        const baseCustomMods = customMods.filter(m => m.sourceUuid === baseItem.uuid);

        // Filter out overridden innate effects for the base item
        for (const innate of baseInnateEffects) {
            const isOverridden = baseCustomMods.some(m => m.originalId === innate._id);
            if (!isOverridden) {
                finalBaseEffects.push(innate);
            }
        }
        finalBaseEffects.push(...baseCustomMods);

        // Add the base item group unconditionally
        groups.push({
            groupName: `Base Item: ${baseItem.name}`,
            sourceUuid: baseItem.uuid,
            effects: finalBaseEffects
        });
        // --- END NEW LOGIC ---

        // Now, process the rest of the items (the slotted modifications)
        const slottedItems = Object.values(builderState.changes);
        for (const item of slottedItems) {
            if (!item?.uuid) continue;

            const finalEffects = [];
            const itemInnateEffects = item.effects || [];
            const itemCustomMods = customMods.filter(m => m.sourceUuid === item.uuid);

            for (const innate of itemInnateEffects) {
                const isOverridden = itemCustomMods.some(m => m.originalId === innate._id);
                if (!isOverridden) {
                    finalEffects.push(innate);
                }
            }

            finalEffects.push(...itemCustomMods);
            
            // Only add a group if there are effects to show for slotted items
            if (finalEffects.length > 0) {
                groups.push({
                    groupName: `Slot (${Object.keys(builderState.changes).find(k => builderState.changes[k] === item)}): ${item.name}`,
                    sourceUuid: item.uuid,
                    effects: finalEffects
                });
            }
        }
        return groups;
    }
    // --- HELPER METHODS using the CORRECT API paths ---

    _getTestOptions() {
        return game.sr5marketplace.api.tests || [];
    }

    _getCategoryOptions() {
        return game.sr5marketplace.api.actionCategories_l || [];
    }

    _getSkillOptions() {
        return game.sr5marketplace.api.activeSkills_l || [];
    }

    _getAttributeOptions() {
        return game.sr5marketplace.api.attributes_l || [];
    }

    _getLimitOptions() {
        return game.sr5marketplace.api.limits_l || [];
    }
}