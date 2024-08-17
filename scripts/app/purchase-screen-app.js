export class PurchaseScreenApp extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "purchase-screen",
        title: "Purchase Screen",
        template: "modules/sr5-marketplace/templates/purchase.hbs",
        width: 800,
        height: 600,
        classes: ["sr5-market"]
      });
    }
  
    async _render(...args) {
      await super._render(...args);
      // Add a new class to the window-content element
      this.element.find('.window-content').addClass('sr5-marketplace');
    }
  }
  