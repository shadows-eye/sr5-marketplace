import { ItemPreviewApp } from "../apps/documents/items/ItemPreviewApp.mjs";
import { SearchService as itemSearchService } from '../services/searchTag.mjs';
import { BuilderStateService } from "../services/builderStateService.mjs";
import { AppEffectsBuilderDialog } from '../apps/documents/dialog/AppEffectsBuilderDialog.mjs';
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
        this.modSearchService = null;
        // this.builderService = new BuilderService(); // To be added later no builder data needed here
        this.tabGroups = { main: "builder" }; // Default to the 'builder' tab

        // --- Item & Category Selection State ---
        this.selectedKey = Object.keys(this.itemData.itemsByType ?? {}).find(k => this.itemData.itemsByType[k].items.length > 0) || null;

        // Find a default item category to display on first load
        const itemsByType = this.itemData.itemsByType ?? {};
        let defaultKey = null;
        if (itemsByType.rangedWeapons && itemsByType.rangedWeapons.items.length > 0) {
            defaultKey = "rangedWeapons";
        } else {
            const firstAvailableCategory = Object.entries(itemsByType).find(([, data]) => data.items.length > 0);
            if (firstAvailableCategory) {
                defaultKey = firstAvailableCategory[0];
            }
        }
        this.selectedKey = defaultKey;
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
                }
            ],
            actions: {
                // Core
                changeTab: this.#onChangeTab,
                clickItemName: this.#onClickItemName,
                buildItem: this.#onBuildItem,
                clearBuild: this.#onClearBuild,
                toggleBaseItemEdit: this.#onToggleBaseItemEdit,
                selectBaseItemImage: this.#onSelectBaseItemImage,
                // Builder Tab
                selectBaseItem: this.#onSelectBaseItem,
                removeChange: this.#onRemoveChange,
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
                updateMultiSelect: this.#onUpdateMultiSelect
            }
        });
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
            mountPoint: card.dataset.mountPoint
        };
        this.draggedModData = { mountPoint: data.mountPoint };
        event.dataTransfer.setData("text/plain", JSON.stringify(data));

        const override = game.settings.get('sr5-marketplace', 'itemBuilder.ignoreMountRestrictions');
        const allSlots = this.element.querySelectorAll(".mod-slot[data-slot-id]");

        // 1. Determine Drag Type (Mod or Item)
        if (card.closest(".mod-selector-section")) {
            this.draggedItemType = "mod";
            this.draggedModData = { mountPoint: data.mountPoint || "none" };
            const draggedMountPoint = this.draggedModData.mountPoint;

            // 2. Apply visuals for MOD drag
            allSlots.forEach(slot => {
                const targetMountPoint = slot.dataset.mountPoint;
                const isBottomSlot = !!slot.closest(".bottom-slots");

                if (isBottomSlot) {
                    slot.classList.add("initial-invalid"); // Mods can't go in bottom slots
                    return;
                }

                if (override) {
                    slot.classList.add("initial-override");
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
        event.currentTarget.classList.remove("valid-drop", "invalid-drop", "override-drop");
    }

    /**
     * @override
     * Called when a drag operation concludes. This is the master cleanup function.
     */
    _onDragEnd(event) {
        this.draggedModData = null;
        this.draggedItemType = null;
        this.element.classList.remove("dragging-mod");
        
        // Clean up ALL drag-related classes from ALL slots
        this.element.querySelectorAll(".mod-slot[data-slot-id]").forEach(s => {
            s.classList.remove(
                "valid-drop", "invalid-drop", "override-drop",
                "initial-valid", "initial-invalid", "initial-override"
            );
        });
    }

    /**
     * Callback for when a dragged element is dropped on a target.
     * @param {DragEvent} event The originating DragEvent.
     */
    async _onDrop(event) {
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        const slot = event.currentTarget;
        const override = game.settings.get('sr5-marketplace', 'itemBuilder.ignoreMountRestrictions');
        const slotId = slot.dataset.slotId;
        const targetMountPoint = slot.dataset.mountPoint;
        const draggedMountPoint = data.mountPoint || "none";

        if (override || !targetMountPoint || targetMountPoint === draggedMountPoint) {
            const item = await fromUuid(data.uuid);
            if (!item) return;

            // --- THIS IS THE FIX ---
            // Create the complete data object from the fetched item.
            const droppedItemData = {
                uuid: item.uuid,
                name: item.name,
                img: item.img,
                type: item.type,
                system: item.system,
                effects: item.effects.map(e => e.toObject(false))
            };

            // 2. Handle drop based on the drag type set in _onDragStart
            switch (this.draggedItemType) {
                case "mod": {
                    const override = game.settings.get('sr5-marketplace', 'itemBuilder.ignoreMountRestrictions');
                    const targetMountPoint = slot.dataset.mountPoint;
                    const draggedMountPoint = this.draggedModData?.mountPoint || "none";

                    if (override || !targetMountPoint || targetMountPoint === draggedMountPoint) {
                        await BuilderStateService.addChange(slotId, droppedItemData);
                        this.render();
                    } else {
                        ui.notifications.warn("This modification cannot be placed in that slot.");
                    }
                    break;
                }

                case "item": {
                    const isBottomSlot = !!slot.closest(".bottom-slots");
                    if (isBottomSlot) {
                        await BuilderStateService.addChange(slotId, droppedItemData);
                        this.render();
                    } else {
                        // This should be impossible if _onDragStart is correct, but good to have
                        ui.notifications.error("Items can only be placed in the bottom slots.");
                    }
                    break;
                }

                default:
                    console.warn("Marketplace Builder | Unknown drag type ended.");
                    break;
            }
        }
    }

    /** 
     * @override
     * @param {object} context - The context object on render.
     * @param {object} options - The options from the main app passed down.
     */
    _onRender(context, options) {
        super._onRender(context, options);

        // --- BIND DRAG & DROP HANDLERS ---
        this.#dragDrop.forEach(d => d.bind(this.element));

        // --- Logic for the "Builder" Tab ---
        if (this.tabGroups.main === "builder") {
            // Initialize Search Services & Category Selector
            this.itemSearchService = new itemSearchService(this.element);
            this.itemSearchService.initialize({
                searchBox: 'input[name="itemSearch"]',
                itemsGrid: '.item-selector-section .item-content-grid',
                nameSelector: ".item-name"
            });
            this.modSearchService = new itemSearchService(this.element);
            this.modSearchService.initialize({
                searchBox: 'input[name="modSearch"]',
                itemsGrid: '.mod-selector-section .item-content-grid',
                nameSelector: ".item-name"
            });
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
        else {
            this.itemSearchService = null;
            this.modSearchService = null;
        }
    }

    /** @override */
    async _prepareContext(options) {
        // At the start of every render, get the latest state from the flag.
        const builderData = options.builderData ?? await BuilderStateService.getState();

        const selectedActorUuid = game.user.getFlag("sr5-marketplace", "selectedActorUuid");
        this.purchasingActor = selectedActorUuid ? await fromUuid(selectedActorUuid) : (game.user.character || null);
        
        let tabContent = null;
        const render = foundry.applications.handlebars.renderTemplate;
        const partialContext = { 
            purchasingActor: this.purchasingActor,
            hasBaseItem: !!builderData.baseItem, // Use the state we just fetched
            builderData: builderData             // Pass it to the partial
        };

        switch (this.tabGroups.main) {
            case "effects":
                this.tabGroups.main = "effects";
                const effectsBuilder = new AppEffectsBuilderDialog();
                const effectsContext = await effectsBuilder.buildEffectsContext(builderData);
                foundry.utils.mergeObject(partialContext, effectsContext);
                tabContent = await render("modules/sr5-marketplace/templates/apps/itemBuilder/partials/Effects.html", partialContext);
                break;
            default: // "builder" tab
                this.tabGroups.main = "builder";
                let displayItem = null;
                if (builderData.baseItem) {
                    displayItem = foundry.utils.deepClone(builderData.baseItem);
                    // Merge the overrides on top for display
                    foundry.utils.mergeObject(displayItem, builderData.baseItemOverrides);
                }
                partialContext.displayItem = displayItem;
                partialContext.isEditingBaseItem = builderData.isEditingBaseItem;

                const baseItemsByType = this.itemData.baseItemsByType ?? {};
                const modsByType = this.itemData.modificationsByType ?? {};

                // We now use the 'allModifications' key as the single, reliable source for all mods.
                const allMods = modsByType.allModifications?.items || [];

                // --- Item Selector Context ---
                partialContext.itemsByType = baseItemsByType;
                if (!this.selectedKey || !baseItemsByType[this.selectedKey]) {
                    this.selectedKey = Object.keys(baseItemsByType).find(k => baseItemsByType[k].items.length > 0) || null;
                }
                partialContext.selectedKey = this.selectedKey;
                partialContext.selectedItems = this.selectedKey ? (baseItemsByType[this.selectedKey]?.items || []) : [];

                // --- Logic for when a Base Item IS Selected ---
                if (builderData.baseItem) {
                    const baseItemType = builderData.baseItem.type;
                    
                    partialContext.isWeapon = ['rangedWeapon', 'meleeWeapon', 'weapon'].includes(baseItemType);

                    const weaponTypes = ['rangedWeapon', 'meleeWeapon', 'weapon'];

                    const specificMods = [];
                    const generalMods = [];
                    const specificModTypes = ['weapon', 'armor', 'vehicle', 'drone'];

                    for (const mod of allMods) {
                        const modType = mod.system?.type;

                        if (specificModTypes.includes(modType)) {
                            // This condition will now correctly evaluate to TRUE for weapon mods
                            if ((modType === 'weapon' && weaponTypes.includes(baseItemType)) || (modType === 'armor' && baseItemType === 'armor')) {
                                specificMods.push(mod);
                            }
                        } else {
                            generalMods.push(mod);
                        }
                    }

                    specificMods.sort((a, b) => (a.system?.mount_point || '').localeCompare(b.system?.mount_point || ''));

                    partialContext.categorizedMods = {
                        specific: {
                            label: `${baseItemType.includes('weapon') ? 'Weapon' : 'Armor'} Modifications`,
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
                console.log("Marketplace Builder | Builder Tab Context:", partialContext);
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
            activeTab: this.tabGroups.main
        };
    }


    // --- Static Helpers ---

    static _getThemeFromSetting() {
        const uiConfig = game.settings.get("core", "uiConfig");
        const themeValue = uiConfig?.colorScheme.applications;
        return themeValue === "dark" ? "theme-dark" : "theme-light";
    }

    // --- Event Listeners (Bound in _onRender) ---

    async onChangeCategory(event) {
        this.selectedKey = event.currentTarget.value;
        this.itemSearchService?.clearAllFilters(); // Clear search when changing category
        await this.render();
    }

    // --- Action Handlers (from DEFAULT_OPTIONS) ---

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
    static async #onBuildItem(event, target) {
        // 1. Get the current state
        const state = await BuilderStateService.getState();
        if (!state.baseItem) {
            ui.notifications.warn("Please select a base item before building.");
            return;
        }

        // 2. Clone base item to create our new item payload
        const baseItemData = foundry.utils.deepClone(state.baseItem);
        foundry.utils.mergeObject(baseItemData, state.baseItemOverrides);
        const baseItemName = baseItemData.name; // Store name *after* overrides

        // --- 3. Process ALL Effects and Slotted Items ---

        // A. Start with base item's effects
        const allEffects = [...baseItemData.effects];

        // B. Add all custom-created effects (from the 'Effects' tab)
        //    THIS IS THE FIX FOR THE MISSING EFFECTS
        if (state.modifications && state.modifications.length > 0) {
            allEffects.push(...foundry.utils.deepClone(state.modifications));
        }

        const linkedItemsFlag = [];   // For the actor hook
        const descriptionModList = [];    // For "consumed" mods
        const descriptionLinkList = [];   // For "linked" items

        // C. Loop through every single item in a slot
        for (const [slotId, item] of Object.entries(state.changes)) {
            
            // D. MERGE EFFECTS from slotted items
            if (item.effects && item.effects.length > 0) {
                allEffects.push(...foundry.utils.deepClone(item.effects));
            }

            // E. CHECK IF ITEM SHOULD BE "LINKED" vs. "CONSUMED"
            if (item.type === 'modification' || item.type === 'ammo') {
                // "Consumed" Mod/Ammo
                descriptionModList.push(`<li>${item.name}</li>`);
            } else {
                // "Linkable Item"
                linkedItemsFlag.push({ 
                    uuid: item.uuid, 
                    slotId: slotId 
                });
                
                // THIS IS THE NEW DESCRIPTION FORMAT
                descriptionLinkList.push(`<b>@UUID[${item.uuid}]</b>`);
            }
        }

        // --- 4. Finalize the new item data ---

        // A. Set all merged effects
        baseItemData.effects = allEffects;

        // B. Update name
        if (descriptionModList.length > 0) {
            baseItemData.name = `${baseItemName} (Modified)`;
        }

        // C. Update description
        let description = baseItemData.system.description?.value || "";
        if (descriptionModList.length > 0) {
            description += `<hr><p><b>Embedded Modifications:</b><ul>${descriptionModList.join('')}</ul></p>`;
        }
        if (descriptionLinkList.length > 0) {
            // THIS IS THE NEW DESCRIPTION FORMAT
            description += `<hr><p><b>Linked Items: </b>${descriptionLinkList.join(' ')}</p>`;
        }
        baseItemData.system.description.value = description;

        // D. Update flags
        if (!baseItemData.flags) baseItemData.flags = {};
        baseItemData.flags['sr5-marketplace'] = {
            ...baseItemData.flags['sr5-marketplace'],
            linkedItems: linkedItemsFlag 
        };
        
        // --- 5. Log the final single item payload ---
        console.log("Marketplace Builder | Payload for new item (log only):", baseItemData);
        //ui.notifications.info("New item payload logged to console (F12).");
    }

    /**
     * Handles clearing the entire builder state and re-rendering to the blank slate.
     * @private
     */
    static async #onClearBuild(event, target) {
        await BuilderStateService.clearState();
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

            this.tooltipApp = new ItemPreviewApp(uuid, {
                window: { frame: true },
                classes: ["item-preview-tooltip"],
                position: {
                    top: rect.top,
                    left: rect.left,
                    width: 500, 
                    height: 320 // Set a fixed width for consistency

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
}