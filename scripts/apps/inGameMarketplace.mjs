import ItemDataServices from '../services/ItemDataServices.mjs';
import { BasketService } from '../services/basketService.mjs';
import { PurchaseService } from '../services/purchaseService.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class inGameMarketplace extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.itemData = new ItemDataServices();
        this.tabGroups = { main: options.tab || "shop" };
        this.basketService = new BasketService();
        this.selectedContactId = null;
        this.purchasingActor = null; // To store a reference to the actor
        
        // Bind handlers once
        this._onClick = this._onClick.bind(this);
        this._onChange = this._onChange.bind(this);
    }

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "purchase-screen",
            title: game.i18n.localize("SR5.PurchaseScreen"),
            classes: ["sr5-marketplace"],
            position: { width: 910, height: 800, top: 50, left: 120 },
            reactive: false
        });
    }

    static PARTS = {
        main: { template: "modules/sr5-marketplace/templates/apps/inGameMarketplace/inGameMarketplace.html" },
    };

    async _prepareContext(options = {}) {
        await this.itemData.fetchItems();
        const basket = await this.basketService.getBasket();
        const basketItemCount = basket.basketItems?.length ?? 0;

        const tabs = [{ id: "shop", label: game.i18n.localize("SR5.Marketplace.Tab.Shop"), icon: "fa-store", cssClass: this.tabGroups.main === "shop" ? "active" : "" }];
        if (game.user.isGM) {
            tabs.push({ id: "orderReview", label: game.i18n.localize("SR5.Marketplace.Tab.OrderReview"), icon: "fa-list-check", cssClass: this.tabGroups.main === "orderReview" ? "active" : "" });
        }
        if (basketItemCount > 0) {
            tabs.push({ id: "shoppingCart", label: ` (${basketItemCount})`, icon: "fa-shopping-cart", cssClass: this.tabGroups.main === "shoppingCart" ? "active" : "", count: basketItemCount });
        }
        if (this.tabGroups.main === "shoppingCart" && basketItemCount === 0) {
            this.tabGroups.main = "shop";
        }

        const partialContext = { basket, isGM: game.user.isGM };
        let tabContent;

        if (this.tabGroups.main === "shoppingCart") {
            partialContext.items = basket.basketItems;
            const actor = basket.createdForActor ? await fromUuid(basket.createdForActor) : null;
            if (actor) {
                this.purchasingActor = partialContext.purchasingActor = {
                    doc: actor,
                    name: actor.name,
                    img: actor.img,
                    uuid: actor.uuid,
                    nuyen: actor.system.nuyen,
                    karma: actor.system.karma.value,
                    nuyenAfterPurchase: actor.system.nuyen - basket.totalCost,
                    karmaAfterPurchase: actor.system.karma.value - basket.totalKarma // Corrected property name
                };
                partialContext.contacts = actor.items.filter(i => i.type === "contact").map(contact => {
                    const contactData = contact.toObject(false);
                    contactData.isSelected = (contact.id === this.selectedContactId);
                    return contactData;
                });
            }
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html", partialContext);
        } else if (this.tabGroups.main === "orderReview" && game.user.isGM) {
            const pendingRequests = [];
            for (const user of game.users) {
                const pendingBasket = user.getFlag("sr5-marketplace", "basket");
                if (pendingBasket && pendingBasket.status === "pending") {
                    const actor = pendingBasket.createdForActor ? await fromUuid(pendingBasket.createdForActor) : null;
                    pendingRequests.push({ user: user.toJSON(), basket: pendingBasket, actor: actor ? { name: actor.name, nuyen: actor.system.nuyen, karma: actor.system.karma.value } : null });
                }
            }
            partialContext.pendingBaskets = pendingRequests;
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/orderReview.html", partialContext);
        } else {
            this.tabGroups.main = "shop";
            partialContext.itemsByType = this.itemData.itemsByType;
            partialContext.selectedKey = this.selectedKey || "rangedWeapons";
            this.selectedKey = partialContext.selectedKey;
            partialContext.selectedItems = this.itemData.itemsByType[partialContext.selectedKey]?.items || [];
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.html", partialContext);
        }

        return { tabs, tabContent, tabGroups: this.tabGroups, isGM: game.user.isGM };
    }

    async changeTab(group, tab) {
        if (this.tabGroups[group] === tab) return;
        this.tabGroups[group] = tab;
        await this.render(false);
    }
    
    _onRender(context, options) {
        const html = this.element;
        html.removeEventListener("click", this._onClick);
        html.removeEventListener("change", this._onChange);
        html.addEventListener("click", this._onClick);
        html.addEventListener("change", this._onChange);
    }

    /**
     * Handles all delegated click events inside the application.
     * @private
     */
    async _onClick(event) {
        const target = event.target;
        
        const tabButton = target.closest(".marketplace-tab");
        if (tabButton) {
            event.preventDefault();
            const nav = tabButton.closest(".marketplace-tabs");
            if (nav) this.changeTab(nav.dataset.group, tabButton.dataset.tab);
            return;
        }

        const entityLink = target.closest("a[data-entity-link]");
        if (entityLink) {
            event.preventDefault();
            const uuid = entityLink.dataset.uuid;
            if (uuid) {
                const document = await fromUuid(uuid);
                document?.sheet.render(true);
            }
            return;
        }
        
        const contactCard = target.closest(".contact-card");
        if (contactCard) {
            event.preventDefault();
            if (target.matches(".contact-icon")) {
                const contactId = contactCard.dataset.contactId;
                if (this.purchasingActor) {
                    const purchasingActorDoc = await fromUuid(this.purchasingActor.uuid);
                    const contactItem = purchasingActorDoc?.items.get(contactId);
                    contactItem?.sheet.render(true);
                }
                return;
            }
            const contactId = contactCard.dataset.contactId;
            this.selectedContactId = (this.selectedContactId === contactId) ? null : contactId;
            this.render(false);
            return;
        }

        let actionTaken = false;
        
        const cartButton = target.closest("button.add-to-cart");
        const removeButton = target.closest(".remove-from-basket-btn");
        const plusButton = target.closest(".plus");
        const minusButton = target.closest(".minus");
        const sendRequestButton = target.closest("#send-request-button");
        const approveAllButton = target.closest(".approve-all-btn");
        const rejectAllButton = target.closest(".reject-all-btn");
        const approveItemButton = target.closest(".approve-item-btn");
        const rejectItemButton = target.closest(".reject-item-btn");

        if (cartButton) {
            await this.basketService.addToBasket(cartButton.dataset.itemId);
            actionTaken = true;
        } else if (removeButton) {
            const basketItemId = removeButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if (basketItemId) await this.basketService.removeFromBasket(basketItemId);
            actionTaken = true;
        } else if (plusButton) {
            const basketItemId = plusButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if(basketItemId) await this.basketService.updateItemQuantity(basketItemId, 1);
            actionTaken = true;
        } else if (minusButton) {
            const basketItemId = minusButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if(basketItemId) await this.basketService.updateItemQuantity(basketItemId, -1);
            actionTaken = true;
        } else if (sendRequestButton) {
            const basket = await this.basketService.getBasket();
            const actor = await fromUuid(basket.createdForActor);
            if (actor) {
                if (game.settings.get("sr5-marketplace", "gmApprovalRequired")) {
                    await PurchaseService.submitForReview(game.user, basket);
                } else {
                    await PurchaseService.directPurchase(actor, basket);
                }
                await this.basketService.saveBasket(null); 
                actionTaken = true;
            }
        } else if (approveAllButton) {
            await PurchaseService.approveBasket(approveAllButton.dataset.userId);
            actionTaken = true;
        } else if (rejectAllButton) {
            await PurchaseService.rejectBasket(rejectAllButton.dataset.userId);
            actionTaken = true;
        } else if (approveItemButton) {
            const userId = approveItemButton.closest(".pending-request-block").dataset.userId;
            const basketItemId = approveItemButton.closest("[data-basket-item-id]").dataset.basketItemId;
            await PurchaseService.approveSingleItem(userId, basketItemId);
            actionTaken = true;
        } else if (rejectItemButton) {
            const userId = rejectItemButton.closest(".pending-request-block").dataset.userId;
            const basketItemId = rejectItemButton.closest("[data-basket-item-id]").dataset.basketItemId;
            await PurchaseService.rejectSingleItem(userId, basketItemId);
            actionTaken = true;
        }

        if (actionTaken) {
            event.preventDefault();
            this.render(false);
        }
    }
    
    async _onChange(event) {
        const target = event.target;
        let actionTaken = false;
        
        if (target.matches(".item-rating-select")) {
            const basketItemId = target.dataset.basketItemId;
            const newRating = parseInt(target.value, 10);
            if (basketItemId) await this.basketService.updateItemRating(basketItemId, newRating);
            actionTaken = true;
        } else if (target.matches("#item-type-selector")) {
            this.selectedKey = target.value;
            actionTaken = true;
        } else if (target.matches(".gm-review-input")) {
            const itemRow = target.closest(".item-row");
            const userId = target.closest(".pending-request-block").dataset.userId;
            const basketItemId = itemRow.dataset.basketItemId;
            const property = target.dataset.property;
            const value = (target.type === "number") ? Number(target.value) : target.value;
            await PurchaseService.updatePendingItem(userId, basketItemId, property, value);
            return; 
        }

        if (actionTaken) {
            this.render(false);
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