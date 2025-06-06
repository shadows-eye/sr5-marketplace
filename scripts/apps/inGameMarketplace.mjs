// Import required components from Foundry VTT
import ItemDataServices from '../services/ItemDataServices.mjs';
import { ActorItemServices } from '../services/actorItemServices.mjs';
import { ActorHistoryLogService } from '../services/actorHistoryLogService.mjs';
import GlobalHelper from '../services/global.mjs';
import { BasketHelper } from '../services/global.mjs';
import { MarketplaceHelper } from '../services/global.mjs';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class inGameMarketplace extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.itemData = new ItemDataServices();
        this.basket = [];
        this.tabGroups = { main: options.tab || "shop" }; // This will store the active tab for each group
    }

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "purchase-screen",
            title: game.i18n.localize("SR5.PurchaseScreen"),
            classes: ["sr5-marketplace"],
            position: {
                width: 910,
                height: 800,
                top: 50,
                left: 120,
            },
        });
    }

    static PARTS = {
        main: {
            template: "modules/sr5-marketplace/templates/apps/inGameMarketplace/inGameMarketplace.hbs",
        },
    };

    async _prepareContext(options = {}) {
        await this.itemData.fetchItems();

        const selectedKey = options.selectedKey || this.selectedKey || "rangedWeapons";
        this.selectedKey = selectedKey;

        const selectedItems = this.itemData.itemsByType[selectedKey]?.items || [];

        // This context data is used by the inGameMarketplace.hbs template to render the tabs
        const tabs = [{
            id: "shop",
            label: game.i18n.localize("SR5.Marketplace.Tab.Shop"),
            cssClass: this.tabGroups.main === "shop" ? "active" : "",
        }, {
            id: "orderReview",
            label: game.i18n.localize("SR5.Marketplace.Tab.OrderReview"),
            cssClass: this.tabGroups.main === "orderReview" ? "active" : "",
        }];

        let tabContent;
        if (this.tabGroups.main === "shop") {
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.hbs", {
                itemsByType: this.itemData.itemsByType,
                selectedKey,
                selectedItems,
                basket: this.basket,
                isGM: game.user.isGM,
            });
        } else if (this.tabGroups.main === "orderReview") {
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/orderReview.hbs", {
                basket: this.basket,
                basketTotals: this.itemData.calculateBasketTotals(this.basket),
            });
        }

        return {
            tabs,
            tabContent,
            selectedKey,
            selectedItems,
            isGM: game.user.isGM,
        };
    }

    /**
     * Handle tab switching.
     * @param {string} group The tab group name.
     * @param {string} tab The target tab name.
     */
    async changeTab(group, tab) {
        if (this.tabGroups[group] === tab) return;
        this.tabGroups[group] = tab;
        console.log(`Switched to tab: '${tab}' in group: '${group}'`);
        await this.render(false);
    }

    _onRender(context, options) {
        const html = this.element;

        // Handle grouped tab switching
        html.querySelectorAll(".marketplace-tabs[data-group] .marketplace-tab").forEach((tab) => {
            tab.addEventListener("click", (event) => {
                event.preventDefault();
                const button = event.currentTarget;
                const nav = button.closest(".marketplace-tabs");
                const group = nav.dataset.group;
                const tabId = button.dataset.tab;
                
                if (group && tabId) {
                    this.changeTab(group, tabId);
                }
            });
        });

        // Handle dropdown changes
        const dropdown = html.querySelector("#item-type-selector");
        if (dropdown) {
            dropdown.addEventListener("change", async (event) => {
                const selectedKey = event.target.value;
                this.selectedKey = selectedKey;
                await this.render(false);
            });
        }
    }
    
    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        if (data.type === "Actor") {
            this.selectedActor = game.actors.get(data.id);
            this.render();
        }
    }
}