import { AppTestFlagService } from '../../../services/AppTestFlagService.mjs';
import { AppDialogBuilder } from './AppDialogBuilder.mjs';
import { BuilderStateService } from "../../../services/builderStateService.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A dedicated dialog application window for running Build Tests.
 */
export class BuildTestApp extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options = {}) {
        // Apply theme classes
        const currentTheme = game.settings.get("sr5-marketplace", "enablePremiumThemes")
            ? (game.user.getFlag("sr5-marketplace", "theme") || "theme-dark")
            : "theme-dark";
        options.classes = [
            ...(options.classes || []),
            "sr5-marketplace",
            "themed",
            currentTheme
        ];
        super(options);
        this.activeDialogId = null;
        this.activeTestState = null;
        this._expandedGroups = new Set();
    }

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "build-test-dialog-app",
            position: { width: 550, height: "auto" },
            window: {
                title: "SR5Marketplace.ItemBuilder.BuildTestTitle",
                resizable: true
            },
            actions: {
                changeBuildTestParameter: this._onChangeBuildTestParameter,
                changeBuildTestCondition: this._onChangeBuildTestCondition,
                selectBuildTestSkill: this._onSelectBuildTestSkill,
                selectBuildTestCondition: this._onSelectBuildTestCondition,
                runBuildTest: this.#onRunBuildTest,
                continueBuildTest: this.#onContinueBuildTest,
                resolveBuildTest: this.#onResolveBuildTest,
                clearBuildTest: this.#onClearBuildTest,
                addCustomBuildTestModifier: this.#onAddCustomBuildTestModifier,
                removeCustomBuildTestModifier: this.#onRemoveCustomBuildTestModifier
            }
        }, { inplace: false });
    }

    /** @override */
    static PARTS = {
        main: {
            id: "body",
            template: "modules/sr5-marketplace/templates/documents/tests/BuildTestDialog.html"
        }
    };

    /** @override */
    async _prepareContext(options) {
        const AppUserId = game.user.id;
        const testStates = await AppTestFlagService.readState(AppUserId);
        const unresolvedTest = Object.values(testStates).find(t => !t.resolved && t.testType === "BuildTest");
        this.activeDialogId = unresolvedTest?.id || null;

        const activeTestState = this.activeDialogId ? testStates[this.activeDialogId] : null;
        this.activeTestState = activeTestState;

        if (activeTestState) {
            const dialogBuilder = new AppDialogBuilder();
            const dialogContext = await dialogBuilder.buildTestDialogContext(activeTestState);
            if (dialogContext) {
                Object.assign(activeTestState, dialogContext);
                activeTestState.customGroupExpanded = this._expandedGroups?.has("toggle-mod-group-custom") ?? true;
            }
        }

        return {
            activeTestState: this.activeTestState
        };
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);
        // Bind collapse/expand tracking
        const customToggle = this.element.querySelector("#toggle-mod-group-custom");
        if (customToggle) {
            customToggle.addEventListener("change", (e) => {
                if (e.target.checked) {
                    this._expandedGroups.add("toggle-mod-group-custom");
                } else {
                    this._expandedGroups.delete("toggle-mod-group-custom");
                }
            });
        }

        // Bind name edit change tracking to prevent losing focus while typing
        const nameInput = this.element.querySelector(".build-item-name-input");
        if (nameInput) {
            nameInput.addEventListener("change", async (e) => {
                const newName = e.target.value.trim();
                if (newName && this.activeTestState) {
                    this.activeTestState.buildData.name = newName;
                    await AppTestFlagService.updateTest(this.activeTestState.id, { buildData: this.activeTestState.buildData });
                    this.render();
                }
            });
        }
    }

    static async _onChangeBuildTestParameter(event, target) {
        if (!this.activeTestState) return;
        const key = target.name;
        const value = target.value;
        console.log(`[onChangeBuildTestParameter] BEFORE: key = "${key}", value = "${this.activeTestState[key]}"`, this.activeTestState);
        this.activeTestState[key] = value;
        await AppTestFlagService.updateTest(this.activeTestState.id, { [key]: value });
        const updatedState = (await AppTestFlagService.readState(game.user.id))[this.activeTestState.id];
        console.log(`[onChangeBuildTestParameter] AFTER: key = "${key}", value = "${updatedState?.[key]}"`, updatedState);
        this.render(false);
    }

    static async _onSelectBuildTestSkill(event, target) {
        if (!this.activeTestState) {
            console.warn("selectBuildTestSkill: No activeTestState found!");
            return;
        }
        const skill = target.dataset.skill;
        console.log(`[selectBuildTestSkill] BEFORE: skill = "${this.activeTestState.skill}"`, this.activeTestState);
        this.activeTestState.skill = skill;
        await AppTestFlagService.updateTest(this.activeTestState.id, { skill: skill });
        const updatedState = (await AppTestFlagService.readState(game.user.id))[this.activeTestState.id];
        console.log(`[selectBuildTestSkill] AFTER: skill = "${updatedState?.skill}"`, updatedState);
        this.render();
    }

    static async _onSelectBuildTestCondition(event, target) {
        if (!this.activeTestState) {
            console.warn("selectBuildTestCondition: No activeTestState found!");
            return;
        }
        const key = target.dataset.name; // workingConditions, toolsParts, plansInstructions
        const value = Number(target.dataset.value);
        const standardModifierLabels = {
            workingConditions: "SR5Marketplace.ItemBuilder.WorkingConditions",
            toolsParts: "SR5Marketplace.ItemBuilder.ToolsParts",
            plansInstructions: "SR5Marketplace.ItemBuilder.PlansInstructions",
            logicMemoryPenaltyChecked: "SR5Marketplace.ItemBuilder.LogicMemoryPenalty"
        };
        const label = standardModifierLabels[key];
        if (!label) {
            console.warn(`selectBuildTestCondition: Standard label not found for key "${key}"`);
            return;
        }
        console.log(`[selectBuildTestCondition] BEFORE: key = "${key}", label = "${label}", appliedModifiers =`, JSON.parse(JSON.stringify(this.activeTestState.appliedModifiers || [])));
        let currentModifiers = this.activeTestState.appliedModifiers ?? [];
        let newModifiers = currentModifiers.filter(m => m.label !== label);
        // Always push the selected condition modifier, even if value is 0, to explicitly override workshop defaults
        newModifiers.push({ label, value });

        // Auto-handle logic memory penalty on plansInstructions change
        if (key === "plansInstructions") {
            const doc = await fromUuid(this.activeTestState.actorUuid);
            const actor = doc instanceof Actor ? doc : doc?.actor || null;
            const logicVal = actor?.system?.attributes?.logic?.value ?? 0;
            const penaltyLabel = "SR5Marketplace.ItemBuilder.LogicMemoryPenalty";

            if (value > 0) {
                newModifiers = newModifiers.filter(m => m.label !== penaltyLabel);
            } else if (value === 0 && logicVal > 0 && logicVal < 5) {
                const penaltyVal = -(5 - logicVal);
                if (!newModifiers.some(m => m.label === penaltyLabel)) {
                    newModifiers.push({ label: penaltyLabel, value: penaltyVal });
                }
            }
        }

        this.activeTestState.appliedModifiers = newModifiers;
        await AppTestFlagService.updateTest(this.activeTestState.id, { appliedModifiers: newModifiers });
        const updatedState = (await AppTestFlagService.readState(game.user.id))[this.activeTestState.id];
        console.log(`[selectBuildTestCondition] AFTER: key = "${key}", value = ${value}, appliedModifiers =`, updatedState?.appliedModifiers);
        this.render();
    }

    static async _onChangeBuildTestCondition(event, target) {
        if (!this.activeTestState) return;

        const standardModifierLabels = {
            workingConditions: "SR5Marketplace.ItemBuilder.WorkingConditions",
            toolsParts: "SR5Marketplace.ItemBuilder.ToolsParts",
            plansInstructions: "SR5Marketplace.ItemBuilder.PlansInstructions",
            logicMemoryPenaltyChecked: "SR5Marketplace.ItemBuilder.LogicMemoryPenalty"
        };

        const key = target.name;
        const label = standardModifierLabels[key];
        if (!label) return;

        let value = 0;
        if (key === "logicMemoryPenaltyChecked") {
            const checked = target.checked;
            console.log(`[onChangeBuildTestCondition] BEFORE (Logic Penalty): checked = ${checked}, appliedModifiers =`, JSON.parse(JSON.stringify(this.activeTestState.appliedModifiers || [])));
            if (checked) {
                const doc = await fromUuid(this.activeTestState.actorUuid);
                const actor = doc instanceof Actor ? doc : doc?.actor || null;
                const logicVal = actor?.system?.attributes?.logic?.value ?? 0;
                value = logicVal < 5 ? -(5 - logicVal) : 0;
            } else {
                value = 0;
            }
        } else {
            value = Number(target.value);
        }

        let currentModifiers = this.activeTestState.appliedModifiers ?? [];
        let newModifiers = currentModifiers.filter(m => m.label !== label);
        if (value !== 0) {
            newModifiers.push({ label, value });
        }

        this.activeTestState.appliedModifiers = newModifiers;
        await AppTestFlagService.updateTest(this.activeTestState.id, { appliedModifiers: newModifiers });

        const updatedState = (await AppTestFlagService.readState(game.user.id))[this.activeTestState.id];
        console.log(`[onChangeBuildTestCondition] AFTER: appliedModifiers =`, updatedState?.appliedModifiers);
        this.render(false);
    }

    static async #onRunBuildTest(event, target) {
        if (!this.activeTestState) return;

        const doc = await fromUuid(this.activeTestState.actorUuid);
        const actor = doc instanceof Actor ? doc : doc?.actor || null;
        if (!actor) return;

        const data = {
            isRepair: this.activeTestState.isRepair ?? false,
            installSource: this.activeTestState.installSource ?? null,
            installSourceId: this.activeTestState.installSourceId ?? null,
            action: {
                skill: this.activeTestState.skill,
                attribute: this.activeTestState.attribute,
                modifiers: this.activeTestState.appliedModifiers,
                threshold: this.activeTestState.threshold,
                buildData: this.activeTestState.buildData,
                dialogId: this.activeDialogId
            }
        };

        if (!actor.isOwner && !game.user.isGM) {
            console.log("Marketplace Builder | Player does not own the test actor. Requesting GM to run build test via socket.");
            game.socket.emit("module.sr5-marketplace", {
                type: "run_build_test",
                userId: game.user.id,
                dialogId: this.activeDialogId,
                actorUuid: actor.uuid,
                data: data
            });
            return;
        }

        const vehicleDoc = this.activeTestState.vehicleUuid ? await fromUuid(this.activeTestState.vehicleUuid) : null;
        const vehicle = vehicleDoc instanceof Actor ? vehicleDoc : vehicleDoc?.actor || null;
        const workshopDoc = this.activeTestState.workshopUuid ? await fromUuid(this.activeTestState.workshopUuid) : null;
        const workshop = workshopDoc instanceof Actor ? workshopDoc : workshopDoc?.actor || null;

        const options = {
            showDialog: false,
            showMessage: false,
            buildData: this.activeTestState.buildData,
            threshold: this.activeTestState.threshold,
            vehicle: vehicle,
            workshop: workshop,
            rollCount: 1
        };
        console.log("Marketplace Builder | Sending data to BuildTest (Run):", JSON.parse(JSON.stringify(data)), "options:", JSON.parse(JSON.stringify(options)));
        try {
            const test = new game.shadowrun5e.tests.BuildTest(data, { actor }, options);
            await test.execute();
            console.log("Marketplace Builder | Received test object back (Run):", test);

            let finalStatus = 'extended-inprogress';
            const targetThreshold = this.activeTestState?.threshold ?? test.data.threshold?.value ?? 12;
            if (test.success || test.data.values.extendedHits.value >= targetThreshold || test.pool.value <= 0) {
                finalStatus = 'resolved';
            }
            console.log("Marketplace Builder | Run Build Test Threshold check:", {
                extendedHits: test.data.values.extendedHits?.value,
                targetThreshold: targetThreshold,
                poolValue: test.pool.value,
                isSuccess: test.success,
                isHitsMet: test.data.values.extendedHits?.value >= targetThreshold,
                isPoolExhausted: test.pool.value <= 0,
                finalStatus: finalStatus
            });

            // Check if crit glitched on last roll
            const roll = test.rolls[test.rolls.length - 1];
            const dice = roll?.terms?.[0]?.results || roll?.dice?.[0]?.results || [];
            const hits = dice.filter(d => (d?.result ?? 0) >= 5).length;
            const ones = dice.filter(d => (d?.result ?? 0) === 1).length;
            const pool = dice.length;
            const isGlitch = ones > pool / 2;
            const isCritGlitch = isGlitch && hits === 0;

            if (isCritGlitch) {
                finalStatus = 'resolved';
            }

            await AppTestFlagService.updateTest(this.activeDialogId, {
                result: test.data,
                rolls: test.rolls,
                status: finalStatus,
                type: "BuildTest",
                rollCount: 1
            });

            this.render();
        } catch (e) {
            console.log("Marketplace Builder | BuildTest failed to run:", e);
        }
    }

    static async #onContinueBuildTest(event, target) {
        if (!this.activeTestState || this.activeTestState.status !== 'extended-inprogress') return;

        const doc = await fromUuid(this.activeTestState.actorUuid);
        const actor = doc instanceof Actor ? doc : doc?.actor || null;
        if (!actor) return;

        const rollCount = (this.activeTestState.rollCount || 0) + 1;
        const penalty = { 
            label: "SR5.ExtendedTestStep", 
            value: -(rollCount - 1),
            isStepPenalty: true 
        };
        let baseModifiers = (this.activeTestState.appliedModifiers || []).filter(m => !m.isStepPenalty);
        const newAppliedModifiers = [...baseModifiers, penalty];

        if (!actor.isOwner && !game.user.isGM) {
            console.log("Marketplace Builder | Player does not own the test actor. Requesting GM to continue build test via socket.");
            game.socket.emit("module.sr5-marketplace", {
                type: "continue_build_test",
                userId: game.user.id,
                dialogId: this.activeDialogId,
                actorUuid: actor.uuid,
                rollCount: rollCount,
                newAppliedModifiers: newAppliedModifiers
            });
            return;
        }

        const data = {
            isRepair: this.activeTestState.isRepair ?? false,
            installSource: this.activeTestState.installSource ?? null,
            installSourceId: this.activeTestState.installSourceId ?? null,
            action: {
                skill: this.activeTestState.skill,
                attribute: this.activeTestState.attribute,
                modifiers: newAppliedModifiers,
                threshold: this.activeTestState.threshold,
                buildData: this.activeTestState.buildData,
                dialogId: this.activeDialogId
            }
        };

        const previousHits = this.activeTestState.result.values.extendedHits.value;

        const vehicleDoc = this.activeTestState.vehicleUuid ? await fromUuid(this.activeTestState.vehicleUuid) : null;
        const vehicle = vehicleDoc instanceof Actor ? vehicleDoc : vehicleDoc?.actor || null;
        const workshopDoc = this.activeTestState.workshopUuid ? await fromUuid(this.activeTestState.workshopUuid) : null;
        const workshop = workshopDoc instanceof Actor ? workshopDoc : workshopDoc?.actor || null;

        const options = {
            showDialog: false,
            showMessage: false,
            buildData: this.activeTestState.buildData,
            threshold: this.activeTestState.threshold,
            vehicle: vehicle,
            workshop: workshop,
            rollCount: rollCount
        };
        console.log("Marketplace Builder | Sending data to BuildTest (Continue):", JSON.parse(JSON.stringify(data)), "options:", JSON.parse(JSON.stringify(options)));
        try {
            const test = new game.shadowrun5e.tests.BuildTest(data, { actor }, options);
            await test.execute();
            console.log("Marketplace Builder | Received test object back (Continue):", test);

            test.data.values.extendedHits.value += previousHits;
            if (test.data.values.extendedHits.mod) {
                test.data.values.extendedHits.mod.push({ name: "Previous Hits", value: previousHits });
            }
            if (test.data.values.extendedHits.changes) {
                test.data.values.extendedHits.changes.push({
                    name: "Previous Hits",
                    value: previousHits,
                    mode: typeof CONST !== 'undefined' ? (CONST.ACTIVE_EFFECT_MODES?.ADD ?? 2) : 2,
                    priority: 0,
                    enabled: true
                });
            }

            let finalStatus = 'extended-inprogress';
            const targetThreshold = this.activeTestState?.threshold ?? test.data.threshold?.value ?? 12;
            if (test.success || test.data.values.extendedHits.value >= targetThreshold || test.pool.value <= 0) {
                finalStatus = 'resolved';
            }
            console.log("Marketplace Builder | Continue Build Test Threshold check:", {
                extendedHits: test.data.values.extendedHits?.value,
                targetThreshold: targetThreshold,
                poolValue: test.pool.value,
                isSuccess: test.success,
                isHitsMet: test.data.values.extendedHits?.value >= targetThreshold,
                isPoolExhausted: test.pool.value <= 0,
                finalStatus: finalStatus
            });

            // Check if crit glitched
            const roll = test.rolls[test.rolls.length - 1];
            const dice = roll?.terms?.[0]?.results || roll?.dice?.[0]?.results || [];
            const hits = dice.filter(d => (d?.result ?? 0) >= 5).length;
            const ones = dice.filter(d => (d?.result ?? 0) === 1).length;
            const pool = dice.length;
            const isGlitch = ones > pool / 2;
            const isCritGlitch = isGlitch && hits === 0;

            if (isCritGlitch) {
                finalStatus = 'resolved';
            }

            await AppTestFlagService.updateTest(this.activeDialogId, {
                result: test.data,
                rolls: test.rolls,
                status: finalStatus,
                rollCount: rollCount,
                appliedModifiers: newAppliedModifiers
            });

            this.render();
        } catch (e) {
            console.log("Marketplace Builder | BuildTest continue failed:", e);
        }
    }

    static async #onResolveBuildTest(event, target) {
        if (!this.activeTestState || this.activeTestState.status !== 'resolved') return;

        if (this.activeTestState.isWorkshopMod) {
            await AppTestFlagService.deleteState(game.user.id);
            this.activeTestState = null;
            this.activeDialogId = null;
            if (BuildTestApp._resolve) {
                BuildTestApp._resolve(true);
                BuildTestApp._resolve = null;
            }
            this.close();
            return;
        }

        if (this.activeTestState.isRepair) {
            const vehicleUuid = this.activeTestState.vehicleUuid || this.activeTestState.actorUuid;
            console.log("Marketplace Builder | #onResolveBuildTest: Resolving vehicle with UUID:", vehicleUuid);
            const vehicleDoc = vehicleUuid ? await fromUuid(vehicleUuid) : null;
            const vehicle = vehicleDoc instanceof Actor ? vehicleDoc : vehicleDoc?.actor || null;
            console.log("Marketplace Builder | Resolved vehicle actor:", vehicle?.name, vehicle);

            if (vehicle) {
                const hits = this.activeTestState.result?.values?.extendedHits?.value ?? 0;
                const pTrack = vehicle.system.track?.physical || vehicle.system.physical_track || {};
                const currentDamage = pTrack.value ?? 0;

                // Heal 1 box per 3 hits (since threshold = damage * 3)
                const healed = Math.floor(hits / 3);
                const newDamage = Math.max(0, currentDamage - healed);

                const isVehicleTrack = !!vehicle.system.track?.physical;
                const updatePath = isVehicleTrack ? "system.track.physical.value" : "system.physical_track.value";

                console.log(`Marketplace Builder | Repair calculation: hits=${hits}, currentDamage=${currentDamage}, healed=${healed}, newDamage=${newDamage}, path=${updatePath}`);

                const updateData = { [updatePath]: newDamage };
                console.log("Marketplace Builder | updateData payload:", updateData);
                console.log("Marketplace Builder | Actor ownership: isOwner =", vehicle.isOwner, "isGM =", game.user.isGM);

                if (vehicle.isOwner || game.user.isGM) {
                    console.log("Marketplace Builder | Performing local update...");
                    await vehicle.update(updateData);
                } else {
                    console.log("Marketplace Builder | Player is not owner. Emitting socket request...");
                    game.socket.emit("module.sr5-marketplace", {
                        action: "update_actor_field",
                        actorUuid: vehicle.uuid,
                        updateData: updateData
                    });
                }

                if (newDamage === 0) {
                    ui.notifications.info(game.i18n.localize("SR5Marketplace.ItemBuilder.RepairHealedComplete"));
                } else {
                    ui.notifications.info(game.i18n.format("SR5Marketplace.ItemBuilder.RepairHealedHits", { hits: healed, damage: newDamage }));
                }
            } else {
                console.warn("Marketplace Builder | No vehicle actor resolved during resolve!");
            }

            await AppTestFlagService.deleteState(game.user.id);
            this.activeTestState = null;
            this.activeDialogId = null;

            if (BuildTestApp._resolve) {
                BuildTestApp._resolve(true);
                BuildTestApp._resolve = null;
            } else {
                const builderApp = Object.values(ui.windows).find(w => w.constructor.name === "ItemBuilderApp");
                if (builderApp) {
                    builderApp.render(true);
                }
            }
            this.close();
            return;
        }

        const buildData = this.activeTestState.buildData;
        const nameInput = this.element.querySelector(".build-item-name-input");
        if (nameInput && buildData) {
            const finalName = nameInput.value.trim();
            if (finalName) {
                buildData.name = finalName;
            }
        }

        const doc = await fromUuid(this.activeTestState.actorUuid);
        const actor = doc instanceof Actor ? doc : doc?.actor || null;

        if (buildData && actor) {
            if (buildData.type === "vehicle") {
                game.socket.emit(`module.sr5-marketplace`, {
                    action: "create_actor",
                    actorData: buildData,
                    userId: game.user.id
                });
                ui.notifications.info(game.i18n.format("SR5Marketplace.ItemBuilder.SuccessBuildCreated", { name: buildData.name }));
            } else {
                await actor.createEmbeddedDocuments("Item", [buildData]);
                ui.notifications.info(game.i18n.format("SR5Marketplace.ItemBuilder.SuccessBuildCreated", { name: buildData.name }));
            }
        }

        await BuilderStateService.clearState();
        await AppTestFlagService.deleteState(game.user.id);

        this.activeTestState = null;
        this.activeDialogId = null;

        if (BuildTestApp._resolve) {
            BuildTestApp._resolve(true);
            BuildTestApp._resolve = null;
        } else {
            // Re-render builder if open
            const builderApp = Object.values(ui.windows).find(w => w.constructor.name === "ItemBuilderApp");
            if (builderApp) {
                builderApp.tabGroups.main = "builder";
                builderApp.render(true);
            }
        }

        this.close();
    }

    static async #onClearBuildTest(event, target) {
        const state = await AppTestFlagService.readState(game.user.id);
        const activeTest = Object.values(state).find(t => t.id === this.activeDialogId);

        if (activeTest && activeTest.status === 'resolved' && !activeTest.result?.values?.extendedHits?.value) {
            await BuilderStateService.clearState();
        } else if (activeTest && activeTest.status === 'resolved') {
            const roll = activeTest.rolls?.[activeTest.rolls.length - 1];
            const dice = roll?.terms?.[0]?.results || roll?.dice?.[0]?.results || [];
            const hits = dice.filter(d => (d?.result ?? 0) >= 5).length;
            const ones = dice.filter(d => (d?.result ?? 0) === 1).length;
            const pool = dice.length;
            const isGlitch = ones > pool / 2;
            const isCritGlitch = isGlitch && hits === 0;

            if (isCritGlitch) {
                await BuilderStateService.clearState();
            }
        }

        await AppTestFlagService.deleteState(game.user.id);
        this.activeTestState = null;
        this.activeDialogId = null;

        // Re-render builder if open
        const builderApp = Object.values(ui.windows).find(w => w.constructor.name === "ItemBuilderApp");
        if (builderApp) {
            builderApp.render();
        }

        this.close();
    }

    static async #onAddCustomBuildTestModifier(event, target) {
        if (!this.activeTestState) return;

        const labelInput = this.element.querySelector(".custom-mod-label");
        const valueInput = this.element.querySelector(".custom-mod-value");
        if (!labelInput || !valueInput) return;

        const label = labelInput.value.trim();
        const rawValue = valueInput.value.trim();

        if (!label) {
            ui.notifications.warn("Please enter a label for the modifier.");
            return;
        }

        const parseModifierValue = (val) => {
            if (typeof val === "number") return val;
            if (typeof val === "string") {
                const clean = val.replace(/[()]/g, "").trim();
                const match = clean.match(/^([+-]?\d+)$/);
                return match ? parseInt(match[1], 10) : null;
            }
            return null;
        };

        const value = parseModifierValue(rawValue);
        if (value === null || isNaN(value)) {
            ui.notifications.warn("Please enter a valid value (e.g., +2 or -2).");
            return;
        }

        const currentModifiers = this.activeTestState.appliedModifiers ?? [];
        if (currentModifiers.some(m => m.label === label)) {
            ui.notifications.warn(`A modifier with label "${label}" already exists.`);
            return;
        }

        const newModifiers = [...currentModifiers, { label, value }];
        this.activeTestState.appliedModifiers = newModifiers;

        await AppTestFlagService.updateTest(this.activeTestState.id, { appliedModifiers: newModifiers });
        this.render();
    }

    static async #onRemoveCustomBuildTestModifier(event, target) {
        if (!this.activeTestState) return;

        const label = target.dataset.label;
        const currentModifiers = this.activeTestState.appliedModifiers ?? [];
        const newModifiers = currentModifiers.filter(m => m.label !== label);

        this.activeTestState.appliedModifiers = newModifiers;

        await AppTestFlagService.updateTest(this.activeTestState.id, { appliedModifiers: newModifiers });
        this.render();
    }

    async close(options = {}) {
        if (BuildTestApp._resolve) {
            BuildTestApp._resolve(false);
            BuildTestApp._resolve = null;
        } else {
            const builderApp = Object.values(ui.windows).find(w => w.constructor.name === "ItemBuilderApp");
            if (builderApp) {
                builderApp.render(true);
            }
        }
        return super.close(options);
    }
}
