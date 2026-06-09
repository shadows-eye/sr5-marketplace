import { DialogList } from '../scripts/services/dialogList.mjs';
import { BuilderStateService } from '../scripts/services/builderStateService.mjs';

/**
 * @summary A specialized extended success test for building items/vehicles and installing modifications.
 * @extends {game.shadowrun5e.tests.SuccessTest}
 */
export class BuildTest extends game.shadowrun5e.tests.SuccessTest {

    static get name() {
        return "BuildTest";
    }

    /** @override */
    get type() {
        return "BuildTest";
    }

    /** @override */
    get code() {
        if (!this.data?.pool || !Array.isArray(this.data.pool.mod) || this.data.pool.mod.length === 0) {
            return "";
        }
        const parts = this.data.pool.mod.map(m => `${m.name} ${m.value}`);
        return `(${parts.join(" + ")} = ${this.pool.value})`;
    }

    constructor(data, documents, options) {
        super(data, documents, options);
    }

    /** @override */
    _prepareData(data, options) {
        data = super._prepareData(data, options);
        
        // Merge with default action_roll data
        const defaultAction = game.shadowrun5e.data.createData('action_roll');
        data.action = foundry.utils.mergeObject(defaultAction, data.action || {}, { inplace: false });
        
        data.action.categories = ["active"];
        data.action.modifiers = data.action.modifiers || [];
        
        data.selectedSkill = data.selectedSkill || data.action.skill || 'AutomotiveMechanic';
        data.selectedAttribute = 'logic';
        data.workingConditions = data.workingConditions || 0;
        data.toolsParts = data.toolsParts || 0;
        data.plansInstructions = data.plansInstructions || 0;
        data.logicMemoryPenaltyChecked = data.logicMemoryPenaltyChecked || false;
        
        // Default threshold is 12 (RAW average threshold) if not specified
        if (data.threshold?.base === undefined || data.threshold?.base === null) {
            data.threshold = data.threshold || {};
            data.threshold.base = options?.threshold || data.thresholdBase || 12;
        }
        data.thresholdBase = data.threshold.base;

        data.buildData = data.buildData || options?.buildData || null;
        
        return data;
    }

    /** @override */
    prepareBaseValues() {
        super.prepareBaseValues();
        if (!this.actor) return;

        const skillId = this.data.selectedSkill;
        const attributeId = this.data.selectedAttribute;

        // 1. Dynamic skill lookup: item or legacy active skills
        const skillItem = this.actor.items.find(i => 
            i.type === "skill" && 
            (i.system.key?.toLowerCase() === skillId.toLowerCase() || 
             i.name.toLowerCase() === skillId.toLowerCase())
        );
        const skillValue = skillItem 
            ? (skillItem.system.rating?.value ?? skillItem.system.value ?? 0) 
            : (this.actor.system.skills?.active?.[skillId]?.value ?? 0);

        const attribute = this.actor.system.attributes[attributeId];
        const attributeValue = attribute?.value ?? 0;

        // 2. Prepare dice pool helper
        this.data.pool = this.data.pool || {};
        this.data.pool.mod = Array.isArray(this.data.pool.mod) ? this.data.pool.mod : [];
        const pool = new DialogList(this.data.pool.mod);
        pool.clear();

        // Standard Skill + Attribute parts
        let skillLabel = skillId;
        const skillKeyForConfig = skillId.charAt(0).toLowerCase() + skillId.slice(1);
        if (CONFIG.SR5.activeSkills[skillKeyForConfig]) {
            skillLabel = game.i18n.localize(CONFIG.SR5.activeSkills[skillKeyForConfig]);
        } else if (CONFIG.SR5.activeSkills[skillId]) {
            skillLabel = game.i18n.localize(CONFIG.SR5.activeSkills[skillId]);
        } else {
            const locKey = `FIELDS.Skill.${skillId}`;
            skillLabel = game.i18n.has(locKey) ? game.i18n.localize(locKey) : skillId;
        }

        const attributeLabel = game.i18n.localize(`FIELDS.attributes.${attributeId}.label`) || "Logic";
        pool.addPart(skillLabel, skillValue);
        pool.addPart(attributeLabel, attributeValue);

        // 3. Add RAW Table Modifiers
        const condVal = Number(this.data.workingConditions || 0);
        if (condVal !== 0) {
            const label = game.i18n.localize("SR5Marketplace.ItemBuilder.WorkingConditions");
            pool.addPart(label, condVal);
        }

        const toolsVal = Number(this.data.toolsParts || 0);
        if (toolsVal !== 0) {
            const label = game.i18n.localize("SR5Marketplace.ItemBuilder.ToolsParts");
            pool.addPart(label, toolsVal);
        }

        const plansVal = Number(this.data.plansInstructions || 0);
        if (plansVal !== 0) {
            const label = game.i18n.localize("SR5Marketplace.ItemBuilder.PlansInstructions");
            pool.addPart(label, plansVal);
        }

        // Logic memory check: if checked and Logic < 5, penalty is -(5 - Logic)
        if (this.data.logicMemoryPenaltyChecked && attributeValue < 5) {
            const penaltyVal = -(5 - attributeValue);
            const label = game.i18n.localize("SR5Marketplace.ItemBuilder.LogicMemoryPenalty");
            pool.addPart(label, penaltyVal);
        }

        // Custom modifier row list
        const modifiers = this.data.action.modifiers || [];
        const parseModifierValue = (val) => {
            if (typeof val === "number") return val;
            if (typeof val === "string") {
                const clean = val.replace(/[()]/g, "").trim();
                const match = clean.match(/^([+-]?\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            }
            return 0;
        };
        modifiers.forEach(mod => {
            pool.addPart(mod.label || "Custom", parseModifierValue(mod.value));
        });

        // 4. Limit: Mental Limit is applied to build test
        this.data.limit.base = this.actor.system.limits.mental?.value ?? 0;

        // 5. Extended test setup
        this.data.extended = true;

        // 6. Finalize dice pool
        this.data.pool.base = 0;
        this.data.pool.changes = this.data.pool.mod.map(m => ({
            name: m.name,
            value: m.value,
            enabled: true,
            mode: typeof CONST !== 'undefined' ? (CONST.ACTIVE_EFFECT_MODES?.ADD ?? 2) : 2,
            priority: 0
        }));
        this.data.pool.value = this.constructor.calcTotal(this.data.pool);
    }

    /** @override */
    calculateBaseValues() {
        super.calculateBaseValues();
        if (this.data?.pool) {
            this.data.pool.value = this.constructor.calcTotal(this.data.pool);
        }
    }

    /** @override */
    get success() {
        return this.extendedHits().value >= this.threshold.value;
    }

    /** @override */
    get failure() {
        return this.pool.value <= 0 && !this.success;
    }

    /** @override */
    calculateNetHits() {
        const hitsToUse = this.extendedHits();
        const base = this.hasThreshold ? Math.max(hitsToUse.value - this.threshold.value, 0) : hitsToUse.value;
        const netHits = game.shadowrun5e.data.createData('value_field', {
            label: "SR5.NetHits",
            base
        });
        netHits.value = BuildTest.calcTotal(netHits, { min: 0 });
        return netHits;
    }

    static calcTotal(value, options = {}) {
        if (value.override) {
            let total = value.override.value;
            if (options.min !== undefined) total = Math.max(total, options.min);
            if (options.max !== undefined) total = Math.min(total, options.max);
            return total;
        }
        let total = value.base || 0;
        if (Array.isArray(value.mod)) {
            total += value.mod.reduce((acc, current) => acc + (current.value || 0), 0);
        }
        total += value.temp || 0;
        if (options.min !== undefined) total = Math.max(total, options.min);
        if (options.max !== undefined) total = Math.min(total, options.max);
        return Math.ceil(total);
    }

    /** @override */
    async afterTestComplete() {
        console.debug(`SR5 Marketplace | Test ${this.constructor.name} completed.`);

        if (this.success) {
            await this.processSuccess();
        } else {
            await this.processFailure();
        }

        if (this.autoExecuteFollowupTest) {
            await this.executeFollowUpTest();
        }

        // Check for critical glitch on the last roll
        const roll = this.rolls[this.rolls.length - 1];
        const dice = roll?.dice?.[0]?.results ?? [];
        const hits = dice.filter(d => (d?.result ?? 0) >= 5).length;
        const ones = dice.filter(d => (d?.result ?? 0) === 1).length;
        const pool = roll?.dice?.[0]?.number ?? 0;
        const isGlitch = ones > pool / 2;
        const isCritGlitch = isGlitch && hits === 0;

        if (isCritGlitch) {
            ui.notifications.error(game.i18n.localize("SR5Marketplace.ItemBuilder.CriticalGlitchPartsDestroyed"));
            
            // Clear builder state
            await BuilderStateService.clearState();
            
            // Force re-render of the builder app if open
            const builderApp = Object.values(ui.windows).find(w => w.constructor.name === "ItemBuilderApp");
            if (builderApp) {
                builderApp.tabGroups.main = "builder";
                builderApp.render();
            }
            return;
        }

        if (this.success) {
            const buildData = this.data.buildData;
            if (buildData) {
                if (buildData.type === "vehicle") {
                    // Send socket request to GM client to create actor and grant ownership
                    game.socket.emit(`module.sr5-marketplace`, {
                        action: "create_actor",
                        actorData: buildData,
                        userId: game.user.id
                    });
                    ui.notifications.info(game.i18n.format("SR5Marketplace.ItemBuilder.SuccessBuildCreated", { name: buildData.name }));
                } else {
                    // Item document can be created directly by player
                    await this.actor.createEmbeddedDocuments("Item", [buildData]);
                    ui.notifications.info(game.i18n.format("SR5Marketplace.ItemBuilder.SuccessBuildCreated", { name: buildData.name }));
                }
            }

            // Clear builder state
            await BuilderStateService.clearState();
            
            // Force re-render of the builder app if open
            const builderApp = Object.values(ui.windows).find(w => w.constructor.name === "ItemBuilderApp");
            if (builderApp) {
                builderApp.tabGroups.main = "builder";
                builderApp.render();
            }
        }
    }

    /** @override */
    get _dialogTemplate() {
        return "modules/sr5-marketplace/templates/documents/tests/build-test-dialog.html";
    }

    /** @override */
    _testDialogListeners() {
        return [
            {
                query: '.add-modifier-row-btn',
                on: 'click',
                callback: function(event, dialog) {
                    event.preventDefault();
                    dialog.applyFormData();
                    const mods = this.data.action.modifiers || [];
                    mods.push({ label: "", value: "" });
                    this.data.action.modifiers = mods;
                    this.prepareBaseValues();
                    this.calculateBaseValues();
                    dialog.render();
                }
            },
            {
                query: '.remove-modifier-row-btn',
                on: 'click',
                callback: function(event, dialog) {
                    event.preventDefault();
                    dialog.applyFormData();
                    const index = parseInt(event.currentTarget.dataset.index, 10);
                    const mods = this.data.action.modifiers || [];
                    if (!isNaN(index) && index >= 0 && index < mods.length) {
                        mods.splice(index, 1);
                    }
                    this.data.action.modifiers = mods;
                    this.prepareBaseValues();
                    this.calculateBaseValues();
                    dialog.render();
                }
            }
        ];
    }

    static get label() {
        return "SR5Marketplace.ItemBuilder.BuildTestTitle";
    }

    /**
     * Entry point to launch the Build Test.
     */
    static async run(actorRef, testParams = {}, options = {}) {
        const actor = typeof actorRef === "string" ? await fromUuid(actorRef) : actorRef;
        if (!actor) throw new Error("BuildTest: actor not found");

        const data = {};
        const finalOptions = { 
            ...options, 
            buildData: testParams.buildData,
            threshold: testParams.threshold
        };

        finalOptions.showDialog = true;
        finalOptions.showMessage = true;

        const test = new this(data, { actor }, finalOptions);
        await test.execute();
        return test;
    }
}
