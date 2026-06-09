import { MODULE_ID, SELECTED_ACTOR } from "../lib/constants.mjs";

/**
 * Service to manage active/selected actors in the marketplace and item builder.
 * Resolves the actor based on flags, characters, or controlled canvas tokens.
 */
export class ActorSelectionService {
    /**
     * Resolves the active actor based on:
     * 1. The user's selected actor flag (selectedActorUuid).
     * 2. The user's default character (game.user.character).
     * 3. The first controlled token's actor on the canvas (canvas.tokens.controlled[0]?.actor).
     * @returns {Promise<Actor|null>} The resolved Actor document, or null if none is found.
     */
    static async getSelectedActor() {
        if (typeof game === "undefined" || !game.user) return null;

        const selectedActorUuid = game.user.getFlag(MODULE_ID, SELECTED_ACTOR);
        let actor = null;
        if (selectedActorUuid) {
            const doc = await fromUuid(selectedActorUuid);
            actor = doc instanceof Actor ? doc : doc?.actor || null;
        }

        if (!actor) {
            actor = game.user.character || null;
        }

        if (!actor && typeof canvas !== "undefined" && canvas.ready && canvas.tokens) {
            actor = canvas.tokens.controlled[0]?.actor || null;
        }

        return actor;
    }

    /**
     * Sets the player's active selected actor flag.
     * @param {string} actorUuid - The UUID of the selected actor.
     * @returns {Promise<User>}
     */
    static async setSelectedActor(actorUuid) {
        if (typeof game === "undefined" || !game.user) return;
        return await game.user.setFlag(MODULE_ID, SELECTED_ACTOR, actorUuid);
    }

    /**
     * Clears the player's active selected actor flag.
     * @returns {Promise<User>}
     */
    static async clearSelectedActor() {
        if (typeof game === "undefined" || !game.user) return;
        return await game.user.unsetFlag(MODULE_ID, SELECTED_ACTOR);
    }
}
