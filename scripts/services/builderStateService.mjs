import { BuildService } from './buildService.mjs';

const buildService = new BuildService();

/**
 * A service to manage the persistent state of the Item Builder's ACTIVE build.
 * Delegates all operations to BuildService to avoid code duplication and direct flag writes.
 */
export class BuilderStateService {

    /**
     * Converts a changes array or object into a normalized array of objects.
     * @param {Array|object} changes - The changes to normalize.
     * @returns {Array<object>} A normalized array.
     */
    static _changesToArray(changes) {
        return buildService._changesToArray(changes);
    }

    /**
     * Converts a changes array or object into an indexed object.
     * @param {Array|object} changes - The changes to convert.
     * @returns {object} An indexed object.
     */
    static _changesToObject(changes) {
        return buildService._changesToObject(changes);
    }

    /**
     * Retrieves the current builder state from the user's flags.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The builder state.
     */
    static async getState(userId = null) {
        return await buildService.getBuilderState(userId);
    }

    /**
     * Updates one or more properties in the builder state flag.
     * @param {object} updateData - An object with the properties to update.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    static async updateState(updateData, userId = null) {
        return await buildService.updateBuilderState(updateData, userId);
    }

    /**
     * Sets the base item, its image, and the dynamic title.
     * @param {object|null} itemData - The data object for the base item.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    static async setBaseItem(itemData, userId = null) {
        return await buildService.setBuilderBaseItem(itemData, userId);
    }

    /**
     * Adds a modification to the list.
     * @param {object} modData - The data object for the modification item.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    static async addModification(modData, userId = null) {
        return await buildService.addBuilderModification(modData, userId);
    }

    /**
     * Adds or updates a change for a specific mod slot.
     * @param {string} slotId - The ID of the slot (e.g., "bottomSlot1").
     * @param {object} itemData - The data object of the item being dropped.
     * @param {string|null} [userId=null] - The ID of the user.
     */
    static async addChange(slotId, itemData, userId = null) {
        return await buildService.addBuilderChange(slotId, itemData, userId);
    }
    
    /**
     * Removes a change for a specific mod slot using a direct database update.
     * @param {string} slotId - The ID of the slot to clear (e.g., "bottomSlot1").
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    static async removeChange(slotId, userId = null) {
        return await buildService.removeBuilderChange(slotId, userId);
    }

    /**
     * Begins the effect creation process by creating a default draft effect in the state.
     * @param {string} sourceUuid - The UUID of the item the effect will belong to.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    static async startEffectCreation(sourceUuid, userId = null) {
        return await buildService.startBuilderEffectCreation(sourceUuid, userId);
    }

    /**
     * Updates the current draft effect with new data.
     * @param {object} draftUpdate - An object containing the new data for the draft effect.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    static async updateDraftEffect(draftUpdate, userId = null) {
        return await buildService.updateBuilderDraftEffect(draftUpdate, userId);
    }

    /**
     * A specialized updater that merges data into the draftEffect AND the top-level state simultaneously.
     * @param {object} draftUpdate - Data to merge into `state.draftEffect`.
     * @param {object} stateUpdate - Data to merge into the top-level `state`.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The fully updated state object.
     */
    static async updateDraftAndState(draftUpdate = {}, stateUpdate = {}, userId = null) {
        return await buildService.updateBuilderDraftAndState(draftUpdate, stateUpdate, userId);
    }

    /**
     * Finalizes the effect by moving it from draft into the 'modifications' array.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    static async saveDraftEffect(userId = null) {
        return await buildService.saveBuilderDraftEffect(userId);
    }

    /**
     * Cancels the effect creation. If editing a custom mod, moves it back.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    static async cancelEffectCreation(userId = null) {
        return await buildService.cancelBuilderEffectCreation(userId);
    }

    /**
     * Deletes a custom effect from the 'modifications' array.
     * @param {string} effectId - The ID of the effect.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    static async deleteEffect(effectId, userId = null) {
        return await buildService.deleteBuilderEffect(effectId, userId);
    }

    /**
     * Prepares an effect for editing.
     * @param {string} sourceUuid - The UUID of the source item.
     * @param {string} effectId - The ID of the effect.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    static async startEffectEdit(sourceUuid, effectId, userId = null) {
        return await buildService.startBuilderEffectEdit(sourceUuid, effectId, userId);
    }

    /**
     * Toggles the visibility of the derived value selector UI.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state object.
     */
    static async toggleDerivedValueSelector(userId = null) {
        return await buildService.toggleBuilderDerivedValueSelector(userId);
    }

    /**
     * Clears the entire builder state.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<void>}
     */
    static async clearState(userId = null) {
        return await buildService.clearBuilderState(userId);
    }

    /**
     * Retrieves effects from an item UUID.
     * @param {string} uuid - The item UUID.
     * @returns {Promise<Array>} The effects list.
     */
    static async getEffectFromItemUuid(uuid) {
        return await buildService.getEffectFromItemUuid(uuid);
    }

    /**
     * Toggles the edit mode for the base item.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    static async toggleBaseItemEdit(userId = null) {
        return await buildService.toggleBuilderBaseItemEdit(userId);
    }

    /**
     * Updates the baseItemOverrides property in the state.
     * @param {object} updateData - An object with properties to update.
     * @param {string|null} [userId=null] - The ID of the user.
     * @returns {Promise<object>} The updated state.
     */
    static async updateBaseItemOverrides(updateData, userId = null) {
        return await buildService.updateBuilderBaseItemOverrides(updateData, userId);
    }
}