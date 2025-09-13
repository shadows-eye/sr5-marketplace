import { MODULE_ID } from '../lib/constants.mjs';

const FLAG_SCOPE = MODULE_ID;
const FLAG_KEY = "itemBuilderState";


/**
 * A service to manage the persistent state of the Item Builder's ACTIVE build.
 */
export class BuilderStateService {

    /**
     * Gets the default, empty state for the builder.
     * @returns {object} The default state object.
     * @private
     */
    static _getDefaultState() {
        return {
            baseItem: null,
            modifications: [],
            changes: [] // NEW: An array to track specific attribute changes
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
     * Sets the base item, clearing any previous modifications and changes.
     * @param {object|null} itemData - The data object for the base item.
     * @returns {Promise<void>}
     */
    static async setBaseItem(itemData) {
        // When setting a new base item, we reset the build.
        const newState = this._getDefaultState();
        newState.baseItem = itemData;
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
     * NEW: Adds a specific attribute change to the list.
     * @param {object} change - The change object you described.
     * @returns {Promise<void>}
     */
    static async addChange(change) {
        const state = await this.getState();
        state.changes.push(change);
        await this.updateState({ changes: state.changes });
    }

    /**
     * Clears the entire builder state.
     * @returns {Promise<void>}
     */
    static async clearState() {
        await game.user.unsetFlag(FLAG_SCOPE, FLAG_KEY);
    }
}