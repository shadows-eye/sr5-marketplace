import { MODULE_ID, FLAG_KEY_AppTest } from '../lib/constants.mjs';

/**
 * @summary Manages the state of in-app tests via a user flag.
 * @description This service handles creating, reading, updating, and deleting test
 * state objects stored in a user's flags, ensuring a persistent, multi-step
 * test workflow within the application.
 */
export class AppTestFlagService {

    /**
     * Gets the entire test state object from a specific user's flag.
     * @param {string} [userId] - The ID of the user to get the flag from.
     * @returns {Promise<object>} The test state object, or an empty object if not found.
     */
    static async getState(userId) {
        const user = game.users.get(userId);
        if (!user) return {};
        return user.getFlag(MODULE_ID, FLAG_KEY_AppTest) || {};
    }

    /**
     * Saves the entire test state object to a specific user's flag.
     * @param {object} state - The state object to save.
     * @param {string|null} [userId=null] - The ID of the user to save the flag for. Defaults to the current user.
     */
    static async saveState(state, userId = null) {
        // 1. Determine the target user. Use the provided userId or default to the current game user.
        const user = userId ? game.users.get(userId) : game.user;

        // 2. Ensure a valid user was found before proceeding.
        if (!user) {
            console.error(`AppTestFlagService | Could not find user with ID "${userId}" to save flag.`);
            return;
        }
        
        // 3. Log the action and set the flag for the resolved user.
        console.log(`Saving flag '${FLAG_KEY_AppTest}' for user ${user.name}:`, state);
        return user.setFlag(MODULE_ID, FLAG_KEY_AppTest, state);
    }

    /**
     * Creates a new test entry in the flag. Before creating, it removes any old,
     * unresolved tests for the same set of items to prevent duplicates.
     * @param {object} initialData - The data to initialize the test with.
     * @returns {Promise<string>} The unique ID of the newly created dialog state.
     */
    static async createTest(initialData) {
        const dialogId = foundry.utils.randomID();
        let currentState = await this.getState();

        // --- NEW: Clean up old, unresolved tests before creating a new one ---
        const oldTestIds = Object.keys(currentState).filter(id => {
            const test = currentState[id];
            // Find any previous tests that are unresolved
            return !test.resolved;
        });

        // If we found any old tests, remove them.
        for (const id of oldTestIds) {
            delete currentState[id];
        }

        // Add the new test to the state
        currentState[dialogId] = {
            id: dialogId,
            status: 'initial',
            ...initialData,
            result: null,
            resistResult: null,
            resolved: false
        };

        await this.saveState(currentState);
        return dialogId;
    }

    /**
     * Updates an existing test entry with a result object.
     * @param {string} dialogId - The ID of the test state to update.
     * @param {object} resultData - The result object from the executed test.
     */
    static async updateTestWithResult(dialogId, resultData) {
        const currentState = await this.getState();
        if (currentState[dialogId]) {
            currentState[dialogId].result = resultData;
            currentState[dialogId].status = 'result'; // Update status
            await this.saveState(currentState);
        }
    }

    /**
     * Clears all test data from the current user's flag.
     */
    static async clearAllTests() {
        console.log("Clearing all test state flags for current user."); // LOGGING
        return game.user.unsetFlag(MODULE_ID, FLAG_KEY_AppTest);
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