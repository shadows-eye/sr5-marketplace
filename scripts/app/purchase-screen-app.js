// src/apps/purchase-screen-app.js
class PurchaseScreenApp extends Application {
    static get defaultOptions() {
      return mergeObject(super.defaultOptions, {
        id: "purchase-screen",
        title: "Purchase Screen",
        template: "modules/sr5-marketplace/templates/purchase.hbs",
        width: 800,
        height: 600,
      });
    }
  
    // Additional logic to manage items and marketplace can be added here.
  }  