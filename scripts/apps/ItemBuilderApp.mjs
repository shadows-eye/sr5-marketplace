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
        this.itemData = game.sr5marketplace.itemData; // Use the global item data service
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
    }

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "itemBuilder",
            position: { width: 1600, height: 800 },
            window: { title: "Item Builder", resizable: true },
            actions: {
                // Core
                changeTab: this.#onChangeTab,
                clickItemName: this.#onClickItemName,
                buildItem: this.#onBuildItem,
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
                selectDerivedValue: this.#onSelectDerivedValue,
                setEffectTargetType: this.#onSetEffectTargetType,
                selectEffectIcon: this.#onSelectEffectIcon
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

    /** * @override
     * @param {object} context - The context object on render.
     * @param {object} options - The options from the main app passed down.
     */
    _onRender(context, options) {
        super._onRender(context, options);

        // Only initialize services and listeners if the builder tab is active
        if (this.tabGroups.main === "builder") {
            // --- Item Search ---
            this.itemSearchService = new itemSearchService(this.element);
            this.itemSearchService.initialize({
                searchBox: 'input[name="itemSearch"]',
                itemsGrid: '.item-selector-section .item-content-grid',
                nameSelector: ".item-name"
            });
            
            // --- Mod Search ---
            this.modSearchService = new itemSearchService(this.element);
            this.modSearchService.initialize({
                searchBox: 'input[name="modSearch"]',
                itemsGrid: '.mod-selector-section .item-content-grid',
                nameSelector: ".item-name"
            });

            // --- Category Filter ---
            const categorySelector = this.element.querySelector("#item-type-selector");
            if (categorySelector) {
                categorySelector.addEventListener("change", this.onChangeCategory.bind(this));
            }

            // --- Drag and Drop Listeners ---
            
            // 1. Make all item cards in the sidebar draggable
            const draggables = this.element.querySelectorAll('.item-card[draggable="true"]');
            for (const card of draggables) {
                card.addEventListener("dragstart", event => {
                    const data = { uuid: card.dataset.itemUuid };
                    event.dataTransfer.setData("text/plain", JSON.stringify(data));
                });
            }

            // 2. Make the bottom mod slots receptive to drops
            const dropTargets = this.element.querySelectorAll('.bottom-slots .mod-slot');
            for (const slot of dropTargets) {
                slot.addEventListener("dragover", event => {
                    event.preventDefault(); // This is required to allow a drop
                    slot.classList.add("drag-over");
                });

                slot.addEventListener("dragleave", event => {
                    slot.classList.remove("drag-over");
                });
                
                /**
                 * Handle the drop event for an item card onto a mod slot.
                 * @param {DragEvent} event - The drop event.
                 */
                slot.addEventListener("drop", async event => {
                    event.preventDefault();
                    slot.classList.remove("drag-over");

                    const data = JSON.parse(event.dataTransfer.getData("text/plain"));
                    const slotId = slot.dataset.slotId;

                    if (data.uuid && slotId) {
                        // Asynchronously load the full item document from its UUID
                        const item = await fromUuid(data.uuid);
                        if (!item) {
                            console.error("Marketplace Builder | Could not find item from UUID:", data.uuid);
                            return;
                        }

                        // Now that we have the full item, we can build the data object
                        const droppedItemData = {
                            uuid: item.uuid,
                            name: item.name,
                            img: item.img,
                            // Map the effects to plain data objects for storage
                            effects: item.effects.map(e => e.toObject(false))
                        };
                        
                        await BuilderStateService.addChange(slotId, droppedItemData);
                        
                        // Re-render the app to show the new item in the slot
                        this.render();
                    }
                });
            }
        } else {
            // Clean up services if the tab is not active to prevent memory leaks
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
                // 1. Instantiate the NEW specialized builder
                const effectsBuilder = new AppEffectsBuilderDialog();
                // 2. Call the method to get the effects context from the current builderData
                const effectsContext = await effectsBuilder.buildEffectsContext(builderData);
                // 3. Render the new Effects.html template with the context
                foundry.utils.mergeObject(partialContext, effectsContext);

                // Now, render the partial using the complete, unified context.
                tabContent = await render("modules/sr5-marketplace/templates/apps/itemBuilder/partials/Effects.html", partialContext);
                break;
            case "dialog":
                tabContent = `<div class="placeholder">The final Creation Dialog will be here.</div>`;
                break;
            default: // "builder" tab
                this.tabGroups.main = "builder";
                // --- THIS IS THE UPDATE ---
                // Fetch the specific data sets we need for the builder.
                const baseItemsByType = this.itemData.baseItemsByType ?? {};
                const modsByType = this.itemData.modificationsByType ?? {};
                
                // Update context for the item selector (now only shows base items)
                partialContext.itemsByType = baseItemsByType;
                if (!this.selectedKey || !baseItemsByType[this.selectedKey]) {
                    this.selectedKey = Object.keys(baseItemsByType).find(k => baseItemsByType[k].items.length > 0) || null;
                }
                partialContext.selectedKey = this.selectedKey;
                partialContext.selectedItems = this.selectedKey ? (baseItemsByType[this.selectedKey]?.items || []) : [];
                
                // Update context for the mod selector (now shows categorized mods)
                 // Instead of relying on a single key, we'll combine the 'items' array
                // from every category within modsByType (weaponMods, armorMods, etc.).
                // This is a much more robust way to get all modifications.
                partialContext.mods = Object.values(modsByType).flatMap(category => category.items || []);
                
                console.log (partialContext)
                // Render the single, all-in-one template for the builder tab.
                tabContent = await render("modules/sr5-marketplace/templates/apps/itemBuilder/partials/Builder.html", partialContext);
                break;
        }

        const builderContext = {
            title: builderData.title || "Select a Base Item",
            itemTypeImage: builderData.itemTypeImage || "icons/svg/item-bag.svg"
        };

        return { 
            tabContent, // We now pass the single content variable to the main template.
            purchasingActor: this.purchasingActor,
            builder: builderContext
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
     * It saves the selected item to the state flag and triggers a re-render.
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
        const cleanItemData = {
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            type: item.type,
            system: item.system,
            technology: item.technology,
            effects: item.effects?.map(e => e.toObject(false)) ?? []
        };
        await BuilderStateService.setBaseItem(cleanItemData);
        
        // 3. Re-render the application to reflect the new state.
        //    The UI will now switch from the blank placeholder to the builder view.
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
    
    static #onBuildItem(event, target) {
        ui.notifications.warn("The Item Builder feature is not yet implemented.");
    }

    // --- Action Handlers for Effects Tab ---
    static async #onCreateEffect(event, target) {
        const sourceUuid = target.dataset.sourceUuid;
        if (!sourceUuid) return;
        const newState = await BuilderStateService.startEffectCreation(sourceUuid);
        this.render(false, { builderData: newState });
    }
    
    /**
     * Handles updates from individual form fields, like a button click or input change.
     * This is more efficient than reading the entire form for every small change.
     * @private
     */
    static async #onUpdateDraftField(event, target) {
        let { name, value } = target;
        if (!name) return;

        // --- FIX 1: Preserve Scroll Position ---
        const scrollable = this.element.querySelector(".effect-creator-steps");
        const scrollTop = scrollable ? scrollable.scrollTop : 0;

        // --- FIX 2: Correct Data Type ---
        // The 'mode' value from an HTML element is a string, but it needs to be a number.
        if (name.endsWith(".mode")) {
            value = Number(value);
        }

        const updateData = { [name]: value };
        const updates = foundry.utils.expandObject(updateData);
        const newState = await BuilderStateService.updateDraftEffect(updates);

        // Await the render so we can act on the new DOM.
        await this.render(false, { builderData: newState });

        // Restore the scroll position.
        const newScrollable = this.element.querySelector(".effect-creator-steps");
        if (newScrollable) newScrollable.scrollTop = scrollTop;
    }

    static async #onSelectDraftKey(event, target) {
        // Preserve scroll position
        const scrollable = this.element.querySelector(".effect-creator-steps");
        const scrollTop = scrollable ? scrollable.scrollTop : 0;

        const key = target.dataset.path;
        const newState = await BuilderStateService.updateDraftEffect({ changes: [{ key }] });

        // Await the render and then restore scroll
        await this.render(false, { builderData: newState });
        const newScrollable = this.element.querySelector(".effect-creator-steps");
        if (newScrollable) newScrollable.scrollTop = scrollTop;
    }
    
    /**
     * Handles selecting the target type (Actor or Item).
     * It now also preserves scroll position.
     * @private
     */
    static async #onSetEffectTargetType(event, target) {
        // Preserve scroll position
        const scrollable = this.element.querySelector(".effect-creator-steps");
        const scrollTop = scrollable ? scrollable.scrollTop : 0;

        const targetType = target.dataset.targetType;
        const newState = await BuilderStateService.updateDraftEffect({ targetType: targetType });

        // Await the render and then restore scroll
        await this.render(false, { builderData: newState });
        const newScrollable = this.element.querySelector(".effect-creator-steps");
        if (newScrollable) newScrollable.scrollTop = scrollTop;
    }

    static async #onSelectDerivedValue(event, target) {
        const path = target.dataset.path;
        const newState = await BuilderStateService.updateDraftEffect({ changes: [{ value: path, isDerived: true }] });
        this.render(false, { builderData: newState });
    }

    static async #onSaveDraftEffect(event, target) {
        const form = target.closest("form");
        const updates = new FormDataExtended(form).object;
        
        await BuilderStateService.updateDraftEffect(updates);
        const newState = await BuilderStateService.saveDraftEffect();
        this.render(false, { builderData: newState });
    }

    static async #onCancelDraftEffect(event, target) {
        const newState = await BuilderStateService.cancelEffectCreation();
        this.render(false, { builderData: newState });
    }
    
    static async #onEditEffect(event, target) {
        const { sourceUuid, effectId } = target.dataset;
        const newState = await BuilderStateService.startEffectEdit(sourceUuid, effectId);
        this.render(false, { builderData: newState });
    }

    static async #onDeleteEffect(event, target) {
        const { effectId } = target.dataset;
        const confirmed = await Dialog.confirm({ /* ... */ });
        if (confirmed) {
            const newState = await BuilderStateService.deleteEffect(effectId);
            this.render(false, { builderData: newState });
        }
    }
    /**
     * Handles clicking the effect icon to open a FilePicker.
     * @param {Event} event The triggering event.
     * @param {HTMLElement} target The element that was clicked.
     * @private
     */
    static async #onSelectEffectIcon(event, target) {
        // Find the hidden input to get the current value
        const currentIcon = target.querySelector('input[name="img"]')?.value;

        new FilePicker({
            type: "image",
            current: currentIcon,
            callback: async (path) => {
                // When a new file is picked, update the state and re-render
                const newState = await BuilderStateService.updateDraftEffect({ img: path });
                this.render(false, { builderData: newState });
            }
        }).render(true);
    }
}