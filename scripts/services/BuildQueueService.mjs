import { MODULE_ID } from '../lib/constants.mjs';
import { BuilderStateService } from './builderStateService.mjs';

const FLAG_SCOPE = MODULE_ID;
const FLAG_KEY = "itemBuilderQueue";

/**
 * A service to manage the queue of items waiting to be built or submitted to the GM.
 */
export class BuildQueueService {

    /**
     * Returns the default structure for the build queue flag.
     * @private
     */
    _getDefaultState() {
        return {
            builds: [] // An array of completed build objects
        };
    }

    /**
     * Gets the entire build queue for the current user.
     * @returns {Promise<object>}
     */
    async getQueue() {
        const savedQueue = await game.user.getFlag(FLAG_SCOPE, FLAG_KEY) || {};
        return foundry.utils.mergeObject(this._getDefaultState(), savedQueue);
    }

    /**
     * Saves the entire build queue back to the user's flag.
     * @param {object} queue - The entire queue state object to save.
     */
    async saveQueue(queue) {
        return game.user.setFlag(FLAG_SCOPE, FLAG_KEY, queue);
    }

    /**
     * Takes the currently active build from the BuilderStateService,
     * adds it to the queue, and clears the active build state.
     */
    async addCurrentBuildToQueue() {
        const currentBuild = await BuilderStateService.getState();
        if (!currentBuild.baseItem) {
            return ui.notifications.warn("There is no active item to add to the queue.");
        }

        const queue = await this.getQueue();
        
        // Add a unique ID to the build for easy reference later
        currentBuild.buildId = foundry.utils.randomID();
        
        queue.builds.push(currentBuild);
        await this.saveQueue(queue);

        // Clear the active builder so the user can start a new item
        await BuilderStateService.clearState();
        ui.notifications.info(`'${currentBuild.baseItem.name}' added to the creation queue.`);
    }

    /**
     * Removes a build from the queue by its unique ID.
     * @param {string} buildId - The ID of the build to remove.
     */
    async removeBuildFromQueue(buildId) {
        const queue = await this.getQueue();
        queue.builds = queue.builds.filter(b => b.buildId !== buildId);
        await this.saveQueue(queue);
    }

    /**
     * Clears the entire build queue.
     */
    async clearQueue() {
        await game.user.unsetFlag(FLAG_SCOPE, FLAG_KEY);
    }
}