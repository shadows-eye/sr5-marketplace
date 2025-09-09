import { DialogModifierService } from './DialogModifierService.mjs';
import { DiceHelperService } from './DiceHelperService.mjs';
import parseAvailability from '../lib/availabilityParser.mjs';

export class AppDialogBuilder {
    constructor() {
        this.testState = null;
    }

    static async getActor(uuid) {
        if (!uuid) return null;
        return await fromUuid(uuid);
    }
    static async getItem(uuid) {
        if (!uuid) return null;
        return await fromUuid(uuid);
    }

    /**
     * @summary The single public entry point for building the test UI context.
     * @description This method acts as a router. It takes the test state, determines the
     * current status, and calls the appropriate private builder to get the final context.
     * @param {object} testState - The active test state object from the user flag.
     * @returns {Promise<object|null>} The context object ready for the template.
     */
    async buildContext(testState) {
        this.testState = testState;
        if (!this.testState) return null;

        switch (this.testState.status) {
            case 'initial':
                return this.#buildInitialContext();
            case 'result':
                return this.#buildResultContext();
            case 'extended-inprogress':
                return this.#buildExtendedInProgressContext();
            case 'resolved':
                return this.#buildResolvedContext();
            default:
                console.error(`Unknown test status: "${this.testState.status}"`);
                return null;
        }
    }

    /** @private Builds context for the 'initial' state. */
    async #buildInitialContext() {
        const { actorUuid, skill, attribute, connectionUuid, availabilityStr, appliedModifiers } = this.testState;
        
        const actor = await this.constructor.getActor(actorUuid);
        if (!actor) return null;

        const dicePoolBreakdown = [];
        let totalDicePool = 0;
        
        const skillData = actor.system.skills.active[skill];
        if (skillData) {
            const skillLabel = game.i18n.localize(CONFIG.SR5.activeSkills[skill]);
            dicePoolBreakdown.push({ label: skillLabel, value: skillData.value });
            totalDicePool += skillData.value;
        }

        const attributeData = actor.system.attributes[attribute];
        if (attributeData) {
            const attributeLabel = game.i18n.localize(`FIELDS.attributes.${attribute}.label`);
            dicePoolBreakdown.push({ label: attributeLabel, value: attributeData.value });
            totalDicePool += attributeData.value;
        }

        if (Array.isArray(appliedModifiers)) {
            appliedModifiers.forEach(mod => {
                dicePoolBreakdown.push({ label: mod.label, value: mod.value });
                totalDicePool += mod.value;
            });
        }
        
        if (connectionUuid) {
            const contactItem = await this.constructor.getItem(connectionUuid);
            if (contactItem) {
                dicePoolBreakdown.push({ label: game.i18n.localize("SR5.Connection"), value: contactItem.system.connection });
                totalDicePool += contactItem.system.connection;
                dicePoolBreakdown.push({ label: game.i18n.localize("SR5.Loyalty"), value: contactItem.system.loyalty });
                totalDicePool += contactItem.system.loyalty;
            }
        }

        
        // It uses the 'skill' from the test state to get the correct list of 
        // situational modifiers that should be displayed in the UI.
        const modifierGroups = DialogModifierService.getModifiersForTest({ skill });

        return {
            actor,
            availabilityStr,
            modifierGroups, // The modifier groups are now guaranteed to be included
            dicePoolBreakdown,
            totalDicePool
        };
    }

    /** 
     * @private Builds context for the 'result' state (opposed tests). 
    */
    #buildResultContext() {
        const resultData = this.testState.result;
        const rollsData = this.testState.rolls;

        const diceResults = rollsData?.[0]?.terms[0]?.results || [];
        const glitches = resultData.values.glitches.value;
        const totalDice = diceResults.length;

        // --- THIS IS THE FIX ---
        // Create an object that has the exact .diceResults and .values.glitches
        // structure that your unchanged DiceHelperService is expecting.
        const resultForHelper = {
            diceResults: diceResults,
            values: {
                glitches: {
                    value: glitches
                }
            }
        };
        
        const renderedDice = DiceHelperService.processDice(resultForHelper);

        return {
            renderedDice: renderedDice,
            hits: resultData.values.hits.value,
            glitches: glitches,
            isGlitch: totalDice > 0 ? (glitches > (totalDice / 2)) : false,
        };
    }

    /** @private Builds context for the 'extended-inprogress' state. */
    #buildExtendedInProgressContext() {
        const testData = this.testState.result;
        const lastRollData = { diceResults: testData.rolls[testData.rolls.length - 1]?.terms[0]?.results || [] };

        return {
            cumulativeHits: testData.values.extendedHits.value,
            threshold: testData.threshold.value,
            currentPool: testData.pool.value,
            renderedDice: DiceHelperService.processDice(lastRollData),
        };
    }

    /** @private Builds context for the 'resolved' state. */
    #buildResolvedContext() {
        switch (this.testState.testType) {
            case "opposed":
                return this.#_buildOpposedResolvedContext();
            case "simple":
            case "extended":
                return this.#_buildSimpleResolvedContext();
            default:
                console.error(`Unknown test type "${this.testState.testType}" in buildResolvedDialogContext.`);
                return null;
        }
    }

    #_buildOpposedResolvedContext() {
        const initialResult = this.testState.result;
        const resistResult = this.testState.resistResult;

        return {
            isAvailable: !resistResult.success,
            initialRoll: {
                netHits: initialResult.values.netHits.value,
                renderedDice: DiceHelperService.processDice(initialResult)
            },
            resistRoll: {
                hits: resistResult.values.hits.value,
                renderedDice: DiceHelperService.processDice(resistResult)
            }
        };
    }

    #_buildSimpleResolvedContext() {
        const initialResult = this.testState.result || {};
        const threshold = parseAvailability(this.testState.availabilityStr).rating;

        return {
            isAvailable: initialResult.success ?? false,
            initialRoll: {
                netHits: initialResult.values?.netHits?.value ?? 0,
                renderedDice: DiceHelperService.processDice(initialResult),
                threshold: threshold
            }
        };
    }
}