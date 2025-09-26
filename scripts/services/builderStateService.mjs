import { MODULE_ID } from '../lib/constants.mjs';
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
            draftEffect: null
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
        let itemTypeImagePath= game.sr5marketplace.itemData.getRepresentativeImage(itemData);
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
        const defaultEffect = {
            sourceUuid: sourceUuid, name: "", img: "icons/svg/aura.svg", isEdit: false,
            changes: [{ key: "", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "", priority: 10 }]
        };
        await this.updateState({ draftEffect: defaultEffect });
        return this.getState();
    }

    /**
     * Updates the current draft effect with new data.
     * @param {object} draftUpdate - An object containing the new data for the draft effect.
     * @returns {Promise<object>} The updated state object.
     */
    static async updateDraftEffect(draftUpdate) {
        const state = await this.getState();
        const updatedDraft = foundry.utils.mergeObject(state.draftEffect, draftUpdate);
        await this.updateState({ draftEffect: updatedDraft });
        return this.getState();
    }

    /**
     * Finalizes effect creation, handling new effects, edits to custom effects,
     * and edits of innate effects (creating overrides).
     */
    static async saveDraftEffect() {
        const state = await this.getState();
        if (!state.draftEffect) return state;

        const newState = foundry.utils.deepClone(state);
        const draft = newState.draftEffect;
        
        if (!newState.modifications) newState.modifications = [];

        // If the effect being edited was an innate one, it won't have a sourceUuid yet.
        // We also mark it as an override.
        if (draft.isEdit && !draft.sourceUuid) {
            draft.sourceUuid = state.draftEffect.sourceUuid;
            draft.isOverride = true;
        }

        const existingIndex = newState.modifications.findIndex(m => m._id === draft._id);

        if (existingIndex > -1) {
            // This was an edit of an existing custom modification, so replace it.
            newState.modifications[existingIndex] = draft;
        } else {
            // This is a new effect OR an override of an innate effect. Add it to the array.
            if (!draft._id) draft._id = foundry.utils.randomID();
            newState.modifications.push(draft);
        }
        
        newState.draftEffect = null; 
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
        return this.getState();
    }

    /**
     * Cancels the effect creation process by clearing the draft effect.
     * @returns {Promise<object>} The updated state object.
     */
    static async cancelEffectCreation() {
        await this.updateState({ draftEffect: null });
        return this.getState();
    }

    /**
     * Deletes a specific effect from an item in the builder state.
     * @param {string} effectId - The _id of the effect to delete.
     * @returns {Promise<object>} The updated state object.
     */
    static async deleteEffect(effectId) {
        const currentState = await this.getState();
        const newState = foundry.utils.deepClone(currentState);

        if (newState.modifications) {
            newState.modifications = newState.modifications.filter(m => m._id !== effectId);
            await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
        }
        return this.getState();
    }

    /**
     * Prepares an effect for editing by moving it to the 'draftEffect' state.
     * It can find effects that are either custom modifications or innate to an item.
     */
    static async startEffectEdit(sourceUuid, effectId) {
        const state = await this.getState();
        let effectToEdit = null;
        
        // 1. First, check if we are editing an existing custom modification.
        effectToEdit = state.modifications?.find(m => m._id === effectId);

        // 2. If not found, search the innate effects of the source item.
        if (!effectToEdit) {
            let itemSource = null;
            if (state.baseItem?.uuid === sourceUuid) itemSource = state.baseItem;
            else itemSource = Object.values(state.changes).find(c => c.uuid === sourceUuid);
            
            effectToEdit = itemSource?.effects?.find(e => e._id === effectId);
        }

        if (effectToEdit) {
            const draft = foundry.utils.deepClone(effectToEdit);
            draft.sourceUuid = sourceUuid; // Always track where it came from
            draft.isEdit = true;
            await this.updateState({ draftEffect: draft });
        }
        
        return this.getState();
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
}