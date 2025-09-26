import { DialogTestModifierService } from './DialogModifierService.mjs';
import { DiceHelperService } from '../../../services/DiceHelperService.mjs';
import { DeliveryTimeService } from '../../../services/DeliveryTimeService.mjs';
import { AppTestFlagService } from '../../../services/AppTestFlagService.mjs';
import parseAvailability from '../../../lib/availabilityParser.mjs';

/**
* @param {object|null} activeTestState - The active test state from the flag.
 */
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
     * @param {object} basket - The basket that the test will go into
     * @returns {Promise<object|null>} The context object ready for the template.
     */
    async buildTestDialogContext(testState, basket=null) {
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
                return await this.#buildResolvedContext(basket);
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
        let connectionUsed = 0;
        
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
                connectionUsed = contactItem.system.connection;
                dicePoolBreakdown.push({ label: game.i18n.localize("SR5.Connection"), value: contactItem.system.connection });
                totalDicePool += contactItem.system.connection;
                dicePoolBreakdown.push({ label: game.i18n.localize("SR5.Loyalty"), value: contactItem.system.loyalty });
                totalDicePool += contactItem.system.loyalty;
            }
        }

        
        // It uses the 'skill' from the test state to get the correct list of 
        // situational modifiers that should be displayed in the UI.
        const modifierGroups = DialogTestModifierService.getModifiersForTest({ skill });

        return {
            actor,
            availabilityStr,
            modifierGroups, // The modifier groups are now guaranteed to be included
            dicePoolBreakdown,
            totalDicePool,
            connectionUsed: connectionUsed
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
        const resultData = this.testState.result; // This is the object with the calculated 'values'.
        const rollsData = this.testState.rolls;   // This is the separate array with the raw dice rolls.

        // 1. For an extended test, we always want to show the results of the MOST RECENT roll.
        const lastRoll = rollsData?.[rollsData.length - 1];
        
        // 2. Extract the dice results from the correct path inside the 'lastRoll' object.
        const diceResults = lastRoll?.terms[0]?.results || [];
        const glitches = resultData.values.glitches.value;

        // 3. Create a purpose-built object to pass to your unchanged DiceHelperService.
        const resultForHelper = {
            diceResults: diceResults,
            values: {
                glitches: {
                    value: glitches
                }
            }
        };
        const renderedDice = DiceHelperService.processDice(resultForHelper);
        
        // 4. Return the complete context for the "in-progress" template.
        return {
            cumulativeHits: resultData.values.extendedHits.value,
            threshold: resultData.threshold.value,
            currentPool: resultData.pool.value,
            renderedDice: renderedDice
        };
    }

    /**
     * @private Builds context for the 'resolved' state.
     * @param {object} basket - The basket from the build of the basket passed as dataObject
     */
    async #buildResolvedContext(basket) {
        // --- THIS IS THE ROUTER ON RESOLVED BASED ON RULE in testState.testType (read from the settings [opposed, simple, extended])---
        switch (this.testState.testType) {
            case "opposed":
                return this.#_buildOpposedResolvedContext();
            case "simple":
                return this.#_buildSimpleResolvedContext();
            case "extended":
                return await this.#_buildExtendedResolvedContext(basket); // <-- New dedicated path
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

    /** * @private Builds context for a resolved EXTENDED test. 
     * This new method contains the logic we developed previously.
     */
    async #_buildExtendedResolvedContext(basket) {
        const resultData = this.testState.result;
        const rollsData = this.testState.rolls;

        // 1. Final success is based on the CUMULATIVE hits.
        const isAvailable = resultData.values.extendedHits.value >= resultData.threshold.value;
        const finalNetHits = Math.max(0, resultData.values.extendedHits.value - resultData.threshold.value);

        let finalBasket = basket;

        // 2. Check if the provided basket is missing or empty.
        if (!finalBasket || Object.keys(finalBasket).length === 0) {
            console.log("AppDialogBuilder | Basket not provided or empty, fetching from flag as a fallback.");
            // 3. If so, fetch it from the flag and assign it to our 'let' variable.
            finalBasket = await AppTestFlagService.readBasket();
        }
        const totalCost = finalBasket.totalCost || 0;
        
        // 2. Use our service to get the delivery times.
        const baseDeliveryTime = DeliveryTimeService.getBaseDeliveryTime(totalCost);
        const finalDeliveryTime = DeliveryTimeService.calculateFinalDeliveryTime(baseDeliveryTime, this.testState.rollCount);
        // --- Test Availability ---
        const localizedTimeUnit = game.i18n.localize(baseDeliveryTime.unit);
        
        const lastRoll = rollsData?.[rollsData.length - 1];
        const lastDiceResults = lastRoll?.terms[0]?.results || [];
        const lastGlitches = resultData.values.glitches.value;
        
        const resultForHelper = {
            diceResults: lastDiceResults,
            values: { glitches: { value: lastGlitches } }
        };

        // 3. Return the complete context for the final "resolved" template.
        return {
            isAvailable: isAvailable,
            initialRoll: {
                netHits: finalNetHits,
                renderedDice: DiceHelperService.processDice(resultForHelper),
                threshold: resultData.threshold.value,
                cumulativeHits: resultData.values.extendedHits.value
            },
            totalRolls: this.testState.rollCount,
            deliveryTime: finalDeliveryTime,
            connectionUsed: this.testState.connectionUsed,
            localizedTimeUnit: localizedTimeUnit

        };
    }

    //--- Item Dialog Builder Functions ---//
    
    /**
     * Builds the context required for rendering the Effects tab in the Item Builder.
     * It groups effects by their source item (base item and slotted items).
     * @param {object} builderState - The full state object from the BuilderStateService.
     * @returns {Promise<object>} The context object for the Effects.html template.
     */
    async buildEffectsContext(builderState) {
        if (!builderState?.baseItem) {
            return { effectGroups: [] }; // Return empty if there's no base item
        }

        const effectGroups = [];

        // 1. Process the Base Item's effects
        const baseItem = builderState.baseItem;
        effectGroups.push({
            groupName: `Base Item: ${baseItem.name}`,
            sourceUuid: baseItem.uuid,
            effects: baseItem.effects || [],
            hasEffects: (baseItem.effects?.length > 0)
        });

        // 2. Process effects from items in the slots ('changes' object)
        for (const slotId in builderState.changes) {
            const slottedItem = builderState.changes[slotId];
            if (slottedItem && slottedItem.uuid) { // Check if it's a valid item
                effectGroups.push({
                    groupName: `Slot (${slotId}): ${slottedItem.name}`,
                    sourceUuid: slottedItem.uuid,
                    effects: slottedItem.effects || [],
                    hasEffects: (slottedItem.effects?.length > 0)
                });
            }
        }

        return { effectGroups };
    }
}