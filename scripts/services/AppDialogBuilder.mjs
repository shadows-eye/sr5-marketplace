import { DialogModifierService } from './DialogModifierService.mjs';
import { AppTestFlagService } from './AppTestFlagService.mjs';

/**
 * @summary Builds and manages the data context for the multi-step in-app Availability Test.
 * @description This class is the central engine for the test workflow. It fetches documents,
 * reads and writes test state to user flags, and prepares data contexts for rendering the
 * different stages of the test dialog (initial roll, resist roll, and final result).
 */
export class AppDialogBuilder {
    /**
     * @param {object} params - The parameters for the builder.
     * @param {string|null} [params.dialogId=null] - The existing ID of a test in progress.
     */
    constructor({ dialogId = null } = {}) {
        this.dialogId = dialogId;
        this.testState = null;
    }

    /**
     * A static helper to get a full Actor document from a UUID.
     * @param {string} uuid - The actor's UUID.
     * @returns {Promise<Actor|null>}
     */
    static async getActor(uuid) {
        if (!uuid) return null;
        return await fromUuid(uuid);
    }

    /**
     * A static helper to get a full Item document from a UUID.
     * @param {string} uuid - The item's UUID.
     * @returns {Promise<Item|null>}
     */
    static async getItem(uuid) {
        if (!uuid) return null;
        return await fromUuid(uuid);
    }

    /**
     * A static helper to find a linked actor's UUID from a Connection/Contact item's UUID.
     * @param {string} connectionUuid - The UUID of the Connection item.
     * @returns {Promise<string|null>} The linked actor's UUID or null.
     */
    static async getActorUuidFromConnection(connectionUuid) {
        if (!connectionUuid) return null;
        const connectionItem = await fromUuid(connectionUuid);
        // Adjust the path `system.actorUuid` if your data model is different.
        return connectionItem?.system?.actorUuid || null;
    }

    /**
     * Loads the test state from the user flag if a dialogId is present.
     * @returns {Promise<boolean>} True if state was loaded successfully.
     */
    async loadState() {
        if (!this.dialogId) return false;
        const allState = await AppTestFlagService.getState();
        this.testState = allState[this.dialogId];
        return !!this.testState;
    }

    /**
     * Builds the context for the initial test dialog (the player's roll).
     * @param {object} initialParams - Data to start a new test.
     * @param {string} initialParams.actorUuid - The UUID of the actor performing the test.
     * @param {string[]} initialParams.itemUuids - The item UUIDs for the test.
     * @returns {Promise<object|null>} The context for the Handlebars template.
     */
    async buildInitialDialogContext({ actorUuid, itemUuids }) {
        const actor = await this.constructor.getActor(actorUuid);
        const items = (await Promise.all(itemUuids.map(uuid => this.constructor.getItem(uuid)))).filter(i => i);
        if (!actor || items.length === 0) return null;

        // Create a new test state in the user's flag
        this.dialogId = await AppTestFlagService.createTest({ actorUuid, itemUuids });
        
        // Calculate combined availability (this logic can be expanded for your house rules)
        const totalAvailabilityRating = items.reduce((total, item) => {
            const availStr = item.system.technology?.availability?.value || "0";
            return total + (parseInt(availStr.match(/^(\d+)/)?.[1] || "0", 10));
        }, 0);
        
        const modifierGroups = DialogModifierService.getModifiersForTest({ selectedSkill: 'negotiation' });

        return {
            dialogId: this.dialogId, // Pass the ID to the template
            actor,
            availabilityStr: `${totalAvailabilityRating}R`,
            modifierGroups,
            context: 'initial' // A flag to tell the template which view to render
        };
    }

    /**
     * Builds the context for the resist test dialog (the item's roll).
     * @returns {Promise<object|null>} The context for the Handlebars template.
     */
    async buildResistDialogContext() {
        if (!await this.loadState() || !this.testState.result) return null;

        const actor = await this.constructor.getActor(this.testState.actorUuid);
        const initialResult = this.testState.result;

        // The context for the resist roll view
        return {
            dialogId: this.dialogId,
            actor,
            initialResult, // Pass the first result to the template
            context: 'resist' // A flag to tell the template to show the resist UI
        };
    }
}