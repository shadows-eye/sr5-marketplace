// Import required components from Foundry VTT
import ItemData from './itemData.js';
//import {getFormattedTimestamp} from './itemData.js';
import {ActorItemData} from './actorItemData.js';
import { logActorHistory } from './actorHistoryLog.js';
import GlobalHelper from './global.js';
import {BasketHelper} from './global.js';
import { MarketplaceHelper } from './global.js';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PurchaseScreenAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.socket = socketlib.registerModule("sr5-marketplace");
    this.itemData = new ItemData();
    this.basket = [];
    this.tabGroups = { main: options.tab || "shop" }; // Initialize tabGroups
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
      template: "modules/sr5-marketplace/templates/purchase.hbs",
    },
  };

  async _prepareContext(options = {}) {
    await this.itemData.fetchItems();
  
    // Use the selected key from options, instance variable, or default
    const selectedKey = options.selectedKey || this.selectedKey || "rangedWeapons";
    this.selectedKey = selectedKey; // Persist the selected key on the instance
  
    const selectedItems = this.itemData.itemsByType[selectedKey]?.items || [];
  
    const tabs = [
      {
        id: "shop",
        group: "main",
        label: game.i18n.localize("SR5.Marketplace.Tab.Shop"),
        cssClass: this.tabGroups.main === "shop" ? "active" : "",
      },
      {
        id: "orderReview",
        group: "main",
        label: game.i18n.localize("SR5.Marketplace.Tab.OrderReview"),
        cssClass: this.tabGroups.main === "orderReview" ? "active" : "",
      },
    ];
  
    let tabContent;
    if (this.tabGroups.main === "shop") {
      tabContent = await renderTemplate("modules/sr5-marketplace/templates/shop.hbs", {
        itemsByType: this.itemData.itemsByType,
        selectedKey,
        selectedItems,
        basket: this.basket,
        isGM: game.user.isGM,
      });
    } else if (this.tabGroups.main === "orderReview") {
      tabContent = await renderTemplate("modules/sr5-marketplace/templates/orderReview.hbs", {
        basket: this.basket,
        basketTotals: this.itemData.calculateBasketTotals(this.basket),
      });
    }
  
    return {
      tabs,
      tabContent,
      selectedKey, // Pass the selectedKey to the template
      selectedItems,
      isGM: game.user.isGM,
    };
  }

  async changeTab(group, tab) {
    if (this.tabGroups[group] === tab) return; // Skip if already active
    this.tabGroups[group] = tab;
    console.log(`Switched to tab: ${tab}`);
    await this.render(false); // Re-render application
  }

  _onRender(context, options) {
    const html = this.element;
  
    // Handle tab switching
    html.querySelectorAll("[data-group='main']").forEach((tab) => {
      tab.addEventListener("click", (event) => {
        const tabId = event.currentTarget.dataset.tab;
        console.log(`Tab clicked: ${tabId}`);
        this.changeTab("main", tabId);
      });
    });
  
    // Handle dropdown changes
    const dropdown = html.querySelector("#item-type-selector");
    if (dropdown) {
      dropdown.addEventListener("change", async (event) => {
        const selectedKey = event.target.value;
        console.log(`Category selected: ${selectedKey}`);
        this.selectedKey = selectedKey; // Update the selected key
        await this.render(false, { selectedKey }); // Explicitly pass the selected key
      });
    }
  }

  static async myFormHandler(event, form, formData) {
    const action = event.submitter?.dataset?.action;
  
    // Handle category change
    if (formData["item-type-selector"]) {
      const selectedKey = formData["item-type-selector"];
      console.log(`Selected item category: ${selectedKey}`);
      
      // Update the selected key and re-render
      this.selectedKey = selectedKey; // Store the selected key in the app instance
      await this.render(false); // Re-render the application without closing
      return;
    }
  
    // Handle other actions, such as tab changes or submitting the basket
    if (action === "changeTab") {
      const targetTab = event.submitter?.dataset?.tab;
  
      // Update the current tab and re-render
      this.tab = targetTab;
      this.render(true);
  
      console.log(`Switched to tab: ${targetTab}`);
      event.preventDefault();
      return;
    }
  
    const basketItems = formData.basketItems || [];
    if (basketItems.length > 0) {
      await this.socket.executeAsGM("submitBasket", { userId: game.user.id, basket: basketItems });
      ui.notifications.info("Basket submitted successfully!");
    } else {
      console.log("No items selected for purchase.");
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