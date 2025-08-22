import { DialogModifierService } from './DialogModifierService.mjs';

/**
 * @summary A service that builds the data context for the in-app Availability Test dialog.
 * @description This class accepts actorUuid, connectionUuid with actorUuid linked, and item UUIDs, fetches the required
 * documents, and prepares a complete data object for rendering the test dialog partial.
 * It includes logic to find a valid actor via a connection if one is not directly provided.
 */
export class AppDialogBuilder {
    /**
     * @param {object} params - The parameters for the builder.
     * @param {string|null} [params.actorUuid=null] - The UUID of the actor performing the test.
     * @param {string|null} [params.connectionUuid=null] - The UUID of a Connection/Contact item to use as a fallback for finding an actor.
     * @param {string[]} [params.itemUuids=[]] - An array of item UUIDs to be included in the availability test.
     */
    constructor({ actorUuid = null, connectionUuid = null, itemUuids = [] }) {
        this.actorUuid = actorUuid;
        this.connectionUuid = connectionUuid;
        this.itemUuids = itemUuids;
        this.itemDataService = game.sr5marketplace.itemData; // Assuming service is globally available
    }

    /**
     * Resolves the correct actor to use for the test.
     * It prioritizes the explicitly provided actorUuid, then falls back to finding
     * an actor linked on the connection item.
     * @returns {Promise<Actor|null>} The resolved actor document or null if none found.
     * @private
     */
    async _resolveActor() {
        // 1. Prioritize the explicitly provided actor.
        if (this.actorUuid) {
            const actor = await fromUuid(this.actorUuid);
            if (actor) return actor;
        }

        // 2. If no actor, fall back to the connection.
        if (this.connectionUuid) {
            const connectionItem = await fromUuid(this.connectionUuid);
            // Assuming the linked actor's UUID is stored in the connection item's system data.
            // Adjust the path `system.actorUuid` if it's stored elsewhere.
            const linkedActorUuid = connectionItem?.system?.actorUuid;
            if (linkedActorUuid) {
                const actor = await fromUuid(linkedActorUuid);
                if (actor) return actor;
            }
        }

        // 3. If no actor could be found, return null.
        return null;
    }

    /**
     * Builds and returns the complete context for the AvailabilityDialog partial.
     * If a valid actor cannot be found, it returns null.
     * @param {object} [context={}] - Additional context, like the currently selected skill.
     * @returns {Promise<object|null>} The data object for the Handlebars template, or null.
     */
    async buildContext(context = {}) {
        const actor = await this._resolveActor();
        if (!actor) {
            console.warn("AppDialogBuilder | A valid actor could not be resolved for the test.");
            return null; // Return null to signal failure
        }

        const items = (await Promise.all(this.itemUuids.map(uuid => fromUuid(uuid)))).filter(i => i);
        if (items.length === 0) {
            console.warn("AppDialogBuilder | No valid items were provided for the test.");
            return null;
        }

        // Calculate the combined availability for all items.
        let totalAvailabilityRating = 0;
        items.forEach(item => {
            const availabilityStr = item.system.technology?.availability?.value || "0";
            const rating = parseInt(availabilityStr.match(/^(\d+)/)?.[1] || "0", 10);
            totalAvailabilityRating += rating;
        });
        const finalAvailabilityStr = `${totalAvailabilityRating}R`;

        // Get the list of relevant situational modifiers.
        const modifierGroups = DialogModifierService.getModifiersForTest({
            selectedSkill: context.selectedSkill || 'negotiation'
        });
        
        const houseRuleActive = false;

        // Assemble and return the final context object.
        return {
            actor: actor,
            availabilityStr: finalAvailabilityStr,
            modifierGroups: modifierGroups,
            houseRuleActive: houseRuleActive,
        };
    }
}