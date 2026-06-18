import { DialogTestModifierService } from './DialogModifierService.mjs';
import { DiceHelperService } from '../../../services/DiceHelperService.mjs';
import { DeliveryTimeService } from '../../../services/DeliveryTimeService.mjs';
import { AppTestFlagService } from '../../../services/AppTestFlagService.mjs';
import {parseAvailability} from '../../../lib/_module.mjs';

/**
* @param {object|null} activeTestState - The active test state from the flag.
 */
export class AppDialogBuilder {
    constructor() {
        this.testState = null;
    }

    static async getActor(uuid) {
        if (!uuid) return null;
        const doc = await fromUuid(uuid);
        return doc instanceof Actor ? doc : doc?.actor || null;
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

        const isBuildTest = this.testState.testType === "BuildTest";

        let context = null;
        switch (this.testState.status) {
            case 'initial':
                context = isBuildTest ? await this.#buildBuildTestInitialContext() : await this.#buildInitialContext();
                if (context) {
                    context.showConfig = true;
                    context.isInitial = true;
                }
                break;
            case 'result':
                context = await this.#buildResultContext();
                break;
            case 'extended-inprogress':
                context = isBuildTest ? await this.#buildBuildTestInProgressContext() : await this.#buildExtendedInProgressContext();
                if (context && isBuildTest) {
                    context.showConfig = true;
                    context.isInProgress = true;
                }
                break;
            case 'resolved':
                context = isBuildTest ? await this.#buildBuildTestResolvedContext() : await this.#buildResolvedContext(basket);
                break;
            default:
                console.error(`Unknown test status: "${this.testState.status}"`);
                return null;
        }
        return context;
    }

    /** @private Builds context for the 'initial' state. */
    async #buildInitialContext() {
        const { actorUuid, skill, attribute, connectionUuid, availabilityStr, appliedModifiers } = this.testState;
        
        const actor = await this.constructor.getActor(actorUuid);
        if (!actor) return null;

        const dicePoolBreakdown = [];
        let totalDicePool = 0;
        let connectionUsed = 0;
        
        const SKILL_NAME_MAPPINGS = {
            armorer: ["armorer", "armourer", "waffenbau"],
            automotivemechanic: ["automotivemechanic", "fahrzeugmechanik"],
            aeronauticsmechanic: ["aeronauticsmechanic", "luftfahrtmechanik"],
            nauticalmechanic: ["nauticalmechanic", "seefahrtmechanik", "schiffsmechanik"],
            industrialmechanic: ["industrialmechanic", "industriemechanik"],
            hardware: ["hardware", "hardware"],
            negotiation: ["negotiation", "verhandeln"]
        };

        const normK = skill.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchNames = SKILL_NAME_MAPPINGS[normK] || [normK];

        let skillItem = actor.items.find(i => {
            if (i.type !== "skill") return false;

            const normKey = i.system.key?.toLowerCase()?.replace(/[^a-z0-9]/g, '');
            if (normKey && matchNames.includes(normKey)) return true;

            const normName = i.name?.toLowerCase()?.replace(/[^a-z0-9]/g, '');
            if (normName && matchNames.includes(normName)) return true;

            return false;
        });

        // Generate possible cased keys for legacy active skills fallback
        const possibleKeys = [
            skill,
            skill.toLowerCase(),
            skill.charAt(0).toLowerCase() + skill.slice(1)
        ];

        let ref;
        for (const k of possibleKeys) {
            if (actor.system.skills?.active?.[k] !== undefined) {
                ref = actor.system.skills.active[k];
                break;
            }
        }

        // If not found by direct key, try normalized snake_case key matching in active skills
        if (!ref && actor.system.skills?.active) {
            for (const [key, value] of Object.entries(actor.system.skills.active)) {
                const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (matchNames.includes(normKey)) {
                    ref = value;
                    break;
                }
            }
        }

        if (ref && !skillItem) {
            let refId = typeof ref === "string" ? ref : (ref.uuid || ref.value || ref.base);
            if (typeof refId === "string") {
                if (refId.startsWith("Item.")) {
                    refId = refId.substring(5);
                }
                skillItem = actor.items.get(refId) || actor.items.find(i => i.id === refId || i.uuid === refId);
            }
        }

        let skillValue = 0;
        if (ref !== undefined && ref !== null) {
            if (typeof ref === "number") {
                skillValue = ref;
            } else if (typeof ref === "object") {
                skillValue = ref.value ?? ref.base ?? ref.rating ?? 0;
            }
        } else if (skillItem) {
            skillValue = skillItem.system.skill?.rating ?? 
                         skillItem.system.skill?.value ?? 
                         skillItem.system.rating?.value ?? 
                         skillItem.system.value ?? 
                         skillItem.system.rating ?? 
                         0;
        }

        console.log(`[AppDialogBuilder buildInitialContext] skill="${skill}", normK="${normK}", matchNames=`, matchNames, `ref=`, ref, `skillItem=`, skillItem, `resolvedValue=${skillValue}`);

        if (skillValue > 0 || skillItem || ref) {
            const skillLabel = game.i18n.localize(CONFIG.SR5.activeSkills[skill]) || skill;
            dicePoolBreakdown.push({ label: skillLabel, value: skillValue });
            totalDicePool += skillValue;
        }

        const attributeData = actor.system.attributes[attribute];
        if (attributeData) {
            const attributeLabel = game.i18n.localize(`FIELDS.attributes.${attribute}.label`);
            dicePoolBreakdown.push({ label: attributeLabel, value: attributeData.value });
            totalDicePool += attributeData.value;
        }

        if (Array.isArray(appliedModifiers)) {
            appliedModifiers.forEach(mod => {
                const labelLocKey = `SR5Marketplace.Marketplace.Modifiers.Labels.${mod.label}`;
                const displayLabel = game.i18n.has(labelLocKey) ? game.i18n.localize(labelLocKey) : mod.label;
                dicePoolBreakdown.push({ label: displayLabel, value: mod.value });
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

        const formulaParts = dicePoolBreakdown.map(part => `${part.label} (${part.value >= 0 ? '+' : ''}${part.value})`);
        const poolFormula = `${formulaParts.join(" + ")} = ${totalDicePool}`;

        const standardLabels = new Set([
            "Friendly", "Neutral", "Mistrustful", "Biased", "Averse", "Hostile",
            "Advantageous", "Insignificant", "Annoying", "Dangerous", "Catastrophic",
            "Insufficient Info", "Leverage",
            "Improperly Dressed", "Nervous",
            "Physically Imposing", "Outnumbered", "Has Weapon/Magic",
            "Plausible Evidence", "Target Distracted"
        ]);
        const customAppliedModifiers = (appliedModifiers ?? []).filter(mod => !standardLabels.has(mod.label));

        return {
            actor,
            availabilityStr,
            modifierGroups, // The modifier groups are now guaranteed to be included
            dicePoolBreakdown,
            totalDicePool,
            connectionUsed: connectionUsed,
            poolFormula,
            customAppliedModifiers
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
            case "raw":
                return await this.#_buildRawResolvedContext(basket);
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
        const initialResult = this.testState.result || {};
        const resistResult = this.testState.resistResult || {};

        const rollsData = this.testState.rolls;
        const initialDiceResults = rollsData?.[0]?.terms[0]?.results || initialResult?.diceResults || [];
        const initialGlitches = initialResult.values?.glitches?.value || 0;
        const initialResultForHelper = {
            diceResults: initialDiceResults,
            values: { glitches: { value: initialGlitches } }
        };
        const initialRenderedDice = DiceHelperService.processDice(initialResultForHelper);
        const resistRenderedDice = DiceHelperService.processDice(resistResult);

        return {
            isAvailable: !resistResult.success,
            initialRoll: {
                netHits: initialResult.values?.netHits?.value ?? 0,
                renderedDice: initialRenderedDice
            },
            resistRoll: {
                hits: resistResult.values?.hits?.value ?? 0,
                renderedDice: resistRenderedDice
            }
        };
    }

    #_buildSimpleResolvedContext() {
        const initialResult = this.testState.result || {};
        const threshold = parseAvailability(this.testState.availabilityStr).rating;

        const rollsData = this.testState.rolls;
        const initialDiceResults = rollsData?.[0]?.terms[0]?.results || initialResult?.diceResults || [];
        const initialGlitches = initialResult.values?.glitches?.value || 0;
        const initialResultForHelper = {
            diceResults: initialDiceResults,
            values: { glitches: { value: initialGlitches } }
        };
        const initialRenderedDice = DiceHelperService.processDice(initialResultForHelper);
        const netHits = initialResult.values?.netHits?.value ?? 0;

        return {
            isAvailable: initialResult.success ?? false,
            initialRoll: {
                netHits: netHits,
                renderedDice: initialRenderedDice,
                threshold: threshold
            },
            netHits: netHits,
            renderedDice: initialRenderedDice,
            cumulativeHits: initialResult.values?.hits?.value ?? netHits,
            threshold: threshold
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
        const renderedDice = DiceHelperService.processDice(resultForHelper);

        // 3. Return the complete context for the final "resolved" template.
        return {
            isAvailable: isAvailable,
            initialRoll: {
                netHits: finalNetHits,
                renderedDice: renderedDice,
                threshold: resultData.threshold.value,
                cumulativeHits: resultData.values.extendedHits.value
            },
            netHits: finalNetHits,
            renderedDice: renderedDice,
            threshold: resultData.threshold.value,
            cumulativeHits: resultData.values.extendedHits.value,
            totalRolls: this.testState.rollCount,
            deliveryTime: finalDeliveryTime,
            connectionUsed: this.testState.connectionUsed,
            localizedTimeUnit: localizedTimeUnit
        };
    }

    /**
     * @private Builds context for a resolved RAW test.
     */
    async #_buildRawResolvedContext(basket) {
        const initialResult = this.testState.result || {};
        const resistResult = this.testState.resistResult || {};

        const playerHits = initialResult.values?.hits?.value ?? 0;
        const resistHits = resistResult.values?.hits?.value ?? 0;
        const netHits = playerHits - resistHits;

        const isAvailable = playerHits >= resistHits;

        let finalBasket = basket;
        if (!finalBasket || Object.keys(finalBasket).length === 0) {
            console.log("AppDialogBuilder | Basket not provided or empty, fetching from flag as a fallback.");
            finalBasket = await AppTestFlagService.readBasket();
        }
        const totalCost = finalBasket?.totalCost || 0;
        const baseDeliveryTime = DeliveryTimeService.getBaseDeliveryTime(totalCost);

        let finalDeliveryTimeValue = baseDeliveryTime.value;
        if (isAvailable) {
            if (netHits > 0) {
                finalDeliveryTimeValue = Math.ceil(baseDeliveryTime.value / netHits);
            } else if (netHits === 0) {
                finalDeliveryTimeValue = baseDeliveryTime.value * 2;
            }
        }

        const finalDeliveryTime = {
            value: finalDeliveryTimeValue,
            unit: baseDeliveryTime.unit
        };
        const localizedTimeUnit = game.i18n.localize(baseDeliveryTime.unit);

        const rollsData = this.testState.rolls;
        const initialDiceResults = rollsData?.[0]?.terms[0]?.results || initialResult?.diceResults || [];
        const initialGlitches = initialResult.values?.glitches?.value || 0;
        const initialResultForHelper = {
            diceResults: initialDiceResults,
            values: { glitches: { value: initialGlitches } }
        };
        const initialRenderedDice = DiceHelperService.processDice(initialResultForHelper);
        const resistRenderedDice = DiceHelperService.processDice(resistResult);

        return {
            isAvailable: isAvailable,
            initialRoll: {
                netHits: playerHits,
                renderedDice: initialRenderedDice
            },
            resistRoll: {
                hits: resistHits,
                renderedDice: resistRenderedDice
            },
            deliveryTime: finalDeliveryTime,
            localizedTimeUnit: localizedTimeUnit,
            netHits: netHits
        };
    }

    /** @private Builds context for BuildTest initial state. */
    async #buildBuildTestInitialContext() {
        const { actorUuid, skill, attribute, threshold, appliedModifiers } = this.testState;

        const actor = await this.constructor.getActor(actorUuid);
        if (!actor) return null;

        const dicePoolBreakdown = [];
        let totalDicePool = 0;

        // 1. Robust skill lookup matching master branch AvailabilityTest logic
        const SKILL_NAME_MAPPINGS = {
            armorer: ["armorer", "armourer", "waffenbau"],
            automotivemechanic: ["automotivemechanic", "fahrzeugmechanik"],
            aeronauticsmechanic: ["aeronauticsmechanic", "luftfahrtmechanik"],
            nauticalmechanic: ["nauticalmechanic", "seefahrtmechanik", "schiffsmechanik"],
            industrialmechanic: ["industrialmechanic", "industriemechanik"],
            hardware: ["hardware", "hardware"],
            negotiation: ["negotiation", "verhandeln"]
        };

        const normK = skill.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchNames = SKILL_NAME_MAPPINGS[normK] || [normK];

        const skillItem = actor.items.find(i => {
            if (i.type !== "skill") return false;

            const normKey = i.system.key?.toLowerCase()?.replace(/[^a-z0-9]/g, '');
            if (normKey && matchNames.includes(normKey)) return true;

            const normName = i.name?.toLowerCase()?.replace(/[^a-z0-9]/g, '');
            if (normName && matchNames.includes(normName)) return true;

            return false;
        });

        // Generate possible cased keys for legacy active skills fallback
        const possibleKeys = [
            skill,
            skill.toLowerCase(),
            skill.charAt(0).toLowerCase() + skill.slice(1)
        ];

        let activeSkill;
        for (const k of possibleKeys) {
            if (actor.system.skills?.active?.[k] !== undefined) {
                activeSkill = actor.system.skills.active[k];
                break;
            }
        }

        // If not found by direct key, try normalized snake_case key matching in active skills
        if (!activeSkill && actor.system.skills?.active) {
            for (const [key, value] of Object.entries(actor.system.skills.active)) {
                const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (matchNames.includes(normKey)) {
                    activeSkill = value;
                    break;
                }
            }
        }
        let skillValue = 0;
        if (skillItem) {
            skillValue = skillItem.system.skill?.rating ?? 
                         skillItem.system.skill?.value ?? 
                         skillItem.system.rating?.value ?? 
                         skillItem.system.value ?? 
                         skillItem.system.rating ?? 
                         0;
        } else if (activeSkill !== undefined && activeSkill !== null) {
            if (typeof activeSkill === "number") {
                skillValue = activeSkill;
            } else if (typeof activeSkill === "object") {
                skillValue = activeSkill.value ?? activeSkill.base ?? activeSkill.rating ?? 0;
            }
        }

        console.log(`[AppDialogBuilder buildBuildTestInitialContext] skill="${skill}", normK="${normK}", matchNames=`, matchNames, `activeSkill=`, activeSkill, `skillItem=`, skillItem, `resolvedValue=${skillValue}`);

        if (skillValue > 0 || skillItem || activeSkill) {
            const skillKeyForConfig = skill.charAt(0).toLowerCase() + skill.slice(1);
            const skillLabel = game.i18n.localize(CONFIG.SR5.activeSkills[skillKeyForConfig]) ||
                               game.i18n.localize(CONFIG.SR5.activeSkills[skill]) ||
                               skill;
            dicePoolBreakdown.push({ label: skillLabel, value: skillValue });
            totalDicePool += skillValue;
        }

        const attributeData = actor.system.attributes[attribute];
        if (attributeData) {
            const attributeLabel = game.i18n.localize(`FIELDS.attributes.${attribute}.label`) || "Logic";
            dicePoolBreakdown.push({ label: attributeLabel, value: attributeData.value });
            totalDicePool += attributeData.value;
        }

        // Check and update logic memory penalty value if checked
        let workingModifiers = appliedModifiers ? JSON.parse(JSON.stringify(appliedModifiers)) : [];
        workingModifiers = workingModifiers.filter(mod => !mod.isStepPenalty);
        let hasModified = false;
        if (attributeData) {
            const logicPenaltyIndex = workingModifiers.findIndex(mod => mod.label === "SR5Marketplace.ItemBuilder.LogicMemoryPenalty");
            if (logicPenaltyIndex !== -1) {
                const newVal = attributeData.value < 5 ? -(5 - attributeData.value) : 0;
                if (newVal !== workingModifiers[logicPenaltyIndex].value) {
                    if (newVal === 0) {
                        workingModifiers.splice(logicPenaltyIndex, 1);
                    } else {
                        workingModifiers[logicPenaltyIndex].value = newVal;
                    }
                    hasModified = true;
                }
            }
        }
        if (hasModified) {
            this.testState.appliedModifiers = workingModifiers;
            await AppTestFlagService.updateTest(this.testState.id, { appliedModifiers: workingModifiers });
        }

        let workingConditions = 0;
        let toolsParts = 0;
        let plansInstructions = 0;
        let logicMemoryPenaltyChecked = false;

        if (Array.isArray(workingModifiers)) {
            workingModifiers.forEach(mod => {
                if (mod.label === "SR5Marketplace.ItemBuilder.WorkingConditions") {
                    workingConditions = mod.value;
                } else if (mod.label === "SR5Marketplace.ItemBuilder.ToolsParts") {
                    toolsParts = mod.value;
                } else if (mod.label === "SR5Marketplace.ItemBuilder.PlansInstructions") {
                    plansInstructions = mod.value;
                } else if (mod.label === "SR5Marketplace.ItemBuilder.LogicMemoryPenalty") {
                    logicMemoryPenaltyChecked = true;
                }

                const labelLocKey = `SR5Marketplace.Marketplace.Modifiers.Labels.${mod.label}`;
                const displayLabel = game.i18n.has(labelLocKey) ? game.i18n.localize(labelLocKey) : (game.i18n.has(mod.label) ? game.i18n.localize(mod.label) : mod.label);
                dicePoolBreakdown.push({ label: displayLabel, value: mod.value });
                totalDicePool += mod.value;
            });
        }

        const formulaParts = dicePoolBreakdown.map(part => `${part.label} (${part.value >= 0 ? '+' : ''}${part.value})`);
        const poolFormula = `${formulaParts.join(" + ")} = ${totalDicePool}`;

        const buildTestStandardLabels = new Set([
            "SR5Marketplace.ItemBuilder.WorkingConditions",
            "SR5Marketplace.ItemBuilder.ToolsParts",
            "SR5Marketplace.ItemBuilder.PlansInstructions",
            "SR5Marketplace.ItemBuilder.LogicMemoryPenalty"
        ]);
        const customAppliedModifiers = workingModifiers.filter(mod => !buildTestStandardLabels.has(mod.label));

        return {
            actor,
            threshold,
            skill,
            attribute,
            workingConditions,
            toolsParts,
            plansInstructions,
            logicMemoryPenaltyChecked,
            showLogicMemoryPenalty: attributeData && attributeData.value < 5 && plansInstructions === 0,
            dicePoolBreakdown,
            totalDicePool,
            poolFormula,
            customAppliedModifiers,
            appliedModifiers: workingModifiers
        };
    }

    /** @private Builds context for BuildTest extended-inprogress state. */
    async #buildBuildTestInProgressContext() {
        const initialCtx = await this.#buildBuildTestInitialContext();
        if (!initialCtx) return null;

        const resultData = this.testState.result;
        const rollsData = this.testState.rolls;

        const lastRoll = rollsData?.[rollsData.length - 1];
        const diceResults = lastRoll?.terms?.[0]?.results || lastRoll?.dice?.[0]?.results || [];
        const glitches = resultData.values?.glitches?.value || 0;

        const resultForHelper = {
            diceResults: diceResults,
            values: { glitches: { value: glitches } }
        };
        const renderedDice = DiceHelperService.processDice(resultForHelper);

        const nextRollNumber = (this.testState.rollCount || rollsData?.length || 1) + 1;
        const penaltyVal = -(nextRollNumber - 1);

        const penaltyLabel = game.i18n.localize("SR5.ExtendedTestStep") || "Subsequent Roll Penalty";
        initialCtx.dicePoolBreakdown.push({ label: penaltyLabel, value: penaltyVal });
        initialCtx.totalDicePool = Math.max(0, initialCtx.totalDicePool + penaltyVal);

        const formulaParts = initialCtx.dicePoolBreakdown.map(part => `${part.label} (${part.value >= 0 ? '+' : ''}${part.value})`);
        initialCtx.poolFormula = `${formulaParts.join(" + ")} = ${initialCtx.totalDicePool}`;

        return {
            ...initialCtx,
            cumulativeHits: resultData.values?.extendedHits?.value ?? 0,
            currentPool: initialCtx.totalDicePool,
            renderedDice: renderedDice,
            nextRollNumber: nextRollNumber
        };
    }

    /** @private Builds context for BuildTest resolved state. */
    async #buildBuildTestResolvedContext() {
        const resultData = this.testState.result;
        const rollsData = this.testState.rolls;

        const lastRoll = rollsData?.[rollsData.length - 1];
        const diceResults = lastRoll?.terms?.[0]?.results || lastRoll?.dice?.[0]?.results || [];
        const lastGlitches = resultData.values?.glitches?.value || 0;

        // Detect critical glitch
        const hits = diceResults.filter(d => (d?.result ?? 0) >= 5).length;
        const ones = diceResults.filter(d => (d?.result ?? 0) === 1).length;
        const pool = diceResults.length;
        const isGlitch = ones > pool / 2;
        const isCritGlitch = isGlitch && hits === 0;

        const resultForHelper = {
            diceResults: diceResults,
            values: { glitches: { value: lastGlitches } }
        };
        const renderedDice = DiceHelperService.processDice(resultForHelper);

        const cumulativeHits = resultData.values?.extendedHits?.value ?? 0;
        const threshold = resultData.threshold?.value ?? 12;
        const isSuccess = cumulativeHits >= threshold;

        return {
            isSuccess,
            isCritGlitch,
            renderedDice,
            threshold,
            cumulativeHits,
            totalRolls: this.testState.rollCount || rollsData?.length || 1,
            isWorkshopMod: this.testState.isWorkshopMod ?? false,
            isRepair: this.testState.isRepair ?? false
        };
    }
}