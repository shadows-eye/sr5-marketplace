import ItemDataServices from '../services/ItemDataServices.mjs';
import { AppDialogBuilder } from '../services/AppDialogBuilder.mjs';
import { ItemPreviewApp } from "./documents/items/ItemPreviewApp.mjs"; 
import { BasketService } from '../services/basketService.mjs';
import { PurchaseService } from '../services/purchaseService.mjs';
import { SearchService } from '../services/searchTag.mjs';
import{ MODULE_ID } from '../lib/constants.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = MODULE_ID // "sr5-marketplace"
const FLAG_KEY_SELECTED_ACTOR = "selectedActorUuid";

export class inGameMarketplace extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        options.classes = [...(options.classes || []), "sr5-marketplace", "sr5-market"];
        super(options);

        this.itemData = game.sr5marketplace.itemData;
        this.basketService = new BasketService();
        this.tabGroups = { main: "shop" };
        this.purchasingActor = null;
        this.searchService = null;
        // Handle passed-in shop context ---
        this.shopActorUuid = options.shopActorUuid ?? null;
        this.selectedSource = this.shopActorUuid ?? "global"; // Default to the specific shop if provided

        this.selectedKey = null;

        const itemsByType = this.itemData.itemsByType ?? {}; //Might need to go because of ItemDataService.mjs
        let defaultKey = null;

        // 1. Prioritize "rangedWeapons" if it has items.
        if (itemsByType.rangedWeapons && itemsByType.rangedWeapons.items.length > 0) {
            defaultKey = "rangedWeapons";
        } 
        // 2. Otherwise, find the first category that has items.
        else {
            const firstAvailableCategory = Object.entries(itemsByType).find(([, data]) => data.items.length > 0);
            if (firstAvailableCategory) {
                defaultKey = firstAvailableCategory[0];
            }
        }
        
        // 3. Set the selected key based on the logic above.
        this.selectedKey = defaultKey;
    }

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "inGameMarketplace",
            position: { width: 910, height: 800, top: 50, left: 120 },
            window: { title: "SR5.PurchaseScreen", resizable: true },
            actions: {
                changeTab: this.#onChangeTab,
                toggleActorList: this.#onToggleActorList,
                selectActor: this.#onSelectActor,
                clearActor: this.#onClearActor,
                openDocumentLink: this.#onOpenDocumentLink,
                addToCart: this.#onAddToCart,
                removeFromCart: this.#onRemoveFromCart,
                increaseQuantity: this.#onUpdateQuantity,
                decreaseQuantity: this.#onUpdateQuantity,
                sendRequest: this.#onSendRequest,
                cancelRequest: this.#onCancelRequest,
                approveAll: this.#onApproveRejectAll,
                rejectAll: this.#onApproveRejectAll,
                approveItem: this.#onApproveRejectItem,
                rejectItem: this.#onApproveRejectItem,
                //changeCategory: this.onChangeCategory, Is moved to _onRender
                updateRating: this.#onUpdateRating,
                updatePendingItem: this.#onUpdatePendingItem,
            }
        });
    }
    
    /**
     * Determines whether to get all items or just a specific shop's items.
     * @returns {Promise<object>}
     */
    async #getItemsForSource() {
        if (this.selectedSource === "global") {
            return this.itemData.itemsByType;
        }
        // --- UPDATED: Call the new method on the service ---
        return this.itemData.getShopItems(this.selectedSource);
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        if (this.tabGroups.main === "shop") {
            this.searchService = new SearchService(this.element);
            this.searchService.initialize();
            
            const categorySelector = this.element.querySelector("#item-type-selector");
            if (categorySelector) {
                categorySelector.addEventListener("change", this.onChangeCategory.bind(this));
            }

            // --- NEW: Add a dedicated listener for the source toggle checkbox ---
            const sourceToggle = this.element.querySelector("#marketplace-source-toggle");
            if (sourceToggle) {
                sourceToggle.addEventListener("change", this.onSourceChange.bind(this));
            }
        } else {
            this.searchService = null;
        }
    }

    /**
     * Handles the change event for the item source toggle. 
     * With event listener Attached in _onRender
     */
    async onSourceChange(event) {
        const isChecked = event.currentTarget.checked;
        this.selectedSource = isChecked ? this.shopActorUuid : "global";
        await this.render();
    }

    /** @override */
    static PARTS = {
        main: { template: "modules/sr5-marketplace/templates/apps/inGameMarketplace/inGameMarketplace.html" },
    };

    /** @override */
    async _prepareContext(options = {}) {
        const selectedActorUuid = game.user.getFlag(FLAG_SCOPE, FLAG_KEY_SELECTED_ACTOR);
        let actorForDisplay = selectedActorUuid ? await fromUuid(selectedActorUuid) : null;
        if (!actorForDisplay) {
            actorForDisplay = game.user.character || canvas.tokens.controlled[0]?.actor || null;
        }
        this.purchasingActor = actorForDisplay;
        
        let purchasingActorData = null;
        if (this.purchasingActor) {
            purchasingActorData = {
                uuid: this.purchasingActor.uuid, name: this.purchasingActor.name, img: this.purchasingActor.img,
                nuyen: this.purchasingActor.system.nuyen, karma: this.purchasingActor.system.karma.value
            };
        }

        const ownedActors = game.actors.filter(a => a.isOwner).map(a => ({ uuid: a.uuid, name: a.name, img: a.img }));
        const itemsByType = this.itemData.itemsByType;
        const basket = await this.basketService.getBasket();
        const basketItemCount = basket.shoppingCartItems.length;

        const tabs = [{ 
            id: "shop", label: game.i18n.localize("SR5.Marketplace.Tab.Shop"), icon: "fa-store",
            cssClass: this.tabGroups.main === "shop" ? "active" : "" 
        }];

        if (game.user.isGM) {
            tabs.push({ 
                id: "orderReview", label: game.i18n.localize("SR5.Marketplace.Tab.OrderReview"),
                icon: "fa-list-check", cssClass: this.tabGroups.main === "orderReview" ? "active" : "",
                count: PurchaseService.getPendingRequestCount() 
            });
        }
        if (basketItemCount > 0) {
            tabs.push({ 
                id: "shoppingCart", label: "", icon: "fa-shopping-cart",
                cssClass: this.tabGroups.main === "shoppingCart" ? "active" : "",
                count: basketItemCount, tooltip: game.i18n.localize("SR5.Marketplace.ShoppingBasket")
            });
        }
        
        if (this.tabGroups.main === "shoppingCart" && basketItemCount === 0) {
            this.tabGroups.main = "shop";
        }
        
         let tabContent;
    let partialContext = { basket, isGM: game.user.isGM, purchasingActor: purchasingActorData };
    const render = foundry.applications.handlebars.renderTemplate;

    switch (this.tabGroups.main) {
        case "shoppingCart":
            // Prepare standard shopping cart data (contacts)
            if (this.purchasingActor) {
                partialContext.contacts = this.purchasingActor.items.filter(i => i.type === "contact")
                    .map(c => ({...c.toObject(false), isSelected: c.id === basket.selectedContactId}));
            }

            // --- NEW LOGIC FOR AVAILABILITY DIALOG ---
            // 1. Pass the app's current UI state to the template context.
            partialContext.currentTestUI = this.currentTestUI;
            partialContext.rollResult = this.rollResult;
            
            // 2. If the state requires the full dialog, build its specific context.
            if (this.currentTestUI === 'availability-dialog') {
                const itemUuids = basket.shoppingCartItems.map(i => i.itemUuid);
                const builder = new AppDialogBuilder({
                    actorUuid: this.purchasingActor?.uuid,
                    connectionUuid: basket.selectedContactId,
                    itemUuids: itemUuids
                });

                // Build the context for the dialog (actor, modifiers, etc.)
                const dialogContext = await builder.buildContext({
                    selectedSkill: this.element?.querySelector('[name="selectedSkill"]')?.value || 'negotiation'
                });

                // 3. Merge this new data into the main context for the partial.
                foundry.utils.mergeObject(partialContext, dialogContext);
            }

            tabContent = await render("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html", partialContext);
            break;
        case "orderReview":
                partialContext.pendingRequests = await PurchaseService.getAllPendingRequests();
                tabContent = await render("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/orderReview.html", partialContext);
                break;
        default:
                // --- ADDED DEBUG LOG ---
                //console.log(`%cRendering View:`, "color: green; font-weight: bold;", { selectedKey_for_render: this.selectedKey });
                // --- END DEBUG LOG ---
                this.tabGroups.main = "shop";
                const itemsByType = await this.#getItemsForSource();
                
                if (!this.selectedKey || !itemsByType[this.selectedKey] || itemsByType[this.selectedKey].items.length === 0) {
                    const firstAvailableCategory = Object.entries(itemsByType).find(([, data]) => data.items.length > 0);
                    this.selectedKey = firstAvailableCategory ? firstAvailableCategory[0] : null;
                }
                
                // --- UPDATED: Prepare data for the toggle switch ---
                partialContext.shopActorUuid = this.shopActorUuid;
                partialContext.isShopView = this.selectedSource !== "global";
                if (this.shopActorUuid) {
                    const shopActor = await fromUuid(this.shopActorUuid);
                    partialContext.shopName = shopActor?.name ?? "Shop";
                }
                
                partialContext.itemsByType = itemsByType;
                partialContext.selectedKey = this.selectedKey;
                partialContext.selectedItems = this.selectedKey ? (itemsByType[this.selectedKey]?.items || []) : [];
                tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.html", partialContext);
            break;
        }

        return { tabs, tabContent, actor: purchasingActorData, ownedActors };
    }
    
    // --- ACTION HANDLERS ---
    static #onChangeTab(event, target) {
        const tabId = target.dataset.tab;
        if (this.tabGroups.main !== tabId) {
            this.tabGroups.main = tabId;
            this.render();
        }
    }
    
    static #onToggleActorList(event, target) {
        target.closest(".marketplace-user-actor")?.classList.toggle("expanded");
    }

    static async #onSelectActor(event, target) {
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY_SELECTED_ACTOR, target.dataset.actorUuid);
        target.closest(".marketplace-user-actor")?.classList.remove("expanded");
        this.render();
    }

    static async #onClearActor(event, target) {
        event.stopPropagation();
        await game.user.unsetFlag(FLAG_SCOPE, FLAG_KEY_SELECTED_ACTOR);
        this.render();
    }

    /**
     * Passes only the item's UUID to the ItemPreviewApp.
     */
    static async #onOpenDocumentLink(event, target) {
        const uuid = target.dataset.uuid;
        if (!uuid) return;
        const item = await fromUuid(uuid);
        if (!item) return;

        if (item.isOwner) {
            item.sheet.render(true);
        } else {
            // The call is now simpler, pointing to the standalone app
            new ItemPreviewApp(item.uuid).render(true);
        }
    }

    static async #onAddToCart(event, target) {
        if (!this.purchasingActor) {
            ui.notifications.warn("SR5.Marketplace.selectActorTooltip", { localize: true });
            return;
        }
        await this.basketService.addToBasket(target.dataset.itemId, this.purchasingActor.uuid);
        this.tabGroups.main = "shoppingCart";
        this.render();
    }

    static async #onRemoveFromCart(event, target) {
        await this.basketService.removeFromBasket(target.closest("[data-basket-item-uuid]")?.dataset.basketItemUuid);
        this.render();
    }

    static async #onUpdateQuantity(event, target) {
        const itemUuid = target.closest("[data-basket-item-uuid]")?.dataset.basketItemUuid;
        const amount = target.dataset.action === "increaseQuantity" ? 1 : -1;
        await this.basketService.updateItemQuantity(itemUuid, this.purchasingActor.uuid, amount);
        this.render();
    }

    static async #onSendRequest(event, target) {
        const isApprovalWorkflow = game.settings.get("sr5-marketplace", "approvalWorkflow");
        if (isApprovalWorkflow) {
            await PurchaseService.submitForReview(game.user.id);
        } else {
            const basket = await this.basketService.getBasket();
            const actor = await fromUuid(basket.createdForActor);
            if (actor) {
                await PurchaseService.directPurchase(actor, basket);
                await this.basketService.clearBasket();
            }
        }
        this.render();
    }
    
    static async #onCancelRequest(event, target) {
        await this.basketService.clearBasket();
        this.render();
    }
    
    static async #onApproveRejectAll(event, target) {
        const requestBlock = target.closest(".pending-request-block");
        const userId = requestBlock.dataset.userId;
        const basketUuid = requestBlock.dataset.basketUuid;
        if (target.dataset.action === "approveAll") {
            await PurchaseService.approveBasket(userId, basketUuid);
        } else {
            await PurchaseService.rejectBasket(userId, basketUuid);
        }
        this.render();
    }

    static async #onApproveRejectItem(event, target) {
        if (target.dataset.action === "rejectItem") {
            const requestBlock = target.closest(".pending-request-block");
            const itemRow = target.closest(".item-row");
            await PurchaseService.rejectItemFromRequest(requestBlock.dataset.userId, requestBlock.dataset.basketUuid, itemRow.dataset.basketItemId);
            this.render();
        } else {
            ui.notifications.info("Items are approved by default. Use 'Reject' to remove an item from the request.");
        }
    }
    
    /**
     * Handles the change event for the item category dropdown.
     * With event listener Attached in _onRender
     * @param {Event} event The `change` event.
     */
    async onChangeCategory(event) {
        // `event.currentTarget.value` will now always be the new, correct value.
        this.selectedKey = event.currentTarget.value;
        this.searchService?.clearAllFilters();
        await this.render();
    }

    static async #onUpdateRating(event, target) {
        const itemUuid = target.dataset.basketItemUuid;
        const newRating = parseInt(target.value, 10);
        await this.basketService.updateItemProperty(itemUuid, "selectedRating", newRating);
        this.render();
    }
    
    static async #onUpdatePendingItem(event, target) {
        const requestBlock = target.closest(".pending-request-block");
        const itemRow = target.closest(".item-row");
        const property = target.dataset.property;
        const value = (target.type === "number") ? Number(target.value) : target.value;
        await PurchaseService.updatePendingItem(requestBlock.dataset.userId, requestBlock.dataset.basketUuid, itemRow.dataset.basketItemId, property, value);
        this.render();
    }
}