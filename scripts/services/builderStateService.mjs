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
        const state = await this.getState();
        state.draftEffect = {
            _id: foundry.utils.randomID(),
            sourceUuid: sourceUuid,
            name: "",
            img: "icons/svg/aura.svg",
            isEdit: false,
            targetType: null,
            changes: [{ key: "", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "" }]
        };
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

        const customModIndex = newState.modifications?.findIndex(m => m._id === effectId);
        if (customModIndex > -1) {
            effectToEdit = newState.modifications.splice(customModIndex, 1)[0];
            effectToEdit.wasCustom = true;
        } else {
            let itemSource = (newState.baseItem?.uuid === sourceUuid) 
                ? newState.baseItem 
                : Object.values(newState.changes).find(c => c.uuid === sourceUuid);
            effectToEdit = itemSource?.effects?.find(e => e._id === effectId);
            if (effectToEdit) {
                effectToEdit.originalId = effectToEdit._id;
                // Generate a new ID for the override to avoid conflicts
                effectToEdit._id = foundry.utils.randomID();
            }
        }

        if (effectToEdit) {
            const draft = foundry.utils.deepClone(effectToEdit);
            draft.sourceUuid = sourceUuid;
            draft.isEdit = true;
            newState.draftEffect = draft;
            await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, newState);
            return newState;
        }
        return state;
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