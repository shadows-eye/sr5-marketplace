import { ItemPreviewApp } from "../apps/documents/items/ItemPreviewApp.mjs";
import { SearchService } from '../services/searchTag.mjs';
import { BuilderStateService } from "../services/builderStateService.mjs";
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
        this.purchasingActor = null;
        this.searchService = null;
        // this.builderService = new BuilderService(); // To be added later
        this.builderData = {
            baseItem: null,
            modifications: []
        };
        this.tabGroups = { main: "builder" }; // Default to the 'builder' tab

        // --- Item & Category Selection State ---
        this.selectedKey = null;

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
            position: { width: 1200, height: 800 },
            window: { title: "Item Builder" },
            actions: {
                // Core App Actions
                changeTab: this.#onChangeTab,
                clickItemName: this.#onClickItemName,
                buildItem: this.#onBuildItem,
                // Item & Mod Selection Actions
                selectBaseItem: this.#onSelectBaseItem
                // We will add drag-and-drop handlers later
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

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);
        if (this.tabGroups.main === "builder") {
            this.searchService = new SearchService(this.element);
            this.searchService.initialize();
            
            const categorySelector = this.element.querySelector("#item-type-selector");
            if (categorySelector) {
                categorySelector.addEventListener("change", this.onChangeCategory.bind(this));
            }
        } else {
            this.searchService = null;
        }
    }

    /** @override */
    async _prepareContext(options) {
        // --- THIS IS THE KEY CHANGE (PART 1) ---
        // At the start of every render, get the latest state from the flag.
        const builderData = await BuilderStateService.getState();

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
                tabContent = `<div class="placeholder">Active Effects Configuration will be here.</div>`;
                break;
            case "dialog":
                tabContent = `<div class="placeholder">The final Creation Dialog will be here.</div>`;
                break;
            default: // "builder" tab
                this.tabGroups.main = "builder";
                const itemsByType = this.itemData.itemsByType ?? {};
                
                partialContext.itemsByType = itemsByType;
                if (!this.selectedKey || !itemsByType[this.selectedKey]) {
                    this.selectedKey = Object.keys(itemsByType).find(k => itemsByType[k].items.length > 0) || null;
                }
                partialContext.selectedKey = this.selectedKey;
                partialContext.selectedItems = this.selectedKey ? (itemsByType[this.selectedKey]?.items || []) : [];
                partialContext.mods = itemsByType.itemModifications?.items ?? [];

                // Render the single, all-in-one template for the builder tab.
                tabContent = await render("modules/sr5-marketplace/templates/apps/itemBuilder/partials/builder.html", partialContext);
                break;
        }

        const builderContext = {
            title: this.builderData.baseItem ? `Building: ${this.builderData.baseItem.name}` : "Select a Base Item",
            itemType: { img: "icons/svg/anvil.svg" }
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
        this.searchService?.clearAllFilters(); // Clear search when changing category
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
    
    static #onSelectBaseItem(event, target) {
        ui.notifications.info("TODO: Set this item as the base for building.");
        console.log("Selected Item UUID:", target.dataset.itemUuid);
        // Later this will call: this.builderService.setBaseItem(itemUuid);
    }
    
    static #onBuildItem(event, target) {
        ui.notifications.warn("The Item Builder feature is not yet implemented.");
    }
}