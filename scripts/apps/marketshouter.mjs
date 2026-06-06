import { BasketService } from "../services/basketService.mjs";
import { inGameMarketplace } from "./inGameMarketplace.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MarketShouterApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.basketService = new BasketService();
        this.searchQuery = "";
        this.matchedItems = [];
        this.currentShopActorUuid = null;
        this.searchableItems = null;
    }

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "marketshouter",
            classes: ["marketshouter-app", "sr5-marketplace"],
            window: {
                frame: false,
                resizable: false
            },
            position: {
                top: 0,
                left: 0,
                width: "100%",
                height: "auto"
            }
        }, { inplace: false });
    }

    /** @override */
    static PARTS = {
        main: {
            template: "modules/sr5-marketplace/templates/apps/marketshouter/marketshouter.html"
        }
    };

    _detectShopActorUuid() {
        if (canvas.ready && canvas.tokens?.controlled[0]) {
            const controlledToken = canvas.tokens.controlled[0];
            const tokenDoc = controlledToken.document || controlledToken;
            const shopRegion = canvas.scene?.regions?.find(r => {
                const shopUuid = r.flags?.["sr5-marketplace"]?.shopActorUuid;
                if (!shopUuid) return false;
                return r.tokens?.has(tokenDoc);
            });
            if (shopRegion) {
                return shopRegion.flags["sr5-marketplace"].shopActorUuid;
            }
        }
        return null;
    }

    /** @override */
    async _prepareContext(options) {
        let itemCount = 0;
        try {
            const basket = await this.basketService.getBasket();
            itemCount = basket?.shoppingCartItems?.length ?? 0;
        } catch (e) {
            console.error("Marketplace | Failed to fetch basket item count for MarketShouter:", e);
        }

        // Detect shop actor context from selected token
        let shopActorImg = null;
        let shopActorName = null;
        let shopActorUuid = this._detectShopActorUuid();
        if (shopActorUuid) {
            try {
                const shopActor = await fromUuid(shopActorUuid);
                if (shopActor) {
                    shopActorImg = shopActor.img;
                    shopActorName = shopActor.name;
                    this.currentShopActorUuid = shopActorUuid;
                    
                    // Pre-cache shop items
                    const shopData = await game.sr5marketplace.api.itemData.getShopItems(shopActorUuid);
                    this.searchableItems = shopData?.filteredItems?.items || [];
                }
            } catch (err) {
                console.error("Marketplace | Failed to fetch shop actor data for MarketShouter:", err);
            }
        } else {
            this.currentShopActorUuid = null;
            this.searchableItems = null;
        }

        const isGM = game.user.isGM;
        const pendingCount = isGM ? game.sr5marketplace.api.marketplace.getPendingRequestCount() : 0;

        return {
            itemCount,
            shopActorImg,
            shopActorName,
            isGM,
            pendingCount
        };
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        const container = this.element.querySelector(".marketshouter-container");
        const searchInput = this.element.querySelector(".marketshouter-search");
        const clearBtn = this.element.querySelector(".marketshouter-clear-btn");
        const resultsPanel = this.element.querySelector(".marketshouter-results");
        const resultsList = this.element.querySelector(".marketshouter-results-list");
        const resultsCountSpan = this.element.querySelector(".results-count");

        if (!container || !searchInput || !resultsPanel) return;

        // Dynamic sidebar-aware positioning calculation
        if (this._sidebarObserver) {
            this._sidebarObserver.disconnect();
            this._sidebarObserver = null;
        }

        this.updatePosition();

        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            this._sidebarObserver = new ResizeObserver(() => {
                this.updatePosition();
            });
            this._sidebarObserver.observe(sidebar);
        }

        // Add action button listeners
        const buttons = this.element.querySelectorAll(".marketshouter-icon-btn");
        buttons.forEach(btn => {
            btn.addEventListener("click", (event) => {
                const action = btn.dataset.action;
                if (action === "openMarketplace") {
                    this._openMarketplace();
                } else if (action === "openCart") {
                    this._openMarketplace("shoppingCart");
                } else if (action === "openReview") {
                    this._openMarketplace("orderReview");
                }
            });
        });

        // Search Input Events
        searchInput.addEventListener("input", (event) => {
            this.searchQuery = event.target.value.trim().toLowerCase();
            this._handleSearch(resultsPanel, resultsList, resultsCountSpan, clearBtn);
        });

        searchInput.addEventListener("focus", () => {
            if (this.searchQuery.length >= 2) {
                resultsPanel.classList.remove("hidden");
            }
        });

        // Clear Search Button
        clearBtn.addEventListener("click", () => {
            searchInput.value = "";
            this.searchQuery = "";
            this._handleSearch(resultsPanel, resultsList, resultsCountSpan, clearBtn);
            searchInput.focus();
        });

        // Global Outside click listener to dismiss search dropdown
        const outsideClickListener = (event) => {
            if (!this.element.contains(event.target)) {
                resultsPanel.classList.add("hidden");
            }
        };

        document.removeEventListener("click", this._globalClickListener);
        this._globalClickListener = outsideClickListener;
        document.addEventListener("click", this._globalClickListener);
    }

    /**
     * Handles search filtering against flat cache and renders the results.
     */
    _handleSearch(resultsPanel, resultsList, resultsCountSpan, clearBtn) {
        if (!clearBtn || !resultsPanel || !resultsList) return;

        // Toggle clear button
        if (this.searchQuery.length > 0) {
            clearBtn.classList.remove("hidden");
        } else {
            clearBtn.classList.add("hidden");
        }

        // Must have at least 2 characters to trigger search
        if (this.searchQuery.length < 2) {
            resultsPanel.classList.add("hidden");
            resultsList.innerHTML = "";
            return;
        }

        // Get indexed items or shop-specific items
        const allItems = this.searchableItems || game.sr5marketplace.api.itemData.getItems();
        
        // Filter items
        this.matchedItems = allItems.filter(item => {
            const nameMatch = item.name?.toLowerCase().includes(this.searchQuery);
            const typeMatch = item.type?.toLowerCase().includes(this.searchQuery);
            const catMatch = item.system?.category?.toLowerCase().includes(this.searchQuery);
            return nameMatch || typeMatch || catMatch;
        });

        // Limit to 15 items for top-tier performance
        const displayItems = this.matchedItems.slice(0, 15);

        // Update count text
        if (resultsCountSpan) {
            resultsCountSpan.textContent = this.matchedItems.length === 1
                ? game.i18n.localize("SR5Marketplace.Marketshouter.ItemFound")
                : game.i18n.format("SR5Marketplace.Marketshouter.ItemsFound", { count: this.matchedItems.length });
        }

        if (displayItems.length === 0) {
            resultsList.innerHTML = `
                <li class="no-results-item">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${game.i18n.localize("SR5Marketplace.Marketshouter.NoMatchingItemsFound")}</span>
                </li>
            `;
        } else {
            resultsList.innerHTML = displayItems.map(item => {
                const img = game.sr5marketplace.api.itemData.getRepresentativeImage(item);
                const cost = item.system?.technology?.cost ?? item.system?.karma ?? "";
                const isKarma = item.system?.karma !== undefined && item.system?.karma !== null;
                const costDisplay = cost ? `${cost} ${isKarma ? "Karma" : "¥"}` : "";
                
                // Format type beautifully
                const formattedType = item.type.charAt(0).toUpperCase() + item.type.slice(1).replace(/_/g, " ");

                return `
                    <li class="marketshouter-result-item" data-uuid="${item.uuid}">
                        <img class="item-thumb" src="/${img}" onerror="this.src='/icons/svg/mystery-man.svg'">
                        <div class="item-meta">
                            <span class="item-name">${item.name}</span>
                            <span class="item-type">${formattedType}</span>
                        </div>
                        ${costDisplay ? `<span class="item-price">${costDisplay}</span>` : ""}
                    </li>
                `;
            }).join("");

            // Add click listeners to items
            const items = resultsList.querySelectorAll(".marketshouter-result-item");
            items.forEach(el => {
                el.addEventListener("click", () => {
                    const uuid = el.dataset.uuid;
                    const clickedItem = displayItems.find(i => i.uuid === uuid);
                    this._onSelectItem(clickedItem, resultsPanel);
                });
            });
        }

        resultsPanel.classList.remove("hidden");
    }

    /**
     * Executes when an item in the search results is clicked.
     * Launches the main marketplace on the correct tab category!
     */
    _onSelectItem(item, resultsPanel) {
        if (!item) return;

        // Dismiss dropdown
        if (resultsPanel) {
            resultsPanel.classList.add("hidden");
        }

        // Clean search input
        const searchInput = this.element.querySelector(".marketshouter-search");
        if (searchInput) {
            searchInput.value = "";
            this.searchQuery = "";
            const clearBtn = this.element.querySelector(".marketshouter-clear-btn");
            if (clearBtn) clearBtn.classList.add("hidden");
        }

        // Determine correct category key for inGameMarketplace
        const categoryKey = this._getCategoryKeyForRawItem(item);
        
        let marketplace = foundry.applications.instances.get("inGameMarketplace");
        if (!marketplace) {
            marketplace = new inGameMarketplace({ 
                initialSearchTerm: item.name,
                shopActorUuid: this.currentShopActorUuid
            });
        } else {
            marketplace.initialSearchTerm = item.name;
            if (this.currentShopActorUuid) {
                marketplace.shopActorUuid = this.currentShopActorUuid;
                marketplace.selectedSource = this.currentShopActorUuid;
            }
        }

        if (categoryKey) {
            marketplace.selectedKey = categoryKey;
        }

        // Open/Render main marketplace
        marketplace.render(true);
    }

    /**
     * Opens the main marketplace app, optionally directly on a specific tab.
     */
    _openMarketplace(tabGroup = "shop") {
        let marketplace = foundry.applications.instances.get("inGameMarketplace");
        if (!marketplace) {
            marketplace = new inGameMarketplace({
                shopActorUuid: this.currentShopActorUuid
            });
        } else {
            if (this.currentShopActorUuid) {
                marketplace.shopActorUuid = this.currentShopActorUuid;
                marketplace.selectedSource = this.currentShopActorUuid;
            }
        }
        marketplace.tabGroups.main = tabGroup;
        marketplace.render(true);
    }

    /**
     * Helper to map raw item type and system data to inGameMarketplace's category keys.
     */
    _getCategoryKeyForRawItem(item) {
        const type = item.type;
        if (type === "weapon") {
            const cat = item.system?.category;
            if (cat === "range") return "rangedWeapons";
            if (cat === "melee") return "meleeWeapons";
            return "rangedWeapons"; // default
        }
        if (type === "modification") {
            const sub = item.system?.type;
            if (sub === "weapon") return "weaponMods";
            if (sub === "armor") return "armorMods";
            if (sub === "vehicle" || sub === "drone") return "vehicleMods";
            return "weaponMods";
        }
        if (type === "adept_power") return "adeptPower";
        if (type === "quality") return "qualitys";
        if (type === "spell") return "spells";
        if (type === "device") return "devices";
        
        if (["armor", "cyberware", "bioware", "equipment", "metamagic", "echo", "complex_form"].includes(type)) {
            return type === "armor" ? "armor" : type === "cyberware" ? "cyberware" : type === "bioware" ? "bioware" : type === "equipment" ? "equipment" : type === "metamagic" ? "metamagic" : type === "echo" ? "echo" : "complex_form";
        }
        return null;
    }

    /**
     * Dynamically calculates and updates the position of the marketshouter capsule bar
     * to prevent it from covering the Foundry sidebar when open or collapsed.
     */
    updatePosition() {
        if (!this.element) return;
        const container = this.element.querySelector(".marketshouter-container");
        if (!container) return;

        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            const sidebarWidth = sidebar.offsetWidth || 0;
            container.style.right = `${sidebarWidth + 8}px`;
        } else {
            const sidebarCollapsed = ui.sidebar?.collapsed ?? true;
            if (sidebarCollapsed) {
                container.style.right = "40px"; // Default fallback (32px sidebar + 8px gap)
            } else {
                container.style.right = "308px"; // Default fallback (300px sidebar + 8px gap)
            }
        }
    }

    /** @override */
    async close(options = {}) {
        if (this._globalClickListener) {
            document.removeEventListener("click", this._globalClickListener);
        }
        if (this._sidebarObserver) {
            this._sidebarObserver.disconnect();
            this._sidebarObserver = null;
        }
        return super.close(options);
    }

    /**
     * Global static initializer that handles rendering the single instance.
     */
    static initialize() {
        let app = foundry.applications.instances.get("marketshouter");
        if (!app) {
            app = new MarketShouterApp();
        }
        app.render(true);
    }
}
