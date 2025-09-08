import { DialogModifierService } from './DialogModifierService.mjs';
import { AppTestFlagService } from './AppTestFlagService.mjs';
import { DiceHelperService } from './DiceHelperService.mjs';
import parseAvailability from '../lib/availabilityParser.mjs';
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
     * Loads the test state from the user flag using a provided ID.
     * @param {string} dialogId - The ID of the test state to load.
     * @returns {Promise<boolean>} True if state was loaded successfully.
     */
    async loadState(dialogId) {
        // --- THIS IS THE FIX, as you described ---
        // 1. Set the instance's dialogId from the parameter.
        this.dialogId = dialogId;
        // 2. Check if the ID is valid.
        if (!this.dialogId) return false;

        // 3. The rest of the function now works correctly.
        const userId = await game.user.id;
        const allState = await AppTestFlagService.readState(userId);
        this.testState = allState[this.dialogId];
        return !!this.testState;
    }

    /**
     * Builds the context for the initial test dialog (the player's roll).
     * @param {object} initialParams - Data to start a new test.
     * @param {string} initialParams.actorUuid - The UUID of the actor performing the test.
     * @param {string[]} initialParams.itemUuids - The item UUIDs for the test.
     * @param {string} initialParams.skill - The selectedSkill
     * @param {string} initialParams.attribute - The selectedAttribute
     * @param {string} initialParams.connectionUuid - The connectionUuid
     * @returns {Promise<object|null>} The context for the Handlebars template.
     */
    async buildInitialTestDialogContext({ actorUuid, itemUuids, skill, attribute, connectionUuid, availabilityStr, modifiers, ...rest }) {
        const actor = await this.constructor.getActor(actorUuid);
        if (!actor) return null;

        // 1. Prepare base data and the dice pool breakdown array.
        const dicePoolBreakdown = [];
        let totalDicePool = 0;

        // 2. Get Skill and Attribute values.
        const skillData = actor.system.skills.active[skill];
        const attributeData = actor.system.attributes[attribute];

        if (skillData) {
            const skillLabel = game.i18n.localize(CONFIG.SR5.activeSkills[skill]);
            dicePoolBreakdown.push({ label: skillLabel, value: skillData.value });
            totalDicePool += skillData.value;
        }
        if (attributeData) {
            const attributeLabel = game.i18n.localize(`FIELDS.attributes.${attribute}.label`);
            dicePoolBreakdown.push({ label: attributeLabel, value: attributeData.value });
            totalDicePool += attributeData.value;
        }

        // 3. Get modifiers from the active test state.
        if (Array.isArray(modifiers)) {
            modifiers.forEach(mod => {
                dicePoolBreakdown.push({ label: mod.label, value: mod.value });
                totalDicePool += mod.value;
            });
        }
        
        // 4. Get Connection and Loyalty from the selected contact, if any.
        if (connectionUuid) {
            const contactItem = await this.constructor.getItem(connectionUuid);
            if (contactItem) {
                dicePoolBreakdown.push({ label: game.i18n.localize("SR5.Connection"), value: contactItem.system.connection });
                totalDicePool += contactItem.system.connection;
                dicePoolBreakdown.push({ label: game.i18n.localize("SR5.Loyalty"), value: contactItem.system.loyalty });
                totalDicePool += contactItem.system.loyalty;
            }
        }

        // 5. Get modifier groups for the UI.
        const modifierGroups = DialogModifierService.getModifiersForTest({ skill });

        return {
            dialogId: this.dialogId,
            actor,
            availabilityStr: availabilityStr,
            modifierGroups,
            dicePoolBreakdown: dicePoolBreakdown, // The array of parts
            totalDicePool: totalDicePool,         // The final sum
            ...rest
        };
    }

    /**
     * @summary Builds the context for the final, resolved view of the test.
     * @description This method is called when the test status is 'resolved'. It processes
     * the results of both the initial roll and the resist roll, determines the final
     * outcome (is the item available?), and prepares both sets of dice for rendering.
     * @param {object} params - The parameters for the builder.
     * @param {string} params.dialogId - The ID of the test state to build the context for.
     * @returns {Promise<object|null>} The context for the Handlebars template.
     */
    async buildResolvedDialogContext({dialogId, ...rest }) {
        if (!await this.loadState(dialogId) || !this.testState.result) {
            console.log("Resolved context cannot be built: Missing test state or initial result.", this.testState);
            return null;
        }

        switch (this.testState.testType) {
            case "opposed":
                return this.#_buildOpposedResolvedContext(rest);
            case "simple":
            case "extended":
                return this.#_buildSimpleResolvedContext(rest);
            default:
                console.error(`Unknown test type "${this.testState.testType}" in buildResolvedDialogContext.`);
                return null;
        }
    }

    /**
     * @summary Builds the context for a resolved OPPOSED test.
     * @description Handles the two-roll outcome, comparing player hits to item resistance.
     * @private
     */
    #_buildOpposedResolvedContext(rest) {
        if (!this.testState.resistResult) {
            console.log("Opposed context cannot be built: Missing resistResult.", this.testState);
            return null;
        }
        const initialResult = this.testState.result;
        const resistResult = this.testState.resistResult;

        const isAvailable = !resistResult.success;
        const initialDice = DiceHelperService.processDice(initialResult);
        const resistDice = DiceHelperService.processDice(resistResult);

        return {
            dialogId: this.dialogId,
            isAvailable: isAvailable,
            initialRoll: {
                netHits: initialResult.values.netHits.value,
                renderedDice: initialDice
            },
            resistRoll: {
                hits: resistResult.values.hits.value,
                renderedDice: resistDice
            },
            ...rest
        };
    }

    /**
     * @summary Builds the context for a resolved SIMPLE or EXTENDED test.
     * @description This version is now robust and safely handles data.
     * @private
     */
    #_buildSimpleResolvedContext(rest) {
        const initialResult = this.testState.result || {};

        // 1. Safely access properties using optional chaining (?.) and provide defaults (??).
        const isAvailable = initialResult.success ?? false;
        const netHits = initialResult.values?.netHits?.value ?? 0;

        // 2. The threshold for a simple test IS the availability rating.
        //    We can reliably get it by parsing the availabilityStr from the main test state.
        const threshold = parseAvailability(this.testState.availabilityStr).rating;
        
        // 3. The DiceHelper can now safely process the dice results.
        const initialDice = DiceHelperService.processDice(initialResult);

        return {
            dialogId: this.dialogId,
            isAvailable: isAvailable,
            initialRoll: {
                netHits: netHits,
                renderedDice: initialDice,
                threshold: threshold
            },
            ...rest
        };
    }

    /**
     * Builds the context for the result view.
     * @param {string} dialogId - The ID of the test state to build the context for.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<object|null>} The context for the Handlebars template.
     */
    async buildResultDialogContext({dialogId, ...rest}) {
        // 1. Load the specific test state using the provided IDs.
        if (!await this.loadState(dialogId) || !this.testState.result) return null;

        const  initialResult = this.testState.result;

        // 2. Pass the result object to the DiceHelperService.
        const renderedDice = DiceHelperService.processDice(initialResult);

        // 3. Return the prepared context.
        return {
            dialogId: this.dialogId,
            renderedDice: renderedDice,
            hits: initialResult.values.hits.value,
            glitches: initialResult.values.glitches.value,
            isGlitch: initialResult.values.glitches.value > (initialResult.diceResults.length / 2),
            ...rest
        };
    }
}