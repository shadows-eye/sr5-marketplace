import { MODULE_ID } from '../lib/constants.mjs';
import { DefaultEffect } from '../lib/DefaultEffect.mjs';
import ItemDataServices from './ItemDataServices.mjs';

const FLAG_SCOPE = MODULE_ID;
const FLAG_KEY = "itemBuilderState";


/**
 * A service to manage the persistent state of the Item Builder's ACTIVE build. It will save the state to builder object in the flag of the usersId.
 * @returns {object} Objects - Of state for rendering the UI. FLAG used as Document Storage.
 */
export class BuilderStateService {

    /**
     * Gets the default, empty state for the builder.
     * @returns {object} The default state object.
     * @private
     */
    static _getDefaultState() {
        return {
            title: null,
            baseItem: null,
            modifications: [],
            changes: {}, // later a {object with changes.modslot1 to modslot5 and changes.bottomSlot1 to 4 but can be expanded}
            itemTypeImage: null,
            draftEffect: null,
            isDerivedValueSelectorVisible: false,
            isEditingBaseItem: false,
            baseItemOverrides: {}
        };
    }

    /**
     * Retrieves the current builder state from the user's flags.
     * @returns {Promise<object>} The builder state.
     */
    static async getState() {
        const state = game.user.getFlag(FLAG_SCOPE, FLAG_KEY);
        return foundry.utils.mergeObject(this._getDefaultState(), state || {});
    }

    /**
     * Updates one or more properties in the builder state flag.
     * @param {object} updateData - An object with the properties to update.
     * @returns {Promise<void>}
     */
    static async updateState(updateData) {
        const currentState = await this.getState();
        const newState = foundry.utils.mergeObject(currentState, updateData);
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
    }

    /**
     * Sets the base item, its image, and the dynamic title, clearing any previous build state.
     * @param {object|null} itemData - The data object for the base item.
     * @returns {Promise<void>} object - item Obeject with item and image
     */
    static async setBaseItem(itemData) {
        const newState = this._getDefaultState();
        newState.baseItem = itemData;
        let itemTypeImagePath= game.sr5marketplace.api.itemData.getRepresentativeImage(itemData);
        newState.itemTypeImage = itemTypeImagePath;
        // Generate and set the title
        if (itemData) {
            const typeLabel = itemData.type.charAt(0).toUpperCase() + itemData.type.slice(1);
            newState.title = `${typeLabel}: ${itemData.name}`;
        } else {
            newState.title = "Select a Base Item"; // Default title
        }
        
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
    }

    /**
     * NEW: Adds a modification to the list.
     * @param {object} modData - The data object for the modification item.
     * @returns {Promise<void>}
     */
    static async addModification(modData) {
        const state = await this.getState();
        state.modifications.push(modData);
        await this.updateState({ modifications: state.modifications });
    }

    /**
     * Adds or updates a change for a specific mod slot.
     * @param {string} slotId - The ID of the slot (e.g., "bottomSlot1").
     * @param {object} itemData - The data object of the item being dropped.
     */
    static async addChange(slotId, itemData) {
        const state = await this.getState();
        // This will create or overwrite the key for the specific slot
        state.changes[slotId] = itemData;
        // Directly set the entire updated state back to the flag
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, state);
    }
    
    /**
     * Removes a change for a specific mod slot using a direct database update.
     * @param {string} slotId - The ID of the slot to clear (e.g., "bottomSlot1").
     * @returns {Promise<void>}
     */
    static async removeChange(slotId) {
        // 1. Construct the specific path to the key we want to delete within the flag.
        const path = `flags.${FLAG_SCOPE}.${FLAG_KEY}.changes.-=${slotId}`;

        // 2. Use a direct 'update' command with a special key to remove the field.
        //    This is the most reliable way to ensure a nested property is deleted.
        await game.user.update({ [path]: null });
    }

    // Add the following new methods to the class...

    /**
     * Begins the effect creation process by creating a default draft effect in the state.
     * @param {string} sourceUuid - The UUID of the item the effect will belong to.
     * @returns {Promise<object>} The updated state object.
     */
    static async startEffectCreation(sourceUuid) {
        const state = await this.getState();
        
        // Use our new factory to generate a complete and correct default effect object.
        state.draftEffect = await DefaultEffect.create(sourceUuid);
        
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, state);
        return state;
    }

    /**
     * Updates the current draft effect with new data.
     * @param {object} draftUpdate - An object containing the new data for the draft effect.
     * @returns {Promise<object>} The updated state object.
     */
    static async updateDraftEffect(draftUpdate) {
        const state = await this.getState();
        if (!state.draftEffect) return state;
        
        state.draftEffect = foundry.utils.mergeObject(state.draftEffect, draftUpdate);
        
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, state);
        return state;
    }

    /**
     * A specialized updater that merges data into the draftEffect AND the top-level state simultaneously.
     * @param {object} draftUpdate - Data to merge into `state.draftEffect`.
     * @param {object} stateUpdate - Data to merge into the top-level `state`.
     * @returns {Promise<object>} The fully updated state object.
     */
    static async updateDraftAndState(draftUpdate = {}, stateUpdate = {}) {
        const state = await this.getState();
        if (!state.draftEffect) return state;

        // 1. Merge updates into the draft effect first.
        state.draftEffect = foundry.utils.mergeObject(state.draftEffect, draftUpdate);
        
        // 2. Merge updates into the top-level state object.
        const newState = foundry.utils.mergeObject(state, stateUpdate);

        // 3. Save and return the final, combined state.
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
        return newState;
    }

    /**
     * Finalizes the effect by moving it from draft into the 'modifications' array.
     */
    static async saveDraftEffect() {
        const state = await this.getState();
        if (!state.draftEffect) return state;

        const newState = foundry.utils.deepClone(state);
        const draft = newState.draftEffect;
        if (!newState.modifications) newState.modifications = [];

        delete draft.wasCustom; 
        const existingIndex = newState.modifications.findIndex(m => m._id === draft._id);

        if (existingIndex > -1) newState.modifications[existingIndex] = draft;
        else newState.modifications.push(draft);
        
        newState.draftEffect = null; 
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
        return newState;
    }

    /**
     * Cancels the effect creation. If editing a custom mod, moves it back.
     */
    static async cancelEffectCreation() {
        const state = await this.getState();
        if (!state.draftEffect) return state;
        const newState = foundry.utils.deepClone(state);

        if (state.draftEffect.wasCustom) {
            delete state.draftEffect.wasCustom;
            newState.modifications.push(state.draftEffect);
        }
        
        newState.draftEffect = null;
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
        return newState;
    }

    /**
     * Deletes a custom effect from the 'modifications' array.
     */
    static async deleteEffect(effectId) {
        const state = await this.getState();
        if (state.modifications) {
            state.modifications = state.modifications.filter(m => m._id !== effectId);
            await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, state);
        }
        return state;
    }

    /**
     * Prepares an effect for editing.
     * If it's a custom mod, it's MOVED from 'modifications' to 'draftEffect'.
     * If it's an innate effect, a COPY is created in 'draftEffect'.
     */
    static async startEffectEdit(sourceUuid, effectId) {
        const state = await this.getState();
        const newState = foundry.utils.deepClone(state);
        let effectToEdit = null;

        // Check if it's a custom modification already in the list
        const customModIndex = newState.modifications?.findIndex(m => m._id === effectId);
        if (customModIndex > -1) {
            // It's a custom mod, so we move it to the draft area for editing.
            effectToEdit = newState.modifications.splice(customModIndex, 1)[0];
            effectToEdit.wasCustom = true; // Flag to know where to return it if cancelled
        } else {
            // It's an innate effect from a base item or another mod.
            // Find the source item (either the base or one of the slotted changes).
            let itemSource = (newState.baseItem?.uuid === sourceUuid) 
                ? newState.baseItem 
                : Object.values(newState.changes).find(c => c.uuid === sourceUuid);

            // Find the specific effect within that item.
            const sourceEffect = itemSource?.effects?.find(e => e._id === effectId);

            if (sourceEffect) {
                // Create a deep copy to avoid modifying the original data.
                effectToEdit = foundry.utils.deepClone(sourceEffect);
                
                // --- THIS IS THE KEY LOGIC FOR OVERRIDING ---
                // Store the original ID so we can hide the innate effect later.
                effectToEdit.originalId = sourceEffect._id; 
                // Generate a NEW unique ID for our override copy.
                effectToEdit._id = foundry.utils.randomID();
            }
        }

        if (effectToEdit) {
            const draft = effectToEdit;
            draft.sourceUuid = sourceUuid;
            draft.isEdit = true;
            
            // --- REFINED LOGIC: Determine targetType ---
            if ( !draft.targetType ) {
                // 1. Prioritize the explicit system value.
                if ( draft.system?.applyTo ) {
                    draft.targetType = draft.system.applyTo;
                }
                // 2. Fall back to inferring from the key if `applyTo` isn't present.
                else if ( draft.changes?.[0]?.key ) {
                    const effectKey = draft.changes[0].key;
                    const mappableKeys = SystemDataMapperService.getMappableKeys();

                    const isActorKey = Object.values(mappableKeys.actors).some(actorType => 
                        Object.values(actorType).some(keyGroup => 
                            keyGroup.some(keyData => keyData.path === effectKey)
                        )
                    );
                    if (isActorKey) draft.targetType = 'actor';
                }
            }
            // --- END REFINED LOGIC ---

            newState.draftEffect = draft;
            await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
            return newState;
        }
        return state;
    }

    // Add this new method to the BuilderStateService class

    /**
     * Toggles the visibility of the derived value selector UI.
     * @returns {Promise<object>} The updated state object.
     */
    static async toggleDerivedValueSelector() {
        const state = await this.getState();
        // Flip the boolean flag in the state
        const newStateData = { isDerivedValueSelectorVisible: !state.isDerivedValueSelectorVisible };
        await this.updateState(newStateData);
        // Return the full new state so the UI can re-render
        return foundry.utils.mergeObject(state, newStateData);
    }

    /**
     * Clears the entire builder state.
     * @returns {Promise<void>}
     */
    static async clearState() {
        await game.user.unsetFlag(FLAG_SCOPE, FLAG_KEY);
    }
    static async getEffectFromItemUuid(uuid) {
        let item = fromUuid(uuid);
        let effects = item.effects;
        return effects;
    }

    /**
     * Toggles the edit mode for the base item.
     * @returns {Promise<object>} The updated state.
     */
    static async toggleBaseItemEdit() {
        const state = await this.getState();
        const isEditing = !state.isEditingBaseItem;
        
        await this.updateState({ isEditingBaseItem: isEditing });
        return foundry.utils.mergeObject(state, { isEditingBaseItem: isEditing });
    }

    /**
     * Updates the baseItemOverrides property in the state.
     * @param {object} updateData - An object with properties to update, e.g., { "system.technology.rating": 5 }
     * @returns {Promise<object>} The updated state.
     */
    static async updateBaseItemOverrides(updateData) {
        const state = await this.getState();
        if (!state.baseItem) return state;

        // We use expandObject to handle nested keys like "system.technology.rating"
        const expandedUpdate = foundry.utils.expandObject(updateData);
        
        const newState = foundry.utils.deepClone(state);
        newState.baseItemOverrides = foundry.utils.mergeObject(newState.baseItemOverrides, expandedUpdate);
        
        await this.updateState({ baseItemOverrides: newState.baseItemOverrides });
        return newState;
    }
}