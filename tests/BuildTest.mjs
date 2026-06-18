import { DialogList } from '../scripts/services/dialogList.mjs';
import { BuilderStateService } from '../scripts/services/builderStateService.mjs';
import { BuildTestApp } from '../scripts/apps/documents/dialog/BuildTestApp.mjs';
import { AppTestFlagService } from '../scripts/services/AppTestFlagService.mjs';


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
    get pool() {
        return this.data.pool;
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
        this.options = options || {};
    }

    /** @override */
    _prepareData(data, options) {
        const originalModifiers = data?.action?.modifiers;
        data = super._prepareData(data, options);
        
        // Merge with default action_roll data
        const defaultAction = game.shadowrun5e.data.createData('action_roll');
        data.action = foundry.utils.mergeObject(defaultAction, data.action || {}, { inplace: false });
        
        data.action.categories = ["active"];
        if (originalModifiers !== undefined) {
            data.action.modifiers = originalModifiers;
        } else {
            data.action.modifiers = data.action.modifiers || [];
        }
        
        data.selectedSkill = data.selectedSkill || data.action.skill || 'AutomotiveMechanic';
        data.selectedAttribute = 'logic';

        
        // Default threshold is 12 (RAW average threshold) if not specified
        if (options?.threshold !== undefined && options?.threshold !== null) {
            data.threshold = data.threshold || {};
            data.threshold.base = options.threshold;
        } else if (data.threshold?.base === undefined || data.threshold?.base === null || data.threshold?.base === 0) {
            data.threshold = data.threshold || {};
            data.threshold.base = data.thresholdBase || 12;
        }
        data.thresholdBase = data.threshold.base;

        data.buildData = data.buildData || options?.buildData || null;

        // Persist key metadata directly on the data object to ensure database synchronization
        data.isWorkshopMod = data.isWorkshopMod || options?.isWorkshopMod || false;
        data.isRepair = data.isRepair || options?.isRepair || false;
        data.vehicleUuid = data.vehicleUuid || options?.vehicle?.uuid || options?.vehicleUuid || null;
        data.workshopUuid = data.workshopUuid || options?.workshop?.uuid || options?.workshopUuid || null;
        data.userId = data.userId || options?.userId || game.user?.id || null;
        data.virtualModId = data.virtualModId || options?.virtualModId || null;

        if (options?.workshop) {
            const rating = options.workshop.system.shop?.factoryRating ?? 5;
            const cond = rating - 5;
            let tools = 0;
            if (rating === 6) tools = 1;
            else if (rating === 5) tools = 0;
            else if (rating === 3 || rating === 4) tools = -2;
            else if (rating === 1 || rating === 2) tools = -4;

            if (data.workingConditions === undefined) {
                data.workingConditions = String(cond);
            }
            if (data.toolsParts === undefined) {
                data.toolsParts = String(tools);
            }
        }

        if (!data.manualHits || typeof data.manualHits.value === 'undefined') {
            data.manualHits = game.shadowrun5e.data.createData('value_field', { base: 0, override: { value: null, label: "SR5.ManualOverride" } });
        }
        if (!data.manualGlitches || typeof data.manualGlitches.value === 'undefined') {
            data.manualGlitches = game.shadowrun5e.data.createData('value_field', { base: 0, override: { value: null, label: "SR5.ManualOverride" } });
        }
        
        return data;
    }

    /** @override */
    async showDialog() {
        if (!this.data.options?.showDialog) return true;

        const initialModifiers = [...(this.data.action?.modifiers || [])];
        if (this.options?.workshop) {
            const workshop = this.options.workshop;
            const rating = workshop.system.shop?.factoryRating ?? 5;
            const cond = rating - 5;
            let tools = 0;
            if (rating === 6) tools = 1;
            else if (rating === 5) tools = 0;
            else if (rating === 3 || rating === 4) tools = -2;
            else if (rating === 1 || rating === 2) tools = -4;

            if (cond !== 0 && !initialModifiers.some(m => m.label === "SR5Marketplace.ItemBuilder.WorkingConditions")) {
                initialModifiers.push({ label: "SR5Marketplace.ItemBuilder.WorkingConditions", value: cond });
            }
            if (tools !== 0 && !initialModifiers.some(m => m.label === "SR5Marketplace.ItemBuilder.ToolsParts")) {
                initialModifiers.push({ label: "SR5Marketplace.ItemBuilder.ToolsParts", value: tools });
            }
        }

        const initialData = {
            testType: "BuildTest",
            actorUuid: this.actor.uuid,
            vehicleUuid: this.options?.vehicle?.uuid || null,
            workshopUuid: this.options?.workshop?.uuid || null,
            buildData: this.data.buildData || null,
            threshold: this.options?.threshold ?? this.data.threshold?.base ?? this.data.threshold?.value ?? this.data.thresholdBase ?? 12,
            skill: this.data.selectedSkill || 'AutomotiveMechanic',
            attribute: this.data.selectedAttribute || 'logic',
            appliedModifiers: initialModifiers,
            isRepair: this.data.isRepair || false,
            installSource: this.data.installSource || null,
            installSourceId: this.data.installSourceId || null,
            isWorkshopMod: this.options?.isWorkshopMod || false,
            virtualModId: this.data.virtualModId || null,
            itemName: this.data.buildData?.name || null,
            itemUuid: this.data.buildData?.uuid || null
        };

        const buildTestApp = foundry.applications.instances.get("build-test-dialog-app");
        if (buildTestApp) {
            buildTestApp.close();
        }

        await AppTestFlagService.createTest(initialData);
        new BuildTestApp().render(true);

        return false;
    }

    _rebuildPool() {
        if (!this.actor) return;

        const skillId = this.data.selectedSkill;
        const attributeId = this.data.selectedAttribute;

        // 1. Dynamic skill lookup: Embedded Item of type skill (new system format) or legacy active skills fallback
        const SKILL_NAME_MAPPINGS = {
            armorer: ["armorer", "armourer", "waffenbau"],
            automotivemechanic: ["automotivemechanic", "fahrzeugmechanik"],
            aeronauticsmechanic: ["aeronauticsmechanic", "luftfahrtmechanik"],
            nauticalmechanic: ["nauticalmechanic", "seefahrtmechanik", "schiffsmechanik"],
            industrialmechanic: ["industrialmechanic", "industriemechanik"],
            hardware: ["hardware", "hardware"],
            negotiation: ["negotiation", "verhandeln"]
        };

        const normK = skillId.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchNames = SKILL_NAME_MAPPINGS[normK] || [normK];

        let skillItem = this.actor.items.find(i => {
            if (i.type !== "skill") return false;

            const normKey = i.system.key?.toLowerCase()?.replace(/[^a-z0-9]/g, '');
            if (normKey && matchNames.includes(normKey)) return true;

            const normName = i.name?.toLowerCase()?.replace(/[^a-z0-9]/g, '');
            if (normName && matchNames.includes(normName)) return true;

            return false;
        });

        // Generate possible cased keys for legacy active skills fallback
        const possibleKeys = [
            skillId,
            skillId.toLowerCase(),
            skillId.charAt(0).toLowerCase() + skillId.slice(1)
        ];

        let ref;
        for (const k of possibleKeys) {
            if (this.actor.system.skills?.active?.[k] !== undefined) {
                ref = this.actor.system.skills.active[k];
                break;
            }
        }

        // If not found by direct key, try normalized snake_case key matching in active skills
        if (!ref && this.actor.system.skills?.active) {
            for (const [key, value] of Object.entries(this.actor.system.skills.active)) {
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
                skillItem = this.actor.items.get(refId) || this.actor.items.find(i => i.id === refId || i.uuid === refId);
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
        } else if (ref !== undefined && ref !== null) {
            if (typeof ref === "number") {
                skillValue = ref;
            } else if (typeof ref === "object") {
                skillValue = ref.value ?? ref.base ?? ref.rating ?? 0;
            }
        }

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

        // 3. Add Modifiers first
        let modifiers = [];
        if (Array.isArray(this.data.action.modifiers)) {
            modifiers = this.data.action.modifiers;
        } else if (typeof this.data.action.modifiers === "number" && this.data.action.modifiers !== 0) {
            const label = game.i18n.localize("SR5.Labels.Action.Modifiers") || "Modifiers";
            pool.addPart(label, this.data.action.modifiers);
        }
        console.log("BuildTest _rebuildPool | modifiers:", JSON.stringify(modifiers));

        const hasWorkingConditionsMod = modifiers.some(m => m.label === "SR5Marketplace.ItemBuilder.WorkingConditions");
        const hasToolsPartsMod = modifiers.some(m => m.label === "SR5Marketplace.ItemBuilder.ToolsParts");
        const hasPlansInstructionsMod = modifiers.some(m => m.label === "SR5Marketplace.ItemBuilder.PlansInstructions");
        const hasLogicMemoryPenaltyMod = modifiers.some(m => m.label === "SR5Marketplace.ItemBuilder.LogicMemoryPenalty");

        // Add RAW Table Modifiers (from GM dialog if present and NOT already in custom modifiers)
        if (!hasWorkingConditionsMod) {
            const condVal = Number(this.data.workingConditions || 0);
            if (condVal !== 0) {
                const label = game.i18n.localize("SR5Marketplace.ItemBuilder.WorkingConditions");
                pool.addPart(label, condVal);
            }
        }

        if (!hasToolsPartsMod) {
            const toolsVal = Number(this.data.toolsParts || 0);
            if (toolsVal !== 0) {
                const label = game.i18n.localize("SR5Marketplace.ItemBuilder.ToolsParts");
                pool.addPart(label, toolsVal);
            }
        }

        if (!hasPlansInstructionsMod) {
            const plansVal = Number(this.data.plansInstructions || 0);
            if (plansVal !== 0) {
                const label = game.i18n.localize("SR5Marketplace.ItemBuilder.PlansInstructions");
                pool.addPart(label, plansVal);
            }
        }

        if (!hasLogicMemoryPenaltyMod) {
            // Logic memory check: if checked and Logic < 5, penalty is -(5 - Logic)
            if (this.data.logicMemoryPenaltyChecked && attributeValue < 5) {
                const penaltyVal = -(5 - attributeValue);
                const label = game.i18n.localize("SR5Marketplace.ItemBuilder.LogicMemoryPenalty");
                pool.addPart(label, penaltyVal);
            }
        }

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
            const displayLabel = game.i18n.has(mod.label) ? game.i18n.localize(mod.label) : (mod.label || "Custom");
            pool.addPart(displayLabel, parseModifierValue(mod.value));
        });

        // 6. Finalize dice pool
        this.data.pool.base = 0;
        this.data.pool.changes = this.data.pool.mod.map(m => ({
            name: m.name,
            value: m.value,
            enabled: true,
            mode: typeof CONST !== 'undefined' ? (CONST.ACTIVE_EFFECT_CHANGE_TYPES?.ADD || CONST.ACTIVE_EFFECT_MODES?.ADD || 2) : 2,
            priority: 0
        }));
        this.data.pool.value = this.constructor.calcTotal(this.data.pool);
        console.log("BuildTest _rebuildPool | Finalized pool.value:", this.data.pool.value, "pool.mod:", JSON.stringify(this.data.pool.mod));
    }

    /** @override */
    prepareBaseValues() {
        for (const field of ['pool', 'limit', 'threshold', 'manualHits', 'manualGlitches']) {
            let val = this.data[field];
            const currentBase = (field === 'threshold') 
                ? (this.data.thresholdBase || (val && typeof val === 'object' ? val.base : null) || 0)
                : (val && typeof val === 'object' ? val.base : 0);

            if (typeof val === 'number' || (typeof val === 'string' && val.trim() !== '')) {
                const num = Number(val);
                if (!isNaN(num)) {
                    this.data[field] = game.shadowrun5e.data.createData('value_field', {
                        base: currentBase,
                        override: { value: num, label: "SR5.ManualOverride" }
                    });
                } else {
                    this.data[field] = game.shadowrun5e.data.createData('value_field', { base: currentBase, override: { value: null, label: "SR5.ManualOverride" } });
                }
            } else if (!val || val === null || typeof val.value === 'undefined') {
                this.data[field] = game.shadowrun5e.data.createData('value_field', { base: currentBase, override: { value: null, label: "SR5.ManualOverride" } });
            } else if (val && typeof val === 'object' && val.override) {
                if (val.override.value === undefined || val.override.value === null || val.override.value === "") {
                    val.override.value = null;
                }
            }
        }

        const originalModifiers = this.data.action?.modifiers;
        super.prepareBaseValues();
        if (originalModifiers !== undefined && this.data.action) {
            this.data.action.modifiers = originalModifiers;
        }
        this._rebuildPool();

        // 4. Limit: Mental Limit is applied to build test
        if (this.actor) {
            this.data.limit.base = this.actor.system.limits.mental?.value ?? 0;
        }

        // 5. Extended test setup
        this.data.extended = true;
    }

    /** @override */
    calculateBaseValues() {
        const originalModifiers = this.data.action?.modifiers;
        super.calculateBaseValues();
        if (originalModifiers !== undefined && this.data.action) {
            this.data.action.modifiers = originalModifiers;
        }
        this._rebuildPool();
    }

    /** @override */
    calculateHits() {
        const hits = super.calculateHits();
        if (this.data.manualHits && this.data.manualHits.override && this.data.manualHits.override.value !== null && this.data.manualHits.override.value !== undefined) {
            hits.value = this.data.manualHits.override.value;
        }
        return hits;
    }

    /** @override */
    calculateGlitches() {
        const glitches = super.calculateGlitches();
        if (this.data.manualGlitches && this.data.manualGlitches.override && this.data.manualGlitches.override.value !== null && this.data.manualGlitches.override.value !== undefined) {
            glitches.value = this.data.manualGlitches.override.value;
        }
        return glitches;
    }

    /** @override */
    get success() {
        const thresholdVal = this.threshold?.value ?? this.data.threshold?.value ?? this.options?.threshold ?? this.data.thresholdBase ?? 12;
        const currentHits = this.extendedHits?.value ?? this.data?.values?.extendedHits?.value ?? 0;
        return currentHits >= thresholdVal;
    }

    /** @override */
    get failure() {
        return this.pool.value <= 0 && !this.success;
    }

    /** @override */
    calculateNetHits() {
        const hitsToUse = this.extendedHits;
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
        console.debug("SR5 Marketplace Debug | BuildTest afterTestComplete triggered.", { 
            isWorkshopMod: this.data?.isWorkshopMod, 
            isRepair: this.data?.isRepair, 
            userId: this.data?.userId, 
            currentUserId: game.user?.id 
        });

        console.debug(`SR5 Marketplace | Test ${this.constructor.name} completed.`);

        if (this.success) {
            await this.processSuccess();
        } else {
            await this.processFailure();
        }

        if (this.autoExecuteFollowupTest) {
            await this.executeFollowUpTest();
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
        let rawActor = typeof actorRef === "string" ? await fromUuid(actorRef) : actorRef;
        let actor = rawActor instanceof Actor ? rawActor : rawActor?.actor || null;
        if (!actor) throw new Error("BuildTest: actor not found");

        const data = {
            isRepair: testParams.isRepair ?? false,
            isWorkshopMod: options.isWorkshopMod ?? false,
            installSource: testParams.installSource ?? null,
            installSourceId: testParams.installSourceId ?? null,
            userId: game.user.id,
            vehicleUuid: testParams.vehicle?.uuid || (typeof testParams.vehicle === "string" ? testParams.vehicle : null),
            workshopUuid: testParams.workshop?.uuid || (typeof testParams.workshop === "string" ? testParams.workshop : null),
            virtualModId: testParams.virtualModId ?? null
        };
        const finalOptions = { 
            ...options, 
            buildData: testParams.buildData,
            threshold: testParams.threshold
        };

        if (testParams.vehicle) {
            finalOptions.vehicle = typeof testParams.vehicle === "string" ? await fromUuid(testParams.vehicle) : testParams.vehicle;
        }
        if (testParams.workshop) {
            finalOptions.workshop = typeof testParams.workshop === "string" ? await fromUuid(testParams.workshop) : testParams.workshop;
        }

        // Workshop detection
        if (actor.type === "vehicle" && canvas.ready) {
            const vehicleToken = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
            if (vehicleToken) {
                const workshops = canvas.tokens.placeables.filter(t => 
                    t.actor?.type === "sr5-marketplace.shop" && 
                    t.actor?.system?.shop?.isFactory === true
                );
                for (const wToken of workshops) {
                    const radius = wToken.actor.system.shop.shopRadius.value;
                    const p1 = vehicleToken.center || { x: vehicleToken.x, y: vehicleToken.y };
                    const p2 = wToken.center || { x: wToken.x, y: wToken.y };
                    const distance = canvas.grid.measurePath([p1, p2]).distance;
                    if (distance <= radius) {
                        finalOptions.workshop = wToken.actor;
                        const ownerUuid = wToken.actor.system.shop.owner;
                        if (ownerUuid) {
                            const ownerActor = await fromUuid(ownerUuid);
                            if (ownerActor) {
                                finalOptions.vehicle = actor;
                                actor = ownerActor; // Override roller actor to workshop owner
                            }
                        }
                        break;
                    }
                }
            }
        }

        finalOptions.showDialog = true;
        finalOptions.showMessage = true;

        const test = new this(data, { actor }, finalOptions);
        
        if (finalOptions.showDialog) {
            return new Promise(async (resolve) => {
                BuildTestApp._resolve = (result) => {
                    resolve({ test, resolved: result });
                };
                await test.execute();
            });
        } else {
            await test.execute();
            return test;
        }
    }
}
