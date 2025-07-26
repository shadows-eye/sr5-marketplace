/**
 * Defines and returns the custom ShopActorSheet class using ApplicationV2.
 * This must be called during the 'init' hook.
 * @returns {typeof ActorSheetV2}
 */
export function defineShopActorSheetClass() {
    const { ActorSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

    class ShopActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
        /** @override */
        static get DEFAULT_OPTIONS() {
            return {
                ...super.DEFAULT_OPTIONS,
                id: "sr5-marketplace-shop-sheet",
                classes: ["sr5-marketplace", "sheet", "actor", "shop"],
                template: "modules/sr5-marketplace/templates/actors/shop-actor-sheet.html",
                width: 600,
                height: 650,
                tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }],
                events: {
                    "change input, change select, change textarea": "_onChangeInput"
                }
            };
        }

        /** @override */
        async _prepareContext(options) {
            const context = await super._prepareContext(options);
            context.system = this.document.system;
            context.shopEmployees = this.document.system.shop.employees.join('\n');
            return context;
        }

        /** @override */
        async _onChangeInput(event) {
            const input = event.currentTarget;
            let value = input.value;
            const name = input.name;

            if (name === "system.shop.employees") {
                value = value.split('\n').map(e => e.trim()).filter(e => e);
            }
            await this.document.update({ [name]: value });
        }
    }

    return ShopActorSheet;
}