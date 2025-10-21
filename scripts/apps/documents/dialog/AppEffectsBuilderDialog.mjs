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
            const selectedKey = context.draftEffect.changes[0].key;
            
            const activeMode = context.draftEffect.system?.applyTo;
            context.isActorMode = (activeMode === 'actor' || activeMode === 'targeted_actor');
            context.isTestMode = (activeMode === 'test_all' || activeMode === 'test_item');
            context.isModifierMode = (activeMode === 'modifier');

            const characterActorKeys = mappableKeys.actors.character || {};
            context.actorKeyGroups = this.#_prepareGroupsForGrid(characterActorKeys, selectedKey);
            context.rollKeyGroups = this.#_prepareGroupsForGrid(mappableKeys.rolls, selectedKey);
            context.modifierKeyGroups = this.#_prepareGroupsForGrid(mappableKeys.modifiers, selectedKey);
            
            const itemType = builderState.baseItem?.type;
            if (itemType && mappableKeys.items[itemType]) {
                const itemKeyData = { [`${builderState.baseItem.name} Keys`]: mappableKeys.items[itemType] };
                context.itemKeyGroups = this.#_prepareGroupsForGrid(itemKeyData, selectedKey);
            }

            // Prepare data for the multi-select components.
            context.selection_test_options = this._getTestOptions();
            context.selection_category_options = this._getCategoryOptions();
            context.selection_skill_options = this._getSkillOptions();
            context.selection_attribute_options = this._getAttributeOptions();
            context.selection_limit_options = this._getLimitOptions();
            // --- END Multiselect ---
            context.effectApplyToOptions = game.sr5marketplace.api.system.effectApplyTo_l;
            context.changeModes = Object.entries(CONST.ACTIVE_EFFECT_MODES).map(([key, value]) => ({
                value: value, label: `EFFECT.MODE_${key}`
            }));

        }
        // Find and prepare the derivable keys specifically from the baseItem.
        if (context.isDerivedValueSelectorVisible && builderState.baseItem) {
            const numericKeys = this.#_getDerivableItemKeys(builderState.baseItem);

            if (numericKeys.length > 0) {
                const baseItemLabel = game.i18n.localize("SR5.BaseItem") || "Base Item";
                const propertiesLabel = game.i18n.localize("SR5.Properties") || "Properties";
                
                // Create the data structure the template expects.
                context.derivedValueKeyGroups = [{
                    groupName: `${baseItemLabel} ${propertiesLabel}`,
                    groupData: numericKeys
                }];
            }
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
        const allItems = [builderState.baseItem, ...Object.values(builderState.changes)];
        const customMods = builderState.modifications || [];
        
        const baseItemLabel = game.i18n.localize("SR5.BaseItem") || "Base Item";
        const slotLabel = game.i18n.localize("SR5.Slot") || "Slot";

        for (const item of allItems) {
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
            
            if (finalEffects.length > 0) {
                groups.push({
                    groupName: (item === builderState.baseItem) 
                        ? `${baseItemLabel}: ${item.name}` 
                        : `${slotLabel} (${Object.keys(builderState.changes).find(k => builderState.changes[k] === item)}): ${item.name}`,
                    sourceUuid: item.uuid,
                    effects: finalEffects
                });
            }
        }
        return groups;
    }
    
    _getTestOptions() {
        const options = game.sr5marketplace.api.system.tests || [];
        return options.map(opt => ({ value: opt.id, label: opt.value }));
    }

    _getCategoryOptions() {
        const options = game.sr5marketplace.api.system.actionCategories_l || {};
        return Object.entries(options).map(([value, label]) => ({ value, label }));
    }

    _getSkillOptions() {
        const options = game.sr5marketplace.api.system.activeSkills_l || {};
        return Object.entries(options).map(([value, label]) => ({ value, label }));
    }

    _getAttributeOptions() {
        const options = game.sr5marketplace.api.system.attributes_l || {};
        return Object.entries(options).map(([value, label]) => ({ value, label }));
    }

    _getLimitOptions() {
        const options = game.sr5marketplace.api.system.limits_l || {};
        return Object.entries(options).map(([value, label]) => ({ value, label }));
    }

    // --- NEW METHOD ---
    /**
     * Scans a base item for a curated list of common, numeric properties that
     * are useful for deriving effect values.
     * @param {object} baseItem - The base item document data from the builder state.
     * @returns {Array<object>} An array of {label, path} objects for the selector.
     * @private
     */
    #_getDerivableItemKeys(baseItem) {
        if (!baseItem?.system) return [];

        const derivableKeys = [];
        const systemApi = game.sr5marketplace.api.system;

        // A whitelist of common properties to check for.
        const keyBlueprints = [
            { path: "system.technology.rating", labelKey: "SR5.Rating" },
            { path: "system.technology.cost", labelKey: "SR5.Cost" },
            { path: "system.armor.value", labelKey: "SR5.Armor" },
            { path: "system.damage.value", labelKey: "SR5.DamageValueAbbr" },
            { path: "system.accuracy.value", labelKey: "SR5.AccuracyAbbr" },
            { path: "system.ap.value", labelKey: "SR5.APAbbr" },
            { path: "system.essence", labelKey: "SR5.Essence" },
            { path: "system.capacity.value", labelKey: "SR5.Capacity" },
            { path: "system.range.rc.value", labelKey: "SR5.RecoilComp" },
            { path: "system.melee.reach", labelKey: "SR5.Reach" },
        ];
        
        for (const blueprint of keyBlueprints) {
            // Check if the property exists and is a number.
            const value = foundry.utils.getProperty(baseItem, blueprint.path);
            if (typeof value === 'number') {
                derivableKeys.push({
                    label: game.i18n.localize(blueprint.labelKey) || blueprint.path,
                    path: blueprint.path
                });
            }
        }

        // Specifically check for Matrix Attributes if the item has them (e.g., Cyberdecks)
        if (baseItem.system.attributes) {
            const matrixAttributes_l = systemApi.matrixAttributes_l || {};
            for (const key in baseItem.system.attributes) {
                const path = `system.attributes.${key}.value`;
                const value = foundry.utils.getProperty(baseItem, path);
                if (typeof value === 'number') {
                    derivableKeys.push({
                        label: matrixAttributes_l[key] || key.capitalize(),
                        path: path
                    });
                }
            }
        }

        return derivableKeys;
    }
}