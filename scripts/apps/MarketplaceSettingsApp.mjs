const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Define the template path as a constant to ensure consistency.
export const MARKETPLACE_SETTINGS_TEMPLATE = "modules/sr5-marketplace/templates/apps/marketplace-settings/marketplace-settings.html";

export class MarketplaceSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options = {}) {
        super(options);
    }

    /**
     * @override
     * The definitive ApplicationV2 pattern for defining the main template.
     */
    static PARTS = {
        main: {
            id: "body",
            template: MARKETPLACE_SETTINGS_TEMPLATE
        }
    };

    /**
     * @override
     * Default Application V2 configuration options.
     */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "sr5-marketplace-settings",
            title: "Marketplace Item Behavior Settings",
            classes: ["sr5-marketplace", "sr5-marketplace-settings-app"],
            position: { width: 800, height: 650, top: 100, left: 150 },
            // The 'template' property is now correctly handled by static PARTS.
            resizable: true
        });
    }

    /**
     * @override
     * Prepares the data context to be rendered in the template.
     */
    async _prepareContext(options) {
        const allItems = game.sr5marketplace.itemData.getItems();
        const allTypes = [...new Set(allItems.map(item => item.type))].sort();
        const behaviors = game.settings.get("sr5-marketplace", "itemTypeBehaviors");

        const typeSettings = allTypes.map(type => {
            return {
                key: type,
                label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " "),
                behavior: behaviors[type] || 'single'
            };
        });

        return { typeSettings };
    }
    
    /**
     * @override
     * Add event listeners after the application is rendered.
     */
    _onRender(context, options) {
        this.element.removeEventListener("click", this._onClick);
        this.element.addEventListener("click", this._onClick);
    }

    /**
     * Handles clicks on the item cards to change their behavior category.
     * @param {PointerEvent} event
     * @private
     */
    _onClick = async (event) => {
        const card = event.target.closest(".item-type-card[data-target-behavior]");
        if (!card) return;

        event.preventDefault();
        const itemType = card.dataset.type;
        const targetBehavior = card.dataset.targetBehavior;

        const currentBehaviors = game.settings.get("sr5-marketplace", "itemTypeBehaviors");
        
        if (currentBehaviors[itemType] === targetBehavior) return;
        
        currentBehaviors[itemType] = targetBehavior;
        
        await game.settings.set("sr5-marketplace", "itemTypeBehaviors", currentBehaviors);

        // This will now work correctly because `this` is guaranteed to be the application instance.
        this.render(false);
    }

    /**
     * @override
     * This method is called when the "Save Changes" button is clicked.
     */
    async _handleFormSubmission(event, form, formData) {
        // formData.object correctly captures all the <select> values from the form.
        event.preventDefault();
        const newBehaviors = formData.object;
        
        await game.settings.set("sr5-marketplace", "itemTypeBehaviors", newBehaviors);
        ui.notifications.info("Marketplace item behaviors saved.");
        this.close();
    }
}