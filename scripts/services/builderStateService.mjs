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
            itemTypeImage: null
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