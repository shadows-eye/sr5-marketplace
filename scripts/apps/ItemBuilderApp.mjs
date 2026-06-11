import { ItemPreviewApp } from "../apps/documents/items/ItemPreviewApp.mjs";
import { SearchService as itemSearchService } from '../services/searchTag.mjs';
import { VehicleSearchService } from "../services/vehicleSearchService.mjs";
import { BuilderStateService } from "../services/builderStateService.mjs";
import { AppEffectsBuilderDialog } from '../apps/documents/dialog/AppEffectsBuilderDialog.mjs';
import { BasketService } from "../services/basketService.mjs";
import { ActorSelectionService } from "../services/ActorSelectionService.mjs";
import { AppTestFlagService } from '../services/AppTestFlagService.mjs';
import { AppDialogBuilder } from '../apps/documents/dialog/AppDialogBuilder.mjs';
import { BuildTestApp } from "./BuildTestApp.mjs";
// We will create this service later to handle the builder logic.
// import { BuilderService } from '../services/builderService.mjs'; 

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The main application window for the Item Builder feature.
 * This app allows users to select a base item and apply modifications to it.
 */
export class ItemBuilderApp extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options = {}) {
        // Apply theme classes just like in the marketplace app
        const currentTheme = ItemBuilderApp._getThemeFromSetting();
        options.classes = [
            ...(options.classes || []),
            "sr5-marketplace",
            "itemBuilder", // A unique class for this app
            "themed",
            currentTheme
        ];
        super(options);

        // --- State and Services ---
        this.itemData = game.sr5marketplace.api.itemData; // Use the global item data service
        console.log(this.itemData);
        this.purchasingActor = null;
        this.itemSearchService = null;
        this.activeTestState = null;
        this.activeDialogId = null;
        this.modSearchService = null;
        // this.builderService = new BuilderService(); // To be added later no builder data needed here
        this.tabGroups = { main: "builder" }; // Default to the 'builder' tab

        this.workshopActorUuid = options.workshopActorUuid || null;
        this.selectedVehicleActorUuid = null;
        if (options.initialTab) {
            this.tabGroups.main = options.initialTab;
        }

        // --- Item & Category Selection State ---
        this.selectedKey = null;
        this.itemSearchQuery = "";
        this.itemSearchTags = [];
        this.modSearchQuery = "";
        this.modSearchTags = [];
        this.workshopSearchQuery = "";
        this.workshopSearchTags = [];
        this.workshopSearchService = null;
        this.workshopShelfEntries = [];
        this.filteredWorkshopShelfEntries = [];

        this.hoverTimeout = null;
        // To hold a reference to the active tooltip application
        this.tooltipApp = null;

        //Drag data
        this.draggedModData = null;
        this.draggedItemType = null;
    }

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "itemBuilder",
            position: { width: 1600, height: 860 },
            window: { title: "Item Builder", resizable: true },
            dragDrop: [
                {
                    // Handler 1: Modifications -> Main Slots
                    dragSelector: ".mod-selector-section .item-card[draggable='true']",
                    dropSelector: ".builder-area .mod-slot[data-slot-id]" // <-- More specific selector
                },
                {
                    // Handler 2: Base Items -> Bottom Slots
                    dragSelector: ".item-selector-section .item-card[draggable='true']",
                    dropSelector: ".bottom-slots .mod-slot[data-slot-id]"

                },
                {
                    // Handler 3: Workshop Modifications -> Category Boxes
                    dragSelector: ".workshop-shelf [draggable='true']",
                    dropSelector: ".workshop-layout-three-columns .category-box.drop-target"
                }
            ],
            actions: {
                // Core
                changeTab: this.#onChangeTab,
                clickItemName: this.#onClickItemName,
                buildItem: this.#onBuildItem,
                clearBuild: this.#onClearBuild,
                startBuildTest: this.#onStartBuildTest,
                addToCart: this.#onAddToCart,
                toggleBaseItemEdit: this.#onToggleBaseItemEdit,
                selectBaseItemImage: this.#onSelectBaseItemImage,
                // Builder Tab
                selectBaseItem: this.#onSelectBaseItem,
                removeChange: this.#onRemoveChange,
                selectCategory: this.#onSelectCategory,
                // Effects Tab
                createEffect: this.#onCreateEffect,
                editEffect: this.#onEditEffect,
                deleteEffect: this.#onDeleteEffect,
                updateDraftField: this.#onUpdateDraftField,
                selectDraftKey: this.#onSelectDraftKey,
                saveDraftEffect: this.#onSaveDraftEffect,
                cancelDraftEffect: this.#onCancelDraftEffect,
                toggleDerivedValueSelector: this.#onToggleDerivedValueSelector,
                selectDerivedValue: this.#onSelectDerivedValue,
                setEffectTargetType: this.#onSetEffectTargetType,
                // --- Tagify ---
                toggleMultiSelectDropdown: this.#onToggleMultiSelectDropdown,
                updateMultiSelect: this.#onUpdateMultiSelect,
                // Workshop Tab
                selectVehicleActor: this.#onSelectVehicleActor,
                deselectVehicleActor: this.#onDeselectVehicleActor,
                runWorkshopRepair: this.#onRunWorkshopRepair,
                toggleBuiltIn: this.#onToggleBuiltIn,
                clearConditionMonitor: this.#onClearConditionMonitor,
                modifyConditionMonitor: this.#onModifyConditionMonitor,
                rollConditionMonitor: this.#onRollConditionMonitor
            }
        }, { inplace: false });
    }

    /**
     * To use direct-path partials `{{> ...}}`, we ONLY define the main template here.
     * @override
     */
    static PARTS = {
        main: { template: "modules/sr5-marketplace/templates/apps/itemBuilder/item-builder.html" }
    };

    /**
     * @override
     * Called when a drag operation starts.
     */
    _onDragStart(event) {
        // --- THIS IS THE FIX ---
        // Immediately close any active tooltip and clear hover timers.
        this.#onItemHoverOut(event);

        this.element.classList.add("dragging-mod");
        const card = event.currentTarget;
        const data = {
            uuid: card.dataset.itemUuid,
            mountPoint: card.dataset.mountPoint,
            isFromOwner: card.dataset.isFromOwner === "true",
            entryId: card.dataset.entryId
        };
        this.draggedModData = { mountPoint: data.mountPoint };
        event.dataTransfer.setData("text/plain", JSON.stringify(data));

        // If dragging from workshop shelf, highlight correct workshop category boxes
        if (card.closest(".workshop-shelf")) {
            this.draggedItemType = "workshop-mod";
            const draggedMountPoint = (data.mountPoint || "").toLowerCase();
            const categoryBoxes = this.element.querySelectorAll(".category-box.drop-target");
            categoryBoxes.forEach(box => {
                const targetCategory = (box.dataset.category || "").toLowerCase();
                if (targetCategory === draggedMountPoint) {
                    box.classList.add("initial-valid");
                } else {
                    box.classList.add("initial-invalid");
                }
            });
            return;
        }

        const allSlots = this.element.querySelectorAll(".mod-slot[data-slot-id]");

        // 1. Determine Drag Type (Mod or Item)
        if (card.closest(".mod-selector-section")) {
            this.draggedItemType = "mod";
            this.draggedModData = { mountPoint: data.mountPoint || "none" };
            const draggedMountPoint = this.draggedModData.mountPoint;
            const hasNoMountPoint = !draggedMountPoint || draggedMountPoint === "none" || draggedMountPoint === "";

            // 2. Apply visuals for MOD drag
            allSlots.forEach(slot => {
                const targetMountPoint = slot.dataset.mountPoint;
                const isBottomSlot = !!slot.closest(".bottom-slots");

                if (isBottomSlot) {
                    if (hasNoMountPoint) {
                        slot.classList.add("initial-valid");
                    } else {
                        slot.classList.add("initial-invalid"); // Mods with a mount point can't go in bottom slots
                    }
                    return;
                }

                if (!targetMountPoint || targetMountPoint === draggedMountPoint) {
                    slot.classList.add("initial-valid");
                } else {
                    slot.classList.add("initial-invalid");
                }
            });

        } else if (card.closest(".item-selector-section")) {
            this.draggedItemType = "item";
            this.draggedModData = null; // Not dragging a mod

            // 2. Apply visuals for ITEM drag
            allSlots.forEach(slot => {
                const isBottomSlot = !!slot.closest(".bottom-slots");
                if (isBottomSlot) {
                    slot.classList.add("initial-valid"); // Items can *only* go in bottom slots
                } else {
                    slot.classList.add("initial-invalid");
                }
            });
        }

    }

    /**
     * @override
     * Called when a dragged element enters a drop target. Now only adds the hover effect.
     */
    _onDragEnter(event) {
        const slot = event.currentTarget;
        slot.classList.add("drag-hover");
        if (slot.classList.contains("initial-override")) {
            slot.classList.add("override-drop");
        } else if (slot.classList.contains("initial-valid")) {
            slot.classList.add("valid-drop");
        } else if (slot.classList.contains("initial-invalid")) {
            slot.classList.add("invalid-drop");
        }
    }

    /**
     * @override
     * Called when a dragged element leaves a drop target. Now only removes the hover effect.
     */
    _onDragLeave(event) {
        event.currentTarget.classList.remove("valid-drop", "invalid-drop", "override-drop", "drag-hover");
    }

    /**
     * @override
     * Called when a drag operation concludes. This is the master cleanup function.
     */
    _onDragEnd(event) {
        this.draggedModData = null;
        this.draggedItemType = null;
        this.element.classList.remove("dragging-mod");

        // Clean up ALL drag-related classes from ALL slots and workshop category boxes
        this.element.querySelectorAll(".mod-slot[data-slot-id], .category-box.drop-target").forEach(s => {
            s.classList.remove(
                "valid-drop", "invalid-drop", "override-drop", "drag-hover",
                "initial-valid", "initial-invalid", "initial-override"
            );
        });
    }

    async _onDrop(event) {
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        const slot = event.currentTarget;


        // Check if dropping onto a workshop category box
        const isWorkshopDrop = slot.classList.contains("category-box");
        if (isWorkshopDrop) {
            const targetCategory = slot.dataset.category; // e.g. "drive"
            const vehicleUuid = this.selectedVehicleActorUuid;
            if (!vehicleUuid) return;
            const vehicleDoc = await fromUuid(vehicleUuid);
            const vehicle = vehicleDoc instanceof Actor ? vehicleDoc : vehicleDoc?.actor || null;
            if (!vehicle) return;

            const item = await fromUuid(data.uuid);
            if (!item || item.type !== "modification") {
                ui.notifications.warn("Only modifications can be installed in the workshop.");
                return;
            }

            // Verify category matches
            const modCategory = (item.system.category || "cosmetic").toLowerCase();
            if (modCategory !== targetCategory) {
                ui.notifications.warn(`This modification belongs to the "${modCategory}" category, not "${targetCategory}".`);
                return;
            }

            // Check slot limit
            const bodyRating = vehicle.system.attributes?.body?.value ?? 0;
            const getSlotLimit = (cat) => {
                const override = game.settings.get("sr5-marketplace", `slotOverride_${cat}`);
                return override > 0 ? override : bodyRating;
            };

            const max = getSlotLimit(targetCategory);
            const installedMods = vehicle.items.filter(i => {
                if (i.type !== "modification") return false;
                if ((i.system.category || "cosmetic").toLowerCase() !== targetCategory) return false;

                const isPreinstalled = i.getFlag?.("sr5-marketplace", "isPreinstalled") ||
                    i.system.preInstalled ||
                    i.system.preinstalled ||
                    i.system.isPreInstalled ||
                    i.system.isPreinstalled ||
                    i.flags?.shadowrun5e?.preInstalled ||
                    i.flags?.shadowrun5e?.preinstalled ||
                    false;
                return !isPreinstalled;
            });
            const used = installedMods.reduce((sum, m) => sum + (Number(m.system.rating ?? m.system.technology?.rating ?? 1) || 1), 0);
            const newModRating = Number(item.system.rating ?? item.system.technology?.rating ?? 1) || 1;

            if (used + newModRating > max) {
                ui.notifications.error(`Not enough slots available in category "${targetCategory}" (Max: ${max}, Used: ${used}, Required: ${newModRating}).`);
                return;
            }

            // Close any existing build test dialogs
            const buildTestApp = Object.values(ui.windows).find(w => w.constructor.name === "BuildTestApp");
            if (buildTestApp) {
                buildTestApp.close();
            }

            // Open the build test dialog!
            const rating = Number(item.system.rating ?? item.system.technology?.rating ?? 1);
            const threshold = rating > 0 ? rating * 2 : 12;

            const workshop = await fromUuid(this.workshopActorUuid);

            console.log("SR5 Marketplace | Starting modification build test...");
            const runResult = await game.shadowrun5e.tests.BuildTest.run(vehicle.uuid, {
                buildData: item.toObject(),
                threshold: threshold,
                installSource: data.isFromOwner ? "owner" : "workshop",
                installSourceId: data.entryId,
                vehicle: vehicle,
                workshop: workshop
            });
            console.log("SR5 Marketplace | Modification build test resolved. Result:", runResult);
            this.render(true);
            return;
        }


        const slotId = slot.dataset.slotId;
        const isBottomSlot = !!slot.closest(".bottom-slots");

        const item = await fromUuid(data.uuid);
        if (!item) return;

        // Create the complete data object from the fetched item.
        const droppedItemData = {
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            type: item.type,
            system: item.system,
            effects: item.effects.map(e => e.toObject(false))
        };

        // Normalize mount_point in dropped item data
        if (droppedItemData.system && droppedItemData.system.mod_weapon?.mount_point) {
            droppedItemData.system.mount_point = droppedItemData.system.mod_weapon.mount_point;
        }

        if (this.draggedItemType === "mod") {
            const draggedMountPoint = item.system.mod_weapon?.mount_point || item.system.mount_point || data.mountPoint || "none";
            const hasNoMountPoint = !draggedMountPoint || draggedMountPoint === "none" || draggedMountPoint === "";

            if (isBottomSlot) {
                if (!hasNoMountPoint) {
                    ui.notifications.error("Modifications with a mount point can only be placed in the top slots.");
                    return;
                }
            } else {
                const targetMountPoint = slot.dataset.mountPoint; // e.g. "barrel", "under", "top"

                // If it's a weapon, validate mount point
                if (targetMountPoint && targetMountPoint !== draggedMountPoint) {
                    ui.notifications.warn(`This modification requires a "${draggedMountPoint}" mount point.`);
                    return;
                }
            }

            await BuilderStateService.addChange(slotId, droppedItemData);
            this.render();
        }
        else if (this.draggedItemType === "item") {
            if (!isBottomSlot) {
                ui.notifications.error("Items can only be placed in the bottom slots.");
                return;
            }

            await BuilderStateService.addChange(slotId, droppedItemData);
            this.render();
        }
    }

    /** 
     * @override
     * @param {object} context - The context object on render.
     * @param {object} options - The options from the main app passed down.
     */
    _onRender(context, options) {
        super._onRender(context, options);

        // Prevent native form submission within this window (e.g. Enter key in search input fields)
        this.element.addEventListener("submit", (e) => e.preventDefault());

        // --- BIND DRAG & DROP HANDLERS ---
        this.#dragDrop.forEach(d => d.bind(this.element));

        // --- Logic for the "Builder" and "Vehicle" Tabs ---
        if (this.tabGroups.main === "builder" || this.tabGroups.main === "vehicle") {
            // Initialize Search Services scoped to their sections
            const itemSection = this.element.querySelector(".item-selector-section");
            if (itemSection) {
                const searchClass = this.tabGroups.main === "vehicle" ? VehicleSearchService : itemSearchService;
                this.itemSearchService = new searchClass(itemSection, (tags, query) => {
                    this.itemSearchQuery = query;
                    this.itemSearchTags = tags;
                    this._filterItemsDOM('.item-selector-section .item-content-grid', tags, query);
                });
                this.itemSearchService.initialize();

                // If there are existing tags/query from a previous render, re-apply them to DOM
                if (this.itemSearchTags.length > 0 || this.itemSearchQuery) {
                    this.itemSearchService.activeFilters = [...this.itemSearchTags];
                    const sBox = itemSection.querySelector("#search-box");
                    if (sBox) sBox.value = this.itemSearchQuery;
                    this.itemSearchService.applyFilters();
                }
            }

            const modSection = this.element.querySelector(".mod-selector-section");
            if (modSection) {
                this.modSearchService = new itemSearchService(modSection, (tags, query) => {
                    this.modSearchQuery = query;
                    this.modSearchTags = tags;
                    this._filterItemsDOM('.mod-selector-section .item-content-grid', tags, query);
                });
                this.modSearchService.initialize();

                // If there are existing tags/query from a previous render, re-apply them to DOM
                if (this.modSearchTags.length > 0 || this.modSearchQuery) {
                    this.modSearchService.activeFilters = [...this.modSearchTags];
                    const sBox = modSection.querySelector("#search-box");
                    if (sBox) sBox.value = this.modSearchQuery;
                    this.modSearchService.applyFilters();
                }
            }

            const categorySelector = this.element.querySelector("#item-type-selector");
            if (categorySelector) {
                categorySelector.addEventListener("change", this.onChangeCategory.bind(this));
            }

            // --- UNIFIED TOOLTIP LISTENERS ---
            // Select all elements that should have a hover tooltip
            const hoverTargets = this.element.querySelectorAll("[data-hover-delay]");

            hoverTargets.forEach(target => {
                target.addEventListener("mouseenter", this.#onItemHoverIn.bind(this));
                target.addEventListener("mouseleave", this.#onItemHoverOut.bind(this));
            });
        }

        if (this.tabGroups.main === "workshop") {
            this.workshopShelfEntries = this.workshopShelfEntries || [];
            this.filteredWorkshopShelfEntries = [...this.workshopShelfEntries];

            const workshopContainer = this.element.querySelector(".workshop-container");
            const shelfContainer = this.element.querySelector(".workshop-shelf");

            if (shelfContainer) {
                shelfContainer.addEventListener("scroll", this._onScrollWorkshopShelf.bind(this), { passive: true });
            }

            if (workshopContainer) {
                this.workshopSearchService = new itemSearchService(workshopContainer, (tags, query) => {
                    this.workshopSearchQuery = query;
                    this.workshopSearchTags = tags;

                    const queryTerm = query.trim().toLowerCase();
                    const tagTerms = tags.map(t => t.trim().toLowerCase());

                    this.filteredWorkshopShelfEntries = this.workshopShelfEntries.filter(item => {
                        const name = item.name.toLowerCase();
                        const category = item.category.toLowerCase();
                        const matchesQuery = !queryTerm || name.includes(queryTerm) || category.includes(queryTerm);
                        const matchesTags = tagTerms.every(tag => name.includes(tag) || category.includes(tag));
                        return matchesQuery && matchesTags;
                    });

                    if (shelfContainer) shelfContainer.scrollTop = 0;
                    this._updateWorkshopShelfScroll();
                });
                this.workshopSearchService.initialize();

                if (this.workshopSearchTags.length > 0 || this.workshopSearchQuery) {
                    this.workshopSearchService.activeFilters = [...this.workshopSearchTags];
                    const sBox = workshopContainer.querySelector("#search-box");
                    if (sBox) sBox.value = this.workshopSearchQuery;
                    this.workshopSearchService.applyFilters();
                } else {
                    this._updateWorkshopShelfScroll();
                }
            }
        }

        if (this.activeDialogId && !Object.values(ui.windows).some(w => w.constructor.name === "BuildTestApp")) {
            new BuildTestApp().render(true);
        }
    }

    /**
     * Instantly filters list elements in the DOM based on tags and live query.
     * @param {string} containerSelector The selector for the grid container.
     * @param {Array<string>} tags Active filter tags.
     * @param {string} query The live search term.
     * @private
     */
    _filterItemsDOM(containerSelector, tags, query) {
        const container = this.element.querySelector(containerSelector);
        if (!container) return;

        const cards = container.querySelectorAll(".item-card");
        const queryTerm = query.trim().toLowerCase();
        const tagTerms = tags.map(t => t.trim().toLowerCase());
        const isVehicleTab = this.tabGroups.main === "vehicle";

        cards.forEach(card => {
            const nameEl = card.querySelector(".item-name");
            const name = nameEl ? nameEl.textContent.trim().toLowerCase() : "";
            const matchesQuery = !queryTerm || name.includes(queryTerm);

            let matchesTags = false;
            if (isVehicleTab && containerSelector.includes(".item-selector-section")) {
                const category = (card.dataset.category || "").toLowerCase();
                const isDrone = card.dataset.isDrone === "true";
                const typeText = isDrone ? "drone" : "vehicle";

                matchesTags = tagTerms.every(tag => {
                    return name.includes(tag) ||
                        category.includes(tag) ||
                        typeText.includes(tag);
                });
            } else {
                matchesTags = tagTerms.every(tag => name.includes(tag));
            }

            if (matchesQuery && matchesTags) {
                card.style.display = "";
            } else {
                card.style.display = "none";
            }
        });

        // Toggle category headers (<h4>)
        const headers = container.querySelectorAll(".category-header");
        headers.forEach(header => {
            let next = header.nextElementSibling;
            let anyVisible = false;
            while (next && !next.classList.contains("category-header")) {
                if (next.classList.contains("item-card") && next.style.display !== "none") {
                    anyVisible = true;
                }
                next = next.nextElementSibling;
            }
            header.style.display = anyVisible ? "" : "none";
        });
    }

    _onScrollWorkshopShelf(event) {
        if (this._workshopScrollThrottle) return;
        this._workshopScrollThrottle = true;
        this._updateWorkshopShelfScroll();
        setTimeout(() => {
            this._workshopScrollThrottle = false;
        }, 15);
    }

    _updateWorkshopShelfScroll() {
        const container = this.element.querySelector(".workshop-shelf");
        if (!container) return;

        const scrollTop = container.scrollTop;
        const clientHeight = container.clientHeight;
        const rowHeight = 50;

        const entries = this.filteredWorkshopShelfEntries || [];
        const visibleRows = Math.ceil(clientHeight / rowHeight);
        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
        const endRow = Math.min(entries.length, startRow + visibleRows + 10);

        const toRender = [];

        const topPad = document.createElement("div");
        topPad.style.height = `${startRow * rowHeight}px`;
        toRender.push(topPad);

        const slice = entries.slice(startRow, endRow);
        for (const item of slice) {
            const card = document.createElement("div");
            card.className = `mod-card ${item.isFromOwner ? 'owner-mod' : ''}`;
            card.setAttribute("draggable", "true");
            card.dataset.itemUuid = item.uuid;
            card.dataset.isFromOwner = item.isFromOwner;
            card.dataset.entryId = item.entryId;
            card.dataset.mountPoint = item.category;
            card.innerHTML = `
                <img src="${item.img}" />
                <div class="mod-card-details">
                    <div class="mod-card-name" title="${item.name}">${item.name}</div>
                    <div class="mod-card-sub">
                        <span>R${item.rating} &bull; ${item.category}</span>
                        ${item.isFromOwner ? '<span class="owner-indicator-badge">Owner</span>' : `<span style="font-size: 0.9em; opacity: 0.7;">Qty: ${item.qty}</span>`}
                    </div>
                </div>
            `;
            toRender.push(card);
        }

        const bottomPad = document.createElement("div");
        bottomPad.style.height = `${Math.max(0, entries.length - endRow) * rowHeight}px`;
        toRender.push(bottomPad);

        container.replaceChildren(...toRender);

        container.querySelectorAll("[draggable='true']").forEach(el => {
            el.addEventListener("dragstart", (e) => this._onDragStart(e));
            el.addEventListener("dragend", (e) => this._onDragEnd(e));
        });
    }

    /** @override */
    async _prepareContext(options) {
        // At the start of every render, get the latest state from the flag.
        const builderData = options.builderData ?? await BuilderStateService.getState();

        // Automatically switch tabs if the selected base item type demands it
        if (builderData.baseItem) {
            const isVehicle = builderData.baseItem.type === "vehicle";
            if (isVehicle && this.tabGroups.main === "builder") {
                this.tabGroups.main = "vehicle";
            } else if (!isVehicle && this.tabGroups.main === "vehicle") {
                this.tabGroups.main = "builder";
            }
        }

        this.purchasingActor = await ActorSelectionService.getSelectedActor();

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

        let tabContent = null;
        const render = foundry.applications.handlebars.renderTemplate;
        const partialContext = {
            purchasingActor: this.purchasingActor,
            hasBaseItem: !!builderData.baseItem, // Use the state we just fetched
            builderData: builderData,             // Pass it to the partial
            activeTab: this.tabGroups.main,
            activeTestState: this.activeTestState,
            workshopActorUuid: this.workshopActorUuid
        };

        switch (this.tabGroups.main) {
            case "effects":
                this.tabGroups.main = "effects";
                const effectsBuilder = new AppEffectsBuilderDialog();
                const effectsContext = await effectsBuilder.buildEffectsContext(builderData);
                foundry.utils.mergeObject(partialContext, effectsContext);
                tabContent = await render("modules/sr5-marketplace/templates/apps/itemBuilder/partials/Effects.html", partialContext);
                break;

            case "workshop":
                this.tabGroups.main = "workshop";
                try {
                    if (this.workshopActorUuid) {
                        const workshopActor = await fromUuid(this.workshopActorUuid);
                        if (workshopActor) {
                            partialContext.workshopActor = workshopActor;
                            partialContext.factoryRating = workshopActor.system.shop.factoryRating;
                            partialContext.isFactory = workshopActor.system.shop.isFactory;

                            const tokensInRadius = await workshopActor.getTokensInRadius() || [];

                            const vehiclesInRadius = tokensInRadius.filter(t => t.actor?.type === "vehicle").map(t => {
                                const pTrack = t.actor.system.track?.physical || t.actor.system.physical_track || {};
                                return {
                                    uuid: t.actor.uuid,
                                    tokenId: t.id,
                                    name: t.name,
                                    img: t.actor.img || "systems/shadowrun5e/dist/icons/importer/equipment/vehicle.svg",
                                    body: t.actor.system.attributes?.body?.value ?? 0,
                                    physicalTrack: pTrack
                                };
                            });
                            partialContext.vehiclesInRadius = vehiclesInRadius;

                            let activeVehicle = null;
                            if (this.selectedVehicleActorUuid) {
                                activeVehicle = await fromUuid(this.selectedVehicleActorUuid);
                            }
                            if (!activeVehicle && vehiclesInRadius.length > 0) {
                                if (vehiclesInRadius.length === 1) {
                                    this.selectedVehicleActorUuid = vehiclesInRadius[0].uuid;
                                    activeVehicle = await fromUuid(this.selectedVehicleActorUuid);
                                }
                            }

                            partialContext.activeVehicle = activeVehicle;

                            if (activeVehicle) {
                                const installedMods = activeVehicle.items.filter(i => i.type === "modification");
                                const bodyRating = activeVehicle.system.attributes?.body?.value ?? 0;
                                const getSlotLimit = (cat) => {
                                    const override = game.settings.get("sr5-marketplace", `slotOverride_${cat}`);
                                    return override > 0 ? override : bodyRating;
                                };

                                const categories = {
                                    drive: { label: "SR5Marketplace.Factory.Category.Drive", items: [], max: getSlotLimit("drive"), used: 0 },
                                    protection: { label: "SR5Marketplace.Factory.Category.Protection", items: [], max: getSlotLimit("protection"), used: 0 },
                                    weapons: { label: "SR5Marketplace.Factory.Category.Weapons", items: [], max: getSlotLimit("weapons"), used: 0 },
                                    body: { label: "SR5Marketplace.Factory.Category.Hull", items: [], max: getSlotLimit("body"), used: 0 },
                                    electronics: { label: "SR5Marketplace.Factory.Category.Electronics", items: [], max: getSlotLimit("electronics"), used: 0 },
                                    cosmetic: { label: "SR5Marketplace.Factory.Category.Cosmetic", items: [], max: getSlotLimit("cosmetic"), used: 0 }
                                };

                                for (const mod of installedMods) {
                                    const cat = (mod.system.category || "cosmetic").toLowerCase();
                                    const rating = mod.system.rating ?? mod.system.technology?.rating ?? 1;
                                    const isPreinstalled = mod.getFlag?.("sr5-marketplace", "isPreinstalled") ||
                                        mod.system.preInstalled ||
                                        mod.system.preinstalled ||
                                        mod.system.isPreInstalled ||
                                        mod.system.isPreinstalled ||
                                        mod.flags?.shadowrun5e?.preInstalled ||
                                        mod.flags?.shadowrun5e?.preinstalled ||
                                        false;

                                    const modData = mod.toObject();
                                    modData.uuid = mod.uuid;
                                    modData.id = mod.id;
                                    modData.isPreinstalled = isPreinstalled;

                                    if (categories[cat]) {
                                        categories[cat].items.push(modData);
                                        if (!isPreinstalled) {
                                            categories[cat].used += Number(rating) || 1;
                                        }
                                    } else {
                                        categories.cosmetic.items.push(modData);
                                        if (!isPreinstalled) {
                                            categories.cosmetic.used += Number(rating) || 1;
                                        }
                                    }
                                }
                                partialContext.categories = categories;

                                const pTrack = activeVehicle.system.track?.physical || activeVehicle.system.physical_track || {};
                                partialContext.physicalTrack = {
                                    value: pTrack.value ?? 0,
                                    max: pTrack.max ?? 0,
                                    boxes: Array.from({ length: pTrack.max ?? 0 }, (_, i) => ({
                                        filled: i < (pTrack.value ?? 0)
                                    }))
                                };

                                const mTrack = activeVehicle.system.matrix?.condition_monitor || {};
                                partialContext.matrixTrack = {
                                    value: mTrack.value ?? 0,
                                    max: mTrack.max ?? 0,
                                    boxes: Array.from({ length: mTrack.max ?? 0 }, (_, i) => ({
                                        filled: i < (mTrack.value ?? 0),
                                        value: i + 1
                                    }))
                                };
                            }

                            const allGlobalItems = game.sr5marketplace.api.itemData.getItems() || [];
                            const shopInv = workshopActor.system.shop.inventory || {};
                            const shopInvEntries = Object.entries(shopInv);

                            const shopModsPromises = shopInvEntries.map(async ([entryId, itemData]) => {
                                let sourceItem = allGlobalItems.find(i => i.uuid === itemData.itemUuid);
                                if (!sourceItem) {
                                    sourceItem = await fromUuid(itemData.itemUuid);
                                }
                                if (sourceItem && sourceItem.type === "modification") {
                                    return {
                                        uuid: sourceItem.uuid,
                                        entryId: entryId,
                                        name: sourceItem.name,
                                        img: sourceItem.img || "systems/shadowrun5e/dist/icons/importer/equipment/modification.svg",
                                        qty: itemData.qty ?? 1,
                                        category: sourceItem.system.category || "cosmetic",
                                        rating: sourceItem.system.rating ?? sourceItem.system.technology?.rating ?? 1,
                                        isFromOwner: false
                                    };
                                }
                                return null;
                            });

                            const resolvedShopMods = await Promise.all(shopModsPromises);
                            const modsOnShelf = resolvedShopMods.filter(m => m !== null);

                            const ownerActor = await workshopActor.getOwner();
                            if (ownerActor) {
                                const ownerMods = ownerActor.items.filter(i => i.type === "modification");
                                for (const mod of ownerMods) {
                                    modsOnShelf.push({
                                        uuid: mod.uuid,
                                        entryId: mod.id,
                                        name: mod.name,
                                        img: mod.img || "systems/shadowrun5e/dist/icons/importer/equipment/modification.svg",
                                        qty: mod.system.quantity ?? 1,
                                        category: mod.system.category || "cosmetic",
                                        rating: mod.system.rating ?? mod.system.technology?.rating ?? 1,
                                        isFromOwner: true
                                    });
                                }
                            }
                            partialContext.modsOnShelf = modsOnShelf;
                            this.workshopShelfEntries = modsOnShelf;
                        }
                    }
                    tabContent = await render("modules/sr5-marketplace/templates/apps/itemBuilder/partials/Workshop.html", partialContext);
                } catch (workshopError) {
                    console.error("SR5 Marketplace | Error in workshop context prep:", workshopError);
                    throw workshopError;
                }
                break;

            case "builder":
            case "vehicle":
            default: // "builder" or "vehicle" tab
                if (this.tabGroups.main !== "builder" && this.tabGroups.main !== "vehicle") {
                    this.tabGroups.main = "builder";
                }
                let displayItem = null;
                if (builderData.baseItem) {
                    displayItem = foundry.utils.deepClone(builderData.baseItem);
                    // Merge the overrides on top for display
                    foundry.utils.mergeObject(displayItem, builderData.baseItemOverrides);
                }
                partialContext.displayItem = displayItem;
                partialContext.isEditingBaseItem = builderData.isEditingBaseItem;

                const baseItemsByType = await this.itemData.fetchGlobalItems('base') || {};
                const modsByType = await this.itemData.fetchGlobalItems('modifications') || {};

                // We now use the 'allModifications' key as the single, reliable source for all mods.
                let allMods = modsByType.allModifications?.items || [];
                let itemsByType = { ...baseItemsByType };

                if (this.tabGroups.main === "vehicle") {
                    // Filter base items to show only vehicles and drones
                    itemsByType = {
                        vehicles: baseItemsByType.vehicles || { label: "SR5.Vehicle.Vehicle", items: [] },
                        drones: baseItemsByType.drones || { label: "SR5.Vehicle.Drone", items: [] }
                    };
                    // Filter modifications to show only vehicle and drone mods
                    allMods = [
                        ...(modsByType.vehicleMods?.items || []),
                        ...(modsByType.droneMods?.items || [])
                    ];
                } else {
                    // Exclude vehicles and drones from normal item builder
                    itemsByType = { ...baseItemsByType };
                    delete itemsByType.vehicles;
                    delete itemsByType.drones;
                    // Exclude vehicle and drone modifications
                    allMods = allMods.filter(mod => mod.system?.type !== 'vehicle' && mod.system?.type !== 'drone');
                }

                // --- Item Selector Context ---
                partialContext.itemsByType = itemsByType;
                if (!this.selectedKey || !itemsByType[this.selectedKey]) {
                    if (this.tabGroups.main === "vehicle") {
                        this.selectedKey = "vehicles";
                    } else if (itemsByType.rangedWeapons && itemsByType.rangedWeapons.items.length > 0) {
                        this.selectedKey = "rangedWeapons";
                    } else {
                        this.selectedKey = Object.keys(itemsByType).find(k => itemsByType[k]?.items?.length > 0) || null;
                    }
                }
                partialContext.selectedKey = this.selectedKey;

                let selectedItems = this.selectedKey ? (itemsByType[this.selectedKey]?.items || []) : [];

                // Filter functions using tags and queries
                const filterBySearch = (items, tags = [], query = "") => {
                    const queryTerm = query.trim().toLowerCase();
                    const tagTerms = tags.map(t => t.trim().toLowerCase());
                    if (!queryTerm && tagTerms.length === 0) return items;
                    return items.filter(item => {
                        const name = (item.name || "").trim().toLowerCase();
                        const matchesQuery = !queryTerm || name.includes(queryTerm);
                        const matchesTags = tagTerms.every(tag => name.includes(tag));
                        return matchesQuery && matchesTags;
                    });
                };

                // Apply search filters
                if (this.tabGroups.main === "vehicle") {
                    selectedItems = VehicleSearchService.filter(selectedItems, this.itemSearchTags, this.itemSearchQuery);
                } else {
                    selectedItems = filterBySearch(selectedItems, this.itemSearchTags, this.itemSearchQuery);
                }
                allMods = filterBySearch(allMods, this.modSearchTags, this.modSearchQuery);

                partialContext.selectedItems = selectedItems;

                // --- Logic for when a Base Item IS Selected ---
                if (builderData.baseItem) {
                    const baseItemType = builderData.baseItem.type;
                    const isDrone = builderData.baseItem.system?.isDrone || builderData.baseItem.system?.isdrone || false;

                    partialContext.isWeapon = ['rangedWeapon', 'meleeWeapon', 'weapon'].includes(baseItemType);

                    const weaponTypes = ['rangedWeapon', 'meleeWeapon', 'weapon'];

                    const specificMods = [];
                    const generalMods = [];
                    const specificModTypes = ['weapon', 'armor', 'vehicle', 'drone'];

                    for (const mod of allMods) {
                        const modType = mod.system?.type;

                        if (specificModTypes.includes(modType)) {
                            // Map mods specifically: weapon mods for weapons, armor for armor, vehicle for vehicle, drone for drone
                            if ((modType === 'weapon' && weaponTypes.includes(baseItemType)) ||
                                (modType === 'armor' && baseItemType === 'armor') ||
                                (modType === 'vehicle' && baseItemType === 'vehicle') ||
                                (modType === 'drone' && isDrone)) {
                                specificMods.push(mod);
                            }
                        } else {
                            generalMods.push(mod);
                        }
                    }

                    specificMods.sort((a, b) => (a.system?.mount_point || '').localeCompare(b.system?.mount_point || ''));

                    partialContext.categorizedMods = {
                        specific: {
                            label: weaponTypes.includes(baseItemType) ? 'Weapon Modifications' :
                                (baseItemType === 'armor' ? 'Armor Modifications' : 'Vehicle Modifications'),
                            items: specificMods
                        },
                        general: {
                            label: "General Modifications",
                            items: generalMods
                        }
                    };

                } else {
                    // --- Logic for when NO Base Item is Selected ---
                    // Show the entire master list, uncategorized
                    partialContext.mods = allMods;
                }

                tabContent = await render("modules/sr5-marketplace/templates/apps/itemBuilder/partials/Builder.html", partialContext);
                console.log("Marketplace Builder | Builder/Vehicle Tab Context:", partialContext);
                break;
        }

        const builderContext = {
            title: builderData.title || "Select a Base Item",
            itemTypeImage: builderData.itemTypeImage || "icons/svg/item-bag.svg"
        };

        return {
            tabContent,
            purchasingActor: this.purchasingActor,
            builder: builderContext,
            activeTab: this.tabGroups.main,
            workshopActorUuid: this.workshopActorUuid
        };
    }


    // --- Static Helpers ---

    static _getThemeFromSetting() {
        const uiConfig = game.settings.get("core", "uiConfig");
        const themeValue = uiConfig?.colorScheme.applications || "light";
        return `theme-${themeValue}`;
    }

    // --- Event Listeners (Bound in _onRender) ---

    async onChangeCategory(event) {
        this.selectedKey = event.currentTarget.value;
        this.itemSearchService?.clearAllFilters(); // Clear search when changing category
        await this.render();
    }

    // --- Action Handlers (from DEFAULT_OPTIONS) ---

    static async #onSelectCategory(event, target) {
        const category = target.dataset.category;
        if (category) {
            this.selectedKey = category;
            this.itemSearchService?.clearAllFilters(); // Clear search when changing category
            this.render();
        }
    }

    static #onChangeTab(event, target) {
        const tabId = target.dataset.tab;
        if (this.tabGroups.main !== tabId) {
            this.tabGroups.main = tabId;
            this.render();
        }
    }

    static #onClickItemName(event, target) {
        const itemUuid = target.dataset.itemUuid;
        if (itemUuid) new ItemPreviewApp(itemUuid).render(true);
    }


    /**
     * Handles selecting a base item from the sidebar.
     * It saves the selected item to the state flag, loads any linked items,
     * and triggers a re-render.
     * @private
     */
    static async #onSelectBaseItem(event, target) {
        const itemUuid = target.dataset.itemUuid;
        if (!itemUuid) return;

        // 1. Fetch the full item document from its UUID.
        const item = await fromUuid(itemUuid);
        if (!item) {
            return ui.notifications.warn("Could not find the selected item.");
        }

        // 2. Prepare the clean data for the base item
        const cleanItemData = {
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            type: item.type,
            system: item.system,
            technology: item.technology,
            effects: item.effects?.map(e => e.toObject(false)) ?? []
        };

        // 3. Set the base item. This clears the builder state (which is what we want).
        await BuilderStateService.setBaseItem(cleanItemData);

        // --- 4. NEW: Check for and load linked items ---
        const linkedItems = item.getFlag("sr5-marketplace", "linkedItems");

        if (linkedItems && Array.isArray(linkedItems) && linkedItems.length > 0) {
            // If we have links, load them one by one into the state
            for (const link of linkedItems) {
                const { slotId, uuid } = link;
                if (!slotId || !uuid) continue;

                const linkedItem = await fromUuid(uuid);
                if (linkedItem) {
                    // Prepare the item data just as _onDrop would
                    const linkedItemData = {
                        uuid: linkedItem.uuid,
                        name: linkedItem.name,
                        img: linkedItem.img,
                        type: linkedItem.type,
                        system: linkedItem.system,
                        effects: linkedItem.effects?.map(e => e.toObject(false)) ?? []
                    };
                    // Add this item to the correct slot in the state
                    await BuilderStateService.addChange(slotId, linkedItemData);
                } else {
                    console.warn(`Marketplace Builder | Could not find linked item with UUID: ${uuid}`);
                }
            }
        }

        // 5. Re-render the application.
        // The UI will now show the base item AND any linked items in their slots.
        this.render();
    }

    /**
     * 
     * @param {*} event click
     * @param {*} target The selected button with the data-effect-uuid
     * @returns 
     */
    static async #onEditEffects(event, target) {
        const uuid = target.dataset.uuid;
        if (!uuid) return;
        let effects = await BuilderStateService.getEffectFromItemUuid(uuid)
        return effects
    }

    /**
     * Handles clicking the delete icon on a mod slot to remove the item.
     * @private
     */
    static async #onRemoveChange(event, target) {
        const slotId = target.closest(".mod-slot")?.dataset.slotId;
        if (!slotId) return;

        // 1. Tell the service to update the persistent flag.
        //    The 'await' ensures this operation completes before we proceed.
        await BuilderStateService.removeChange(slotId);

        // 2. Trigger a re-render. 
        //    The _prepareContext method will now run again and fetch the new state from the flag.
        this.render();
    }

    /**
     * Toggles the base item edit mode.
     * When finishing an edit (clicking 'check'), it gathers all input values
     * from the .item-stats-display block and saves them to baseItemOverrides.
     * @private
     */
    static async #onToggleBaseItemEdit(event, target) {
        const state = await BuilderStateService.getState();

        if (state.isEditingBaseItem) {
            // We are CLICKING THE CHECKMARK (finishing the edit)
            // 1. Find all inputs within the stats display
            const statsContainer = this.element.querySelector(".item-stats-display");
            if (statsContainer) {
                const inputs = statsContainer.querySelectorAll('input[name], textarea[name]');
                const updateData = {};

                // 2. Build the update object from all input values
                inputs.forEach(input => {
                    updateData[input.name] = input.value;
                });

                // 3. Save all overrides in one go
                // We await this to ensure it's saved before we toggle
                await BuilderStateService.updateBaseItemOverrides(updateData);
            }
        }

        // 4. Toggle the edit state (for both starting and finishing)
        const newState = await BuilderStateService.toggleBaseItemEdit();

        // 5. Re-render
        this.render(false, { builderData: newState });
    }

    /**
     * Opens a FilePicker to select a new image for the base item.
     * This saves immediately to give the user instant feedback.
     * @private
     */
    static #onSelectBaseItemImage(event, target) {
        new foundry.applications.apps.FilePicker.implementation({
            type: "image",
            current: target.src,
            callback: (path) => {
                // We update the override immediately for the image
                BuilderStateService.updateBaseItemOverrides({ "img": path }).then(async () => {
                    // Re-render to show the new image right away
                    // We need to fetch the state again to pass it to render
                    const newState = await BuilderStateService.getState();
                    this.render(false, { builderData: newState });
                });
            }
        }).browse();
    }

    /**
     * 
     * @param {*} event 
     * @param {*} target 
     * @returns 
     */
    /**
     * Compiles the complete build data payload (Item or Actor) from the current state.
     * @param {object} state - The current builder state.
     * @returns {object} The compiled item or actor payload.
     * @private
     */
    static _prepareBuildData(state) {
        if (!state.baseItem) return null;

        // 1. Clone base item
        const baseItemData = foundry.utils.deepClone(state.baseItem);
        foundry.utils.mergeObject(baseItemData, state.baseItemOverrides);
        const baseItemName = baseItemData.name;

        // 2. Determine if it is a vehicle (Actor) or regular Item
        const isVehicle = baseItemData.type === "vehicle";

        // A. Start with base item's effects
        const allEffects = [...(baseItemData.effects || [])];

        // B. Add all custom-created effects
        if (state.modifications && state.modifications.length > 0) {
            allEffects.push(...foundry.utils.deepClone(state.modifications));
        }

        const linkedItemsFlag = [];
        const descriptionModList = [];
        const descriptionLinkList = [];
        const embeddedItemsToCreate = []; // for vehicles/drones

        // C. Loop through every single item in a slot
        for (const [slotId, item] of Object.entries(state.changes)) {
            // MERGE EFFECTS from slotted items
            if (item.effects && item.effects.length > 0) {
                allEffects.push(...foundry.utils.deepClone(item.effects));
            }

            if (isVehicle) {
                // For vehicles, slotted modifications/items go to embedded items
                embeddedItemsToCreate.push(foundry.utils.deepClone(item));
                descriptionModList.push(`<li>${item.name}</li>`);
            } else {
                // For standard items: CHECK IF ITEM SHOULD BE "LINKED" vs. "CONSUMED"
                if (item.type === 'modification' || item.type === 'ammo') {
                    // "Consumed" Mod/Ammo
                    descriptionModList.push(`<li>${item.name}</li>`);
                } else {
                    // "Linkable Item"
                    linkedItemsFlag.push({
                        uuid: item.uuid,
                        slotId: slotId
                    });
                    descriptionLinkList.push(`<b>@UUID[${item.uuid}]</b>`);
                }
            }
        }

        // D. Finalize effects
        baseItemData.effects = allEffects.map(effect => {
            const cleanEffect = { ...effect };
            if (cleanEffect.changes) {
                cleanEffect.changes = BuilderStateService._changesToArray(cleanEffect.changes);
            }
            return cleanEffect;
        });

        // E. Update name
        // (Do not append anything to the name automatically)

        // F. Update description
        let description = "";
        if (isVehicle) {
            description = baseItemData.system?.description || "";
            if (descriptionModList.length > 0) {
                description += `<hr><p><b>Installed Modifications:</b><ul>${descriptionModList.join('')}</ul></p>`;
            }
            if (baseItemData.system) {
                baseItemData.system.description = description;
            }
        } else {
            description = baseItemData.system?.description?.value || "";
            if (descriptionModList.length > 0) {
                description += `<hr><p><b>Embedded Modifications:</b><ul>${descriptionModList.join('')}</ul></p>`;
            }
            if (descriptionLinkList.length > 0) {
                description += `<hr><p><b>Linked Items: </b>${descriptionLinkList.join(' ')}</p>`;
            }
            if (baseItemData.system?.description) {
                baseItemData.system.description.value = description;
            }
        }

        // G. Update flags
        if (!isVehicle) {
            if (!baseItemData.flags) baseItemData.flags = {};
            baseItemData.flags['sr5-marketplace'] = {
                ...baseItemData.flags['sr5-marketplace'],
                linkedItems: linkedItemsFlag
            };
        } else {
            // For vehicles, append embedded items
            baseItemData.items = [
                ...(baseItemData.items || []),
                ...embeddedItemsToCreate
            ];
        }

        return baseItemData;
    }

    /**
     * Handles building the item and physical document creation.
     */
    static async #onBuildItem(event, target) {
        const state = await BuilderStateService.getState();
        if (!state.baseItem) {
            ui.notifications.warn("Please select a base item before building.");
            return;
        }

        const buildData = ItemBuilderApp._prepareBuildData(state);

        if (buildData.type === "vehicle") {
            // Send socket event to GM client to create actor and grant ownership
            game.socket.emit(`module.sr5-marketplace`, {
                action: "create_actor",
                actorData: buildData,
                userId: game.user.id
            });
            ui.notifications.info(`Request sent to GM to create vehicle "${buildData.name}".`);
        } else {
            console.log("Marketplace Builder | Creating new item in World:", buildData);
            try {
                const createdItem = await Item.create(buildData);
                if (createdItem) {
                    ui.notifications.info(`Item "${createdItem.name}" was successfully created in the World directory.`);
                }
            } catch (err) {
                console.error("Marketplace Builder | Failed to create item in world:", err);
                ui.notifications.error("Failed to create the item in the World directory.");
            }
        }
    }

    /**
     * Triggers the custom extended build test.
     */
    static async #onStartBuildTest(event, target) {
        const state = await BuilderStateService.getState();
        if (!state.baseItem) {
            ui.notifications.warn("Please select a base item before performing a build test.");
            return;
        }

        const buildData = ItemBuilderApp._prepareBuildData(state);

        // Determine default skill to use
        let defaultSkill = "AutomotiveMechanic";
        if (buildData.type === "vehicle") {
            const vehicleType = buildData.system?.vehicleType || "";
            if (vehicleType === "air" || vehicleType === "aerospace" || vehicleType === "exotic") {
                defaultSkill = "AeronauticsMechanic";
            } else if (vehicleType === "water") {
                defaultSkill = "NauticalMechanic";
            } else if (vehicleType === "ground" || vehicleType === "walker") {
                defaultSkill = "AutomotiveMechanic";
            } else {
                // Fallback to legacy categories check
                const isDrone = buildData.system?.isDrone || buildData.system?.isdrone || false;
                const category = isDrone
                    ? (buildData.importFlags?.category?.toLowerCase() || "")
                    : (buildData.system?.category?.toLowerCase() || "");
                if (category.includes("rotorcraft") || category.includes("aircraft") || category.includes("aeronautics")) {
                    defaultSkill = "AeronauticsMechanic";
                } else if (category.includes("nautical") || category.includes("watercraft")) {
                    defaultSkill = "NauticalMechanic";
                } else {
                    defaultSkill = "AutomotiveMechanic";
                }
            }
        } else {
            // Check changes slots to determine skill
            const changes = state.changes || {};
            const slotsWithItems = Object.keys(changes).filter(slotId => changes[slotId]);
            const hasTopBoxMod = slotsWithItems.some(slotId =>
                ["topLeft", "bottomLeft", "topRight", "middleRight", "bottomRight"].includes(slotId)
            );
            const hasBottomSlotMod = slotsWithItems.some(slotId =>
                ["bottomSlot1", "bottomSlot2", "bottomSlot3", "bottomSlot4"].includes(slotId)
            );

            if (hasBottomSlotMod) {
                defaultSkill = "Hardware";
            } else if (hasTopBoxMod) {
                defaultSkill = "Armorer";
            } else {
                // Fallback based on item type
                if (buildData.type === "weapon") {
                    defaultSkill = "Armorer";
                } else {
                    defaultSkill = "IndustrialMechanic";
                }
            }
        }

        // Determine threshold. Default is twice the item's rating, or fallback to 12.
        const rating = Number(buildData.system?.rating || buildData.system?.technology?.rating || 6);
        const threshold = rating > 0 ? rating * 2 : 12;

        const actor = await ActorSelectionService.getSelectedActor();
        if (!actor) {
            ui.notifications.warn("Please select a character/actor to perform the test.");
            return;
        }

        const logicVal = actor.system?.attributes?.logic?.value ?? 0;
        const initialModifiers = [];
        if (logicVal > 0 && logicVal < 5) {
            const penaltyVal = -(5 - logicVal);
            initialModifiers.push({
                label: "SR5Marketplace.ItemBuilder.LogicMemoryPenalty",
                value: penaltyVal
            });
        }

        const initialData = {
            testType: "BuildTest",
            actorUuid: actor.uuid,
            buildData,
            threshold,
            skill: defaultSkill,
            attribute: "logic",
            appliedModifiers: initialModifiers
        };

        // Close any existing build test dialogs
        const buildTestApp = Object.values(ui.windows).find(w => w.constructor.name === "BuildTestApp");
        if (buildTestApp) {
            buildTestApp.close();
        }

        this.activeDialogId = await AppTestFlagService.createTest(initialData);
        
        console.log("SR5 Marketplace | Starting item build test...");
        await new Promise((resolve) => {
            BuildTestApp._resolve = resolve;
            new BuildTestApp().render(true);
        });
        console.log("SR5 Marketplace | Item build test resolved. Re-rendering ItemBuilderApp.");
        this.render(true);
    }

    /**
     * Adds the compiled build data to the active shopping cart.
     */
    static async #onAddToCart(event, target) {
        const state = await BuilderStateService.getState();
        if (!state.baseItem) {
            ui.notifications.warn("Please select a base item before adding to cart.");
            return;
        }

        const actor = await ActorSelectionService.getSelectedActor();
        if (!actor) {
            ui.notifications.warn("Please select a character/actor to shop on behalf of.");
            return;
        }

        const buildData = ItemBuilderApp._prepareBuildData(state);

        // Pre-calculate totals for the custom item
        const baseItem = state.baseItem;
        const isVehicle = baseItem.type === "vehicle";

        let totalCost = 0;
        if (isVehicle) {
            totalCost = typeof baseItem.system.cost === "object" ? (baseItem.system.cost.value ?? 0) : (baseItem.system.cost ?? 0);
        } else {
            totalCost = typeof baseItem.system.technology?.cost === "object" ? (baseItem.system.technology?.cost.value ?? 0) : (baseItem.system.technology?.cost ?? 0);
        }

        let allAvails = [];
        let baseAvail = "0";
        if (isVehicle) {
            baseAvail = typeof baseItem.system.availability === "object" ? (baseItem.system.availability.value ?? "0") : (baseItem.system.availability ?? "0");
        } else {
            baseAvail = typeof baseItem.system.technology?.availability === "object" ? (baseItem.system.technology?.availability.value ?? "0") : (baseItem.system.technology?.availability ?? "0");
        }
        allAvails.push(baseAvail);

        let totalEssence = isVehicle ? 0 : (baseItem.system.essence || 0);

        // Sum up modifications
        for (const mod of Object.values(state.changes)) {
            let modCost = typeof mod.system.technology?.cost === "object" ? (mod.system.technology?.cost.value ?? 0) : (mod.system.technology?.cost ?? 0);
            if (modCost === undefined || modCost === null || modCost === 0) {
                modCost = typeof mod.system.cost === "object" ? (mod.system.cost.value ?? 0) : (mod.system.cost ?? 0);
            }
            totalCost += Number(modCost) || 0;

            let modAvail = typeof mod.system.technology?.availability === "object" ? (mod.system.technology?.availability.value ?? "0") : (mod.system.technology?.availability ?? "0");
            if (modAvail === undefined || modAvail === null || modAvail === "0") {
                modAvail = typeof mod.system.availability === "object" ? (mod.system.availability.value ?? "0") : (mod.system.availability ?? "0");
            }
            allAvails.push(modAvail);

            let modEssence = mod.system.essence || 0;
            totalEssence += Number(modEssence) || 0;
        }

        const basketService = new BasketService();
        const combinedAvailability = basketService._combineAvailabilities(allAvails);

        const totals = {
            cost: totalCost,
            availability: combinedAvailability,
            essence: totalEssence
        };

        // Add custom item/actor to cart
        await basketService.addCustomToBasket(buildData, actor.uuid, totals);
    }

    /**
     * Handles clearing the entire builder state and re-rendering to the blank slate.
     * @private
     */
    static async #onClearBuild(event, target) {
        await BuilderStateService.clearState();
        await AppTestFlagService.deleteState(game.user.id);

        const buildTestApp = Object.values(ui.windows).find(w => w.constructor.name === "BuildTestApp");
        if (buildTestApp) {
            buildTestApp.close();
        }

        this.tabGroups.main = "builder"; // Ensure we are on the builder tab
        this.render();
    }

    // --- Action Handlers for Effects Tab ---
    static async #onCreateEffect(event, target) {
        const sourceUuid = target.dataset.sourceUuid;
        if (!sourceUuid) return;

        ItemBuilderApp.#handleStateUpdate(this, "#onCreateEffect", () => {
            return BuilderStateService.startEffectCreation(sourceUuid);
        });
    }

    /**
     * Handles updates from individual form fields, like a button click or input change.
     * This is more efficient than reading the entire form for every small change.
     * @private
     */
    static async #onUpdateDraftField(event, target) {
        let { name, value } = target;
        if (!name) return;
        if (name.endsWith(".mode")) value = Number(value);

        ItemBuilderApp.#handleStateUpdate(this, "#onUpdateDraftField", () => {
            const updates = foundry.utils.expandObject({ [name]: value });
            return BuilderStateService.updateDraftEffect(updates);
        });
    }

    static async #onSelectDraftKey(event, target) {
        const key = target.dataset.path;

        ItemBuilderApp.#handleStateUpdate(this, "#onSelectDraftKey", () => {
            const updates = foundry.utils.expandObject({ "changes.0.key": key });
            return BuilderStateService.updateDraftEffect(updates);
        });
    }

    /**
     * Handles selecting the 'applyTo' type for the effect.
     * It now correctly saves the value to the 'system.applyTo' property.
     * @private
     */
    static async #onSetEffectTargetType(event, target) {
        const targetType = target.dataset.targetType;

        ItemBuilderApp.#handleStateUpdate(this, "#onSetEffectTargetType", () => {
            const updates = { system: { applyTo: targetType } };
            return BuilderStateService.updateDraftEffect(updates);
        });
    }


    static async #onSaveDraftEffect(event, target) {
        const form = target.closest("form");
        if (!form) return;

        ItemBuilderApp.#handleStateUpdate(this, "#onSaveDraftEffect", async () => {
            const updates = new foundry.applications.ux.FormDataExtended(form).object;
            await BuilderStateService.updateDraftEffect(updates);
            // The final state is the result of the save operation
            return BuilderStateService.saveDraftEffect();
        });
    }

    static async #onCancelDraftEffect(event, target) {
        ItemBuilderApp.#handleStateUpdate(this, "#onCancelDraftEffect", () => {
            return BuilderStateService.cancelEffectCreation();
        });
    }

    static async #onEditEffect(event, target) {
        const { sourceUuid, effectId } = target.dataset;
        ItemBuilderApp.#handleStateUpdate(this, "#onEditEffect", () => {
            return BuilderStateService.startEffectEdit(sourceUuid, effectId);
        });
    }

    static async #onDeleteEffect(event, target) {
        const { effectId } = target.dataset;
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("SR5.DeleteConfirmation"),
            content: `<p>${game.i18n.localize("SR5.SureToDelete")} <b>${game.i18n.localize("SR5.Modification")}</b>?</p>`
        });
        if (confirmed) {
            ItemBuilderApp.#handleStateUpdate(this, "#onDeleteEffect", () => {
                return BuilderStateService.deleteEffect(effectId);
            });
        }
    }

    /**
     * Toggles the visibility of the multi-select dropdown menu.
     * When opened, it attaches a single-use listener to the window to handle closing.
     * @private
     */
    static #onToggleMultiSelectDropdown(event, target) {
        event.stopPropagation();
        const container = target.closest(".multi-select-container");
        if (!container) return;

        // Close any other dropdown that might be open
        if (this.activeDropdown && this.activeDropdown !== container) {
            this.activeDropdown.querySelector(".dropdown-content")?.classList.remove("show");
            this.activeDropdown.querySelector(".tags-input")?.classList.remove("active");
        }

        // Toggle the current dropdown
        const dropdown = container.querySelector(".dropdown-content");
        const tagsInput = container.querySelector(".tags-input");
        const isNowVisible = dropdown.classList.toggle("show");
        tagsInput.classList.toggle("active", isNowVisible);
        this.activeDropdown = isNowVisible ? container : null;

        if (isNowVisible) {
            // Focus the input so the user can type to filter
            container.querySelector(".multi-select__input").focus();

            // This is the "second click" listener you suggested.
            // It listens for the next single click anywhere on the page.
            const closeListener = (closeEvent) => {
                // The click on an option is handled by its own action, which triggers a re-render.
                // This listener just handles closing the dropdown visually.
                if (this.activeDropdown) {
                    this.activeDropdown.querySelector(".dropdown-content")?.classList.remove("show");
                    this.activeDropdown.querySelector(".tags-input")?.classList.remove("active");
                    this.activeDropdown = null;
                }
            };

            // Attach the listener. The { once: true } option is key:
            // it automatically removes the listener after it fires once.
            window.addEventListener('click', closeListener, { once: true });
        }
    }

    // Add this method to the end of the ItemBuilderApp class

    /**
     * Adds or removes a value from a multi-select field, updates the state,
     * and triggers a re-render, following the established update pattern.
     * @private
     */
    static async #onUpdateMultiSelect(event, target) {
        const container = target.closest(".multi-select-container");
        const { name } = container.dataset;
        const { value: id, mode } = target.dataset;
        if (!name || !id || !mode) return;

        ItemBuilderApp.#handleStateUpdate(this, "#onUpdateMultiSelect", (oldState) => {
            const draft = oldState.draftEffect;
            if (!draft) return oldState;

            let currentObjects = foundry.utils.getProperty(draft, name) || [];
            if (!Array.isArray(currentObjects)) currentObjects = [];

            if (mode === 'add') {
                if (!currentObjects.some(o => o.id === id)) {
                    const label = target.textContent.trim();
                    currentObjects.push({ id, value: label });
                }
            } else if (mode === 'remove') {
                currentObjects = currentObjects.filter(o => o.id !== id);
            }

            const updates = foundry.utils.expandObject({ [name]: currentObjects });
            return BuilderStateService.updateDraftEffect(updates);
        });
    }

    /**
     * Toggles the visibility of the derived value selection panel.
     * @private
     */
    static async #onToggleDerivedValueSelector(event, target) {
        ItemBuilderApp.#handleStateUpdate(this, "#onToggleDerivedValueSelector", () => {
            return BuilderStateService.toggleDerivedValueSelector();
        });
    }

    /**
     * Sets the Effect Value input to a derived path (e.g., @system.rating).
     * @private
     */
    static async #onSelectDerivedValue(event, target) {
        const path = target.dataset.path;
        if (!path) return;

        // Call the helper, which will now use our new service method
        ItemBuilderApp.#handleStateUpdate(this, "#onSelectDerivedValue", () => {
            // Define the update for the nested draftEffect object
            const draftUpdate = {
                changes: { "0": { value: `@${path}` } }
            };

            // Define the update for the top-level state object
            const stateUpdate = {
                isDerivedValueSelectorVisible: false
            };

            // Call the new service method that handles both updates correctly
            return BuilderStateService.updateDraftAndState(draftUpdate, stateUpdate);
        });
    }

    /**
     * A helper to manage the common pattern of updating state and re-rendering with scroll preservation.
     * @param {ItemBuilderApp} app - The application instance (`this`).
     * @param {string} handlerName - The name of the calling function for logging purposes.
     * @param {Function} stateChangeFn - An async function that performs the state update and returns the new state.
     * @private
     */
    static async #handleStateUpdate(app, handlerName, stateChangeFn) {
        const scrollable = app.element.querySelector(".effect-creator-steps");
        const scrollTop = scrollable ? scrollable.scrollTop : 0;

        const oldState = await BuilderStateService.getState();
        console.log(`Marketplace Builder | draftEffect BEFORE ${handlerName}:`, foundry.utils.deepClone(oldState.draftEffect));

        const newState = await stateChangeFn(oldState);

        console.log(`Marketplace Builder | State AFTER ${handlerName}:`, foundry.utils.deepClone(newState));

        // Use the passed-in application instance to render
        await app.render(false, { builderData: newState });

        const newScrollable = app.element.querySelector(".effect-creator-steps");
        if (newScrollable) newScrollable.scrollTop = scrollTop;
    }

    /**
     * Handles the mouse entering an item card to show a preview tooltip.
     * @param {MouseEvent} event - The mouseenter event.
     * @private
     */
    #onItemHoverIn(event) {
        const card = event.currentTarget;
        const uuid = card.dataset.itemUuid;
        if (!uuid) return;

        // Read the delay from the element's data attribute, with a 500ms fallback.
        const delay = parseInt(card.dataset.hoverDelay) || 500;

        // Start a timer to show the tooltip after the specified delay
        this.hoverTimeout = setTimeout(() => {
            const rect = card.getBoundingClientRect();

            const tooltipWidth = 500;
            const tooltipHeight = 320;
            const margin = 5;

            // Calculate vertical position (above card if there is space, otherwise below)
            let topPos;
            if (rect.top >= tooltipHeight + margin) {
                // Space above card
                topPos = rect.top - tooltipHeight - margin;
            } else {
                // Not enough space above, show below the card
                topPos = rect.bottom + margin;

                // If it overflows the bottom of the screen, clamp it
                if (topPos + tooltipHeight > window.innerHeight) {
                    topPos = Math.max(margin, window.innerHeight - tooltipHeight - margin);
                }
            }

            // Calculate horizontal position (prevent overflowing right/left boundaries)
            let leftPos = rect.left;
            if (leftPos + tooltipWidth > window.innerWidth) {
                leftPos = Math.max(margin, window.innerWidth - tooltipWidth - margin);
            }

            this.tooltipApp = new ItemPreviewApp(uuid, {
                id: "ItemPreview-tooltip",
                window: { frame: true },
                classes: ["item-preview-tooltip"],
                position: {
                    top: topPos,
                    left: leftPos,
                    width: tooltipWidth,
                    height: tooltipHeight
                }
            });
            this.tooltipApp.render(true);

        }, delay); // 500ms delay
    }

    /**
     * Handles the mouse leaving an item card to hide the preview tooltip.
     * @param {MouseEvent} event - The mouseleave event.
     * @private
     */
    #onItemHoverOut(event) {
        // Clear any pending tooltip from showing up
        clearTimeout(this.hoverTimeout);

        // If a tooltip app exists, close and destroy it
        if (this.tooltipApp) {
            this.tooltipApp.close();
            this.tooltipApp = null;
        }
    }

    /**
     * Create drag-and-drop workflow handlers for this Application.
     * @returns {DragDrop[]} An array of DragDrop handlers.
     * @private
     */
    #createDragDropHandlers() {
        return this.options.dragDrop.map(d => {
            d.callbacks = {
                dragstart: this._onDragStart.bind(this),
                dragenter: this._onDragEnter.bind(this),
                dragleave: this._onDragLeave.bind(this),
                dragend: this._onDragEnd.bind(this),
                drop: this._onDrop.bind(this)
            };
            return new foundry.applications.ux.DragDrop.implementation(d);
        });
    }

    /**
     * The array of DragDrop instances.
     * @type {DragDrop[]}
     * @private
     */
    #dragDrop = this.#createDragDropHandlers();


    static async #onSelectVehicleActor(event, target) {
        const uuid = target.dataset.uuid;
        if (uuid) {
            this.selectedVehicleActorUuid = uuid;
            this.render();
        }
    }

    static async #onDeselectVehicleActor(event, target) {
        this.selectedVehicleActorUuid = null;
        this.render();
    }

    static async #onRunWorkshopRepair(event, target) {
        if (!this.selectedVehicleActorUuid) return;
        const vehicleActor = await fromUuid(this.selectedVehicleActorUuid);
        if (!vehicleActor) return;

        const pTrack = vehicleActor.system.track?.physical || vehicleActor.system.physical_track || {};
        const damage = pTrack.value ?? 0;
        if (damage <= 0) {
            ui.notifications.info(game.i18n.localize("SR5Marketplace.ItemBuilder.NoDamageToRepair"));
            return;
        }

        const threshold = damage * 3;

        // Close any existing build test dialogs
        const buildTestApp = Object.values(ui.windows).find(w => w.constructor.name === "BuildTestApp");
        if (buildTestApp) {
            buildTestApp.close();
        }

        const workshop = await fromUuid(this.workshopActorUuid);

        console.log("SR5 Marketplace | Starting workshop repair build test...");
        const runResult = await game.shadowrun5e.tests.BuildTest.run(vehicleActor.uuid, {
            isRepair: true,
            threshold: threshold,
            vehicle: vehicleActor,
            workshop: workshop
        });
        console.log("SR5 Marketplace | Repair dialog closed/resolved. Result:", runResult);

        if (this.selectedVehicleActorUuid) {
            const freshVehicleDoc = await fromUuid(this.selectedVehicleActorUuid);
            const freshVehicle = freshVehicleDoc instanceof Actor ? freshVehicleDoc : freshVehicleDoc?.actor || null;
            if (freshVehicle) {
                console.log("SR5 Marketplace | Fresh vehicle actor fetched. Current physical track value:", freshVehicle.system.track?.physical?.value);
            }
        }
        this.render(true);
    }

    static async #onToggleBuiltIn(event, target) {
        const itemUuid = target.dataset.itemUuid;
        if (!itemUuid) return;
        const item = await fromUuid(itemUuid);
        if (!item) return;

        const currentVal = item.getFlag("sr5-marketplace", "isPreinstalled") || false;
        await item.setFlag("sr5-marketplace", "isPreinstalled", !currentVal);

        this.render();
    }

    static async #onClearConditionMonitor(event, target) {
        event.preventDefault();
        if (!this.selectedVehicleActorUuid) return;
        const vehicleDoc = await fromUuid(this.selectedVehicleActorUuid);
        const vehicleActor = vehicleDoc instanceof Actor ? vehicleDoc : vehicleDoc?.actor || null;
        if (!vehicleActor) return;

        const trackId = target.dataset.id;
        if (trackId === "matrix") {
            if (typeof vehicleActor.setMatrixDamage === "function") {
                await vehicleActor.setMatrixDamage(0);
            } else {
                await vehicleActor.update({ "system.matrix.condition_monitor.value": 0 });
            }
            this.render();
        } else if (trackId === "physical") {
            const updatePath = vehicleActor.system.track?.physical ? "system.track.physical.value" : "system.physical_track.value";
            await vehicleActor.update({ [updatePath]: 0 });
            this.render();
        }
    }

    static async #onModifyConditionMonitor(event, target) {
        event.preventDefault();
        if (!this.selectedVehicleActorUuid) return;
        const vehicleDoc = await fromUuid(this.selectedVehicleActorUuid);
        const vehicleActor = vehicleDoc instanceof Actor ? vehicleDoc : vehicleDoc?.actor || null;
        if (!vehicleActor) return;

        const trackId = target.dataset.id;
        if (trackId === "matrix") {
            let value = Number(target.dataset.value);
            const mTrack = vehicleActor.system.matrix?.condition_monitor || {};
            const currentDamage = mTrack.value ?? 0;
            if (currentDamage === value) {
                value = 0;
            }
            if (typeof vehicleActor.setMatrixDamage === "function") {
                await vehicleActor.setMatrixDamage(value);
            } else {
                await vehicleActor.update({ "system.matrix.condition_monitor.value": value });
            }
            this.render();
        } else if (trackId === "physical") {
            let value = Number(target.dataset.value);
            const pTrack = vehicleActor.system.track?.physical || vehicleActor.system.physical_track || {};
            const currentDamage = pTrack.value ?? 0;
            if (currentDamage === value) {
                value = 0;
            }
            const updatePath = vehicleActor.system.track?.physical ? "system.track.physical.value" : "system.physical_track.value";
            await vehicleActor.update({ [updatePath]: value });
            this.render();
        }
    }

    static async #onRollConditionMonitor(event, target) {
        event.preventDefault();
    }
}