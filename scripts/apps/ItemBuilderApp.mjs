import { ItemPreviewApp } from "../apps/documents/items/ItemPreviewApp.mjs";
import { SearchService } from '../services/searchTag.mjs';
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

        // Attach search and category listeners only when the builder tab is active
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
        // Get the purchasing actor
        const selectedActorUuid = game.user.getFlag("sr5-marketplace", "selectedActorUuid");
        this.purchasingActor = selectedActorUuid ? await fromUuid(selectedActorUuid) : (game.user.character || null);

        // Define the navigation tabs
        const tabs = [
            { id: "builder", label: "Builder", icon: "fa-wrench", cssClass: this.tabGroups.main === "builder" ? "active" : "" },
            { id: "effects", label: "Active Effects", icon: "fa-star", cssClass: this.tabGroups.main === "effects" ? "active" : "" },
            { id: "dialog", label: "Creation Dialog", icon: "fa-comment-dots", cssClass: this.tabGroups.main === "dialog" ? "active" : "" }
        ];

        let tabContent;
        const render = foundry.applications.handlebars.renderTemplate;
        const partialContext = { 
            purchasingActor: this.purchasingActor,
            // We will add builderData here once the service is built
        };

        // --- Render Tab Content ---
        switch (this.tabGroups.main) {
            case "effects":
                // Placeholder content for the future
                tabContent = `<div class="placeholder">Active Effects Configuration will be here.</div>`;
                break;
            case "dialog":
                // Placeholder content for the future
                tabContent = `<div class="placeholder">The final Creation Dialog will be here.</div>`;
                break;
            default: // "builder" tab
                this.tabGroups.main = "builder";
                const itemsByType = this.itemData.itemsByType ?? {};

                // Ensure a category is selected if possible
                if (!this.selectedKey || !itemsByType[this.selectedKey]) {
                    this.selectedKey = Object.keys(itemsByType).find(k => itemsByType[k].items.length > 0) || null;
                }

                partialContext.itemsByType = itemsByType;
                partialContext.selectedKey = this.selectedKey;
                partialContext.selectedItems = this.selectedKey ? (itemsByType[this.selectedKey]?.items || []) : [];
                
                // Placeholder for mods - we'll filter this properly later
                partialContext.mods = itemsByType.itemModifications?.items ?? [];

                // Render the main builder content area using its own partial
                tabContent = await render("modules/sr5-marketplace/templates/apps/itemBuilder/partials/builder-main-content.html", partialContext);
                break;
        }

        return { tabs, tabContent, purchasingActor: this.purchasingActor };
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