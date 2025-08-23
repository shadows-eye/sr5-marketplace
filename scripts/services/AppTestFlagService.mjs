import { MODULE_ID, CurrentUserId, FLAG_KEY_AppTest } from '../lib/constants.mjs';

/**
 * @summary Manages the state of in-app tests via a user flag.
 */
export class AppTestFlagService {

    /**
     * Gets the entire test state object from the current user's flag.
     * @returns {Promise<object>}
     */
    static async getState() {
        return game.user.getFlag(MODULE_ID, FLAG_KEY_AppTest) || {};
    }

    /**
     * Saves the entire test state object to the current user's flag.
     * @param {object} state The state object to save.
     */
    static async saveState(state) {
        return game.user.setFlag(MODULE_ID, FLAG_KEY_AppTest, state);
    }

    /**
     * Creates a new test entry in the flag with initial data.
     * @param {object} initialData - The data to initialize the test with.
     * @returns {Promise<string>} The unique ID of the newly created dialog state.
     */
    static async createTest(initialData) {
        const dialogId = foundry.utils.randomID();
        const currentState = await this.getState();
        
        currentState[dialogId] = {
            id: dialogId,
            ...initialData,
            result: null, // Initialize result as null
            //status set on initialData
            resistResult: null, // Initialize resistResult as null
            teamWork: null, // Initialize teamWork as null
            extendedTest: null, // Initialize extendedTest as null
            resolved: false, // Initialize resolved as false can be set to true ending the Teamwork or Exstended Test
        };

        await this.saveState(currentState);
        return dialogId;
    }

    /**
     * Updates an existing test entry with a result object.
     * @param {string} dialogId - The ID of the test state to update.
     * @param {object} result - The result object from the executed test.
     */
    static async updateTestWithResult(dialogId, result) {
        const currentState = await this.getState();
        if (currentState[dialogId]) {
            currentState[dialogId].result = result;
            currentState[dialogId].resistResult= resistResult ;
            currentState[dialogId].extendedTest = extendedTest || null;
            currentState[dialogId].resolved = resolved || false;
            currentState[dialogId].teamWork = teamworkResult || null;
            currentState[dialogId].status = 'result'; // Update status
            await this.saveState(currentState);
        }
    }

    /**
     * Clears a specific test or all tests from the flag.
     * @param {string|null} [dialogId=null] - The ID of the test to clear. If null, clears all.
     */
    static async clearTest(dialogId = null) {
        if (dialogId) {
            const currentState = await this.getState();
            delete currentState[dialogId];
            await this.saveState(currentState);
        } else {
            // Unset the entire flag for the current user
            await game.user.unsetFlag(MODULE_ID, FLAG_KEY_AppTest);
        }
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