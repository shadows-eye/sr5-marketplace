import { MODULE_ID, FLAG_KEY_AppTest } from '../lib/constants.mjs';

/**
 * @summary Manages the state of in-app tests via a user flag.
 * @description This service handles creating, reading, updating, and deleting test
 * state objects stored in a user's flags, ensuring a persistent, multi-step
 * test workflow within the application.
 */
export class AppTestFlagService {
    static #SOCIAL_MODIFIER_GROUPS = {
        attitude: ["Friendly", "Neutral", "Mistrustful", "Biased", "Averse", "Hostile"],
        result: ["Advantageous", "Insignificant", "Annoying", "Dangerous", "Catastrophic"]
    };
    /**
     * READS the entire test state object from a specific user's flag.
     * @param {string} [userId] - The ID of the user to get the flag from.
     * @returns {Promise<object>} The test state object, or an empty object if not found.
     */
    static async readState(userId) {
        if (!userId) {
            userId = await game.user.id;
        }
        const user = game.users.get(userId);
        if (!user) return {};
        return user.getFlag(MODULE_ID, FLAG_KEY_AppTest) || {};
    }

    /**
     * CREATES a new test state for a user, overwriting any previous state.
     * @param {object} initialData - The data to initialize the test with.
     * @param {string} [userId] - The user for whom to create the test.
     * @returns {Promise<string>} The unique ID of the newly created test state.
     */
    static async createTest(initialData, userId) {
        const dialogId = foundry.utils.randomID();
        if  (!userId) {
        userId = await game.user.id;
        }
        // Create a fresh state object containing only this new test.
        // This enforces the "one active test per user" rule.
        const newState = {
            [dialogId]: {
                id: dialogId,
                status: 'initial',
                ...initialData,
                result: null,
                resistResult: null,
                resolved: false,
                skill: 'negotiation', //Default Value
                attribute: 'charisma', //Default Value
                modifier: [] // Empty array
            }
        };

        const user = game.users.get(userId);
        if (user) {
            console.log(`Saving new test state to flag for user ${user.name}:`, newState);
            await user.setFlag(MODULE_ID, FLAG_KEY_AppTest, newState);
        }
        return dialogId;
    }

    /**
     * UPDATES an existing test entry with new data.
     * @param {string} dialogId - The ID of the test state to update.
     * @param {object} updateData - An object containing the properties to update.
     * @param {string} [userId] - The user whose test to update.
     */
    static async updateTest(dialogId, updateData, userId) {
        if  (!userId) {
        userId = await game.user.id;
        }
        const user = game.users.get(userId);
        if (!user) return;

        const currentState = await this.readState(userId);
        if (currentState[dialogId]) {
            // Merge the new data into the existing state for that test
            foundry.utils.mergeObject(currentState[dialogId], updateData);
            await user.setFlag(MODULE_ID, FLAG_KEY_AppTest, currentState);
        }
    }

    /**
     * DELETES all test data from a specific user's flag.
     * @param {string} [userId] - The user whose flag to clear.
     */
    static async deleteState(userId) {
        if  (!userId) {
        userId = await game.user.id;
        }
        const user = game.users.get(userId);
        if (user) {
            console.log(`Clearing all test state flags for user ${user.name}.`);
            return user.unsetFlag(MODULE_ID, FLAG_KEY_AppTest);
        }
    }

    /**
     * @summary Toggles a modifier in the test state, enforcing exclusivity rules.
     * @param {string} dialogId - The ID of the test state to update.
     * @param {object} modifierData - The modifier object to toggle ({label, value}).
     * @param {string} [userId] - The user whose test to update.
     */
    static async toggleModifier(dialogId, modifierData, userId ) {
        if  (!userId) {
        userId = await game.user.id;
        }
        const user = game.users.get(userId);
        if (!user) return;

        const currentState = await this.readState(userId);
        if (!currentState[dialogId]) return;

        const testState = currentState[dialogId];
        testState.modifier = testState.modifier ?? [];

        const { label, value } = modifierData;
        const existingIndex = testState.modifier.findIndex(m => m.label === label);

        if (existingIndex > -1) {
            // If the clicked modifier is already active, remove it.
            testState.modifier.splice(existingIndex, 1);
        } else {
            // If it's a new modifier, add it after applying exclusivity rules.
            // Check if the new modifier belongs to any exclusive group.
            const groupKey = Object.keys(this.#SOCIAL_MODIFIER_GROUPS).find(key => 
                this.#SOCIAL_MODIFIER_GROUPS[key].includes(label)
            );

            if (groupKey) {
                // If it does, first remove any other modifiers from that same group.
                const groupMembers = this.#SOCIAL_MODIFIER_GROUPS[groupKey];
                testState.modifier = testState.modifier.filter(mod => !groupMembers.includes(mod.label));
            }
            
            // Add the new modifier.
            testState.modifier.push(modifierData);
        }

        // Save the updated state.
        await this.updateTest(dialogId, currentState,userId);
    }
}

/**
 * CONSOL SCRIPT:
 * Find
 * (async () => {
    const scope = "sr5-marketplace";
    const key = "appTestState";
    const flagData = await game.user.getFlag(scope, key);

    if (flagData) {
        console.log(`Flag '${key}' found for user ${game.user.name}:`, flagData);
        ui.notifications.info("Flag data logged to console (F12).");
    } else {
        console.log(`No flag '${key}' found for user ${game.user.name}.`);
        ui.notifications.warn("No test state flag found.");
    }
})();
 */

/**
 * CONSOL SCRIPT DELTE:
 * 
 * (async () => {
    const scope = "sr5-marketplace";
    const key = "appTestState";

    const confirmed = await Dialog.confirm({
        title: "Delete Test State Flag",
        content: `<p>Are you sure you want to delete the entire <strong>${key}</strong> flag for your user? This is useful for debugging but cannot be undone.</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: false
    });

    if (confirmed) {
        await game.user.unsetFlag(scope, key);
        console.log(`Flag '${scope}.${key}' has been deleted for user ${game.user.name}.`);
        ui.notifications.info("The app test state flag has been deleted.");
    } else {
        console.log("Flag deletion was canceled.");
    }
})();
 */