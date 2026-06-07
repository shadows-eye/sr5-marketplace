/**
 * A custom Tour class for the SR5 Marketplace module.
 * Extends the core Foundry VTT Tour class to add sidebar tab activation support,
 * programmatically opens/closes relevant application sheets and dialogs on each step,
 * and wraps game.tooltip.deactivate to prevent hover-based dismissal of the guide tooltip.
 */
export class MarketplaceTour extends foundry.nue.Tour {
    _allowDeactivate = false;
    _originalDeactivate = null;

    /** @override */
    async start() {
        game.togglePause(false);

        // Wrap game.tooltip.deactivate to prevent automatic hover-based dismissal
        if (!this._originalDeactivate && game.tooltip) {
            this._originalDeactivate = game.tooltip.deactivate;
            const self = this;
            game.tooltip.deactivate = function(...args) {
                if (!self._allowDeactivate) {
                    // Block automatic hover-out deactivations
                    return;
                }
                return self._originalDeactivate.apply(this, args);
            };
        }

        await super.start();
    }

    /** @override */
    async _postStep() {
        this._allowDeactivate = true;
        await super._postStep();
        this._allowDeactivate = false;
    }

    /** @override */
    exit() {
        this._allowDeactivate = true;
        super.exit();
        this._allowDeactivate = false;
        
        // Restore original deactivate function
        if (this._originalDeactivate && game.tooltip) {
            game.tooltip.deactivate = this._originalDeactivate;
            this._originalDeactivate = null;
        }
    }

    /** @override */
    async complete() {
        this._allowDeactivate = true;
        const result = await super.complete();
        this._allowDeactivate = false;

        // Restore original deactivate function
        if (this._originalDeactivate && game.tooltip) {
            game.tooltip.deactivate = this._originalDeactivate;
            this._originalDeactivate = null;
        }
        return result;
    }

    /** @override */
    async _preStep() {
        await super._preStep();
        const step = this.currentStep;
        if (!step) return;

        // Activate core sidebar tab if specified
        if (step.sidebarTab) {
            await ui[step.sidebarTab]?.activate();
        }

        // Retrieve registered classes dynamically from the API container
        const api = game.sr5marketplace?.api || {};
        const SR5CreateActorApp = api.SR5CreateActorApp;
        const inGameMarketplace = api.inGameMarketplace;

        // Determine which apps are required for the current step
        const stepId = step.id;
        const needsCreator = (stepId === "createActor");
        const needsShopSheet = ["populateShop", "connectPlayer", "linkEmployee", "placement"].includes(stepId);
        const needsMarketplace = ["buyWithShop", "buyOwn", "gmConfirm"].includes(stepId);

        // Close any apps that are not needed for this step (helps when navigating backward or forward)
        try {
            if (!needsCreator) {
                const createActorApp = Array.from(foundry.applications.instances.values()).find(
                    app => app.constructor.name === "SR5CreateActorApp"
                );
                if (createActorApp) await createActorApp.close();
            }

            if (!needsShopSheet) {
                for (const app of Array.from(foundry.applications.instances.values())) {
                    if (app.constructor.name === "ShopActorSheet") {
                        await app.close();
                    }
                }
            }

            if (!needsMarketplace) {
                const marketplace = foundry.applications.instances.get("inGameMarketplace");
                if (marketplace) await marketplace.close();
            }
        } catch (err) {
            console.warn("SR5 Marketplace | Error closing unneeded apps during tour step:", err);
        }

        // Programmatically guide the user by opening/configuring screens
        try {
            switch (step.id) {
                case "intro":
                case "conclusion":
                    // Overlay z-index and closing helpers handled above
                    break;

                case "createActor": {
                    // Open Create Actor app if not already open, and default it to Shop type
                    if (SR5CreateActorApp) {
                        let createActorApp = Array.from(foundry.applications.instances.values()).find(
                            app => app.constructor.name === "SR5CreateActorApp"
                        );
                        if (!createActorApp) {
                            createActorApp = new SR5CreateActorApp({ resolve: () => {}, folder: null });
                        }
                        createActorApp.selectedActorType = "sr5-marketplace.shop";
                        createActorApp.render(true);
                    }

                    // Wait for rendering to complete so target element is in DOM
                    await new Promise(resolve => setTimeout(resolve, 200));
                    break;
                }

                case "populateShop": {
                    // Find or create a demo Shop Actor to show
                    let shop = game.actors.find(a => a.type === "sr5-marketplace.shop");
                    if (!shop) {
                        shop = await Actor.create({
                            name: "Demo Shop",
                            type: "sr5-marketplace.shop"
                        });
                    }

                    if (shop) {
                        const sheet = shop.sheet;
                        sheet.tabGroups.primary = "inventory";
                        await sheet.render(true);
                    }

                    await new Promise(resolve => setTimeout(resolve, 200));
                    break;
                }

                case "connectPlayer":
                case "linkEmployee":
                case "placement": {
                    // Ensure Shop Actor sheet is open, on Management tab, in Edit Mode
                    let shop = game.actors.find(a => a.type === "sr5-marketplace.shop");
                    if (!shop) {
                        shop = await Actor.create({
                            name: "Demo Shop",
                            type: "sr5-marketplace.shop"
                        });
                    }

                    if (shop) {
                        const sheet = shop.sheet;
                        sheet.tabGroups.primary = "management";
                        sheet._mode = "edit";
                        await sheet.render(true);
                    }

                    await new Promise(resolve => setTimeout(resolve, 200));
                    break;
                }

                case "buyWithShop": {
                    // Open the Marketplace app linked to our shop
                    if (inGameMarketplace) {
                        const shop = game.actors.find(a => a.type === "sr5-marketplace.shop");
                        let marketplace = foundry.applications.instances.get("inGameMarketplace");
                        if (!marketplace) {
                            marketplace = new inGameMarketplace({
                                shopActorUuid: shop?.uuid || null
                            });
                        } else {
                            marketplace.shopActorUuid = shop?.uuid || null;
                            marketplace.selectedSource = shop?.uuid || "global";
                        }
                        marketplace.tabGroups.main = "shop";
                        await marketplace.render(true);
                    }

                    await new Promise(resolve => setTimeout(resolve, 200));
                    break;
                }

                case "buyOwn": {
                    // Open the Marketplace app in global/own shopping mode
                    if (inGameMarketplace) {
                        let marketplace = foundry.applications.instances.get("inGameMarketplace");
                        if (!marketplace) {
                            marketplace = new inGameMarketplace({});
                        }
                        marketplace.shopActorUuid = null;
                        marketplace.selectedSource = "global";
                        marketplace.tabGroups.main = "shop";
                        await marketplace.render(true);
                    }

                    await new Promise(resolve => setTimeout(resolve, 200));
                    break;
                }

                case "gmConfirm": {
                    // Open the Marketplace app on the Order Review tab
                    if (game.user.isGM && inGameMarketplace) {
                        let marketplace = foundry.applications.instances.get("inGameMarketplace");
                        if (!marketplace) {
                            marketplace = new inGameMarketplace({});
                        }
                        marketplace.tabGroups.main = "orderReview";
                        await marketplace.render(true);
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                    break;
                }
            }
        } catch (err) {
            console.error("SR5 Marketplace | Error in Getting Started tour step setup:", err);
        }
    }
}

/**
 * Registers the Getting Started Tour for the SR5 Marketplace module.
 */
export function registerMarketplaceTour() {
    const tourConfig = {
        id: "getting-started",
        namespace: "sr5-marketplace",
        title: "SR5Marketplace.Tours.GettingStarted.Title",
        description: "SR5Marketplace.Tours.GettingStarted.Description",
        display: true,
        steps: [
            {
                id: "intro",
                title: "SR5Marketplace.Tours.GettingStarted.Steps.Intro.Title",
                content: "SR5Marketplace.Tours.GettingStarted.Steps.Intro.Content"
            },
            {
                id: "createActor",
                selector: "#sr5-marketplace-create-actor-dialog",
                sidebarTab: "actors",
                title: "SR5Marketplace.Tours.GettingStarted.Steps.CreateActor.Title",
                content: "SR5Marketplace.Tours.GettingStarted.Steps.CreateActor.Content"
            },
            {
                id: "populateShop",
                selector: ".sr5-marketplace-shop",
                title: "SR5Marketplace.Tours.GettingStarted.Steps.PopulateShop.Title",
                content: "SR5Marketplace.Tours.GettingStarted.Steps.PopulateShop.Content"
            },
            {
                id: "connectPlayer",
                selector: ".sr5-marketplace-shop [data-drop-zone='connection']",
                title: "SR5Marketplace.Tours.GettingStarted.Steps.ConnectPlayer.Title",
                content: "SR5Marketplace.Tours.GettingStarted.Steps.ConnectPlayer.Content"
            },
            {
                id: "linkEmployee",
                selector: ".sr5-marketplace-shop [data-drop-zone='employees']",
                title: "SR5Marketplace.Tours.GettingStarted.Steps.LinkEmployee.Title",
                content: "SR5Marketplace.Tours.GettingStarted.Steps.LinkEmployee.Content"
            },
            {
                id: "placement",
                selector: ".sr5-marketplace-shop [name='system.shop.shopRadius.value']",
                title: "SR5Marketplace.Tours.GettingStarted.Steps.Placement.Title",
                content: "SR5Marketplace.Tours.GettingStarted.Steps.Placement.Content"
            },
            {
                id: "buyWithShop",
                selector: "#inGameMarketplace",
                title: "SR5Marketplace.Tours.GettingStarted.Steps.BuyWithShop.Title",
                content: "SR5Marketplace.Tours.GettingStarted.Steps.BuyWithShop.Content"
            },
            {
                id: "buyOwn",
                selector: ".marketshouter-container",
                title: "SR5Marketplace.Tours.GettingStarted.Steps.BuyOwn.Title",
                content: "SR5Marketplace.Tours.GettingStarted.Steps.BuyOwn.Content"
            },
            {
                id: "gmConfirm",
                selector: "#inGameMarketplace",
                restricted: true,
                title: "SR5Marketplace.Tours.GettingStarted.Steps.GMConfirm.Title",
                content: "SR5Marketplace.Tours.GettingStarted.Steps.GMConfirm.Content"
            },
            {
                id: "conclusion",
                title: "SR5Marketplace.Tours.GettingStarted.Steps.Conclusion.Title",
                content: "SR5Marketplace.Tours.GettingStarted.Steps.Conclusion.Content"
            }
        ]
    };

    try {
        const gettingStartedTour = new MarketplaceTour(tourConfig);
        game.tours.register("sr5-marketplace", "getting-started", gettingStartedTour);
        console.log("SR5 Marketplace | Registered Getting Started Tour.");
    } catch (err) {
        console.error("SR5 Marketplace | Failed to register getting-started tour:", err);
    }
}
