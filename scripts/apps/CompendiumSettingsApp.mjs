import { MarketplaceSettingsService } from "../services/MarketplaceSettingsService.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * An ApplicationV2 mini-app allowing the GM to configure which compendiums
 * and world items are accessible to players and the Global Marketplace.
 */
export class CompendiumSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options = {}) {
        options.classes = [...(options.classes || []), "sr5", "themed", "sr5-marketplace", "compendium-settings-window"];
        super(options);

        this.searchQuery = "";
        this.enabledMap = null; // Map<string, boolean>
        this.allowWorldItems = MarketplaceSettingsService.isWorldItemsAllowed();
        this._compendiumsCache = null;
    }

    /** @override */
    static PARTS = {
        main: {
            id: "body",
            template: "modules/sr5-marketplace/templates/apps/marketplace-settings/compendium-settings.html",
            scrollable: [
                ".compendiums-card-grid",
                ".compendium-settings-content"
            ]
        }
    };

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "sr5-marketplace-compendium-settings",
            position: { width: 840, height: 680 },
            window: {
                title: "SR5Marketplace.CompendiumSettings.WindowTitle",
                resizable: true,
                minimizable: true
            },
            actions: {
                selectAll: CompendiumSettingsApp.#onSelectAll,
                deselectAll: CompendiumSettingsApp.#onDeselectAll,
                save: CompendiumSettingsApp.#onSave,
                cancel: CompendiumSettingsApp.#onCancel
            }
        }, { inplace: false });
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        if (!this._compendiumsCache) {
            this._compendiumsCache = await MarketplaceSettingsService.getEnrichedCompendiumList();
        }

        // Initialize state map if not yet created
        if (!this.enabledMap) {
            this.enabledMap = new Map();
            for (const pack of this._compendiumsCache) {
                this.enabledMap.set(pack.id, pack.enabled);
            }
        }

        // Filter and map compendiums with current in-memory toggle state
        const query = (this.searchQuery || "").trim().toLowerCase();
        const mapped = this._compendiumsCache.map(pack => ({
            ...pack,
            enabled: this.enabledMap.has(pack.id) ? this.enabledMap.get(pack.id) : pack.enabled
        }));

        const filtered = query
            ? mapped.filter(p => p.title.toLowerCase().includes(query) || p.package.toLowerCase().includes(query) || p.id.toLowerCase().includes(query))
            : mapped;

        let activeCount = 0;
        for (const isEnabled of this.enabledMap.values()) {
            if (isEnabled) activeCount++;
        }

        context.compendiums = filtered;
        context.allowWorldItems = this.allowWorldItems;
        context.searchQuery = this.searchQuery;
        context.totalCount = mapped.length;
        context.activeCount = activeCount;

        return context;
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        // Search input
        const searchInput = this.element.querySelector(".compendium-search-input");
        if (searchInput) {
            searchInput.removeEventListener("input", this._onSearchInput);
            searchInput.addEventListener("input", this._onSearchInput);
        }

        // Individual compendium toggles
        const compendiumToggles = this.element.querySelectorAll(".compendium-toggle");
        for (const toggle of compendiumToggles) {
            toggle.removeEventListener("change", this._onCompendiumToggle);
            toggle.addEventListener("change", this._onCompendiumToggle);
        }

        // World items toggle
        const worldToggle = this.element.querySelector(".world-items-toggle");
        if (worldToggle) {
            worldToggle.removeEventListener("change", this._onWorldToggle);
            worldToggle.addEventListener("change", this._onWorldToggle);
        }
    }

    /**
     * Handles live searching across compendium cards in DOM.
     * @private
     */
    _onSearchInput = (event) => {
        this.searchQuery = event.target.value || "";
        const query = this.searchQuery.toLowerCase().trim();
        const cards = this.element.querySelectorAll(".compendium-card[data-pack-id]");

        for (const card of cards) {
            const title = (card.dataset.title || "").toLowerCase();
            const pkg = (card.dataset.package || "").toLowerCase();
            const packId = (card.dataset.packId || "").toLowerCase();

            if (!query || title.includes(query) || pkg.includes(query) || packId.includes(query)) {
                card.style.display = "";
            } else {
                card.style.display = "none";
            }
        }
    };

    /**
     * Toggles inclusion of an individual compendium.
     * @private
     */
    _onCompendiumToggle = (event) => {
        const packId = event.target.dataset.packId;
        if (!packId) return;

        const isChecked = event.target.checked;
        this.enabledMap.set(packId, isChecked);

        const card = event.target.closest(".compendium-card");
        if (card) {
            if (isChecked) card.classList.add("enabled");
            else card.classList.remove("enabled");
        }

        this._updateActiveCount();
    };

    /**
     * Toggles inclusion of world items.
     * @private
     */
    _onWorldToggle = (event) => {
        this.allowWorldItems = event.target.checked;
        const card = event.target.closest(".compendium-card");
        if (card) {
            if (this.allowWorldItems) card.classList.add("enabled");
            else card.classList.remove("enabled");
        }
    };

    /**
     * Updates active count badge in footer without re-rendering the whole DOM.
     * @private
     */
    _updateActiveCount() {
        let activeCount = 0;
        for (const isEnabled of this.enabledMap.values()) {
            if (isEnabled) activeCount++;
        }
        const badge = this.element.querySelector(".active-count");
        if (badge) badge.textContent = activeCount;
    }

    /**
     * Action: Select all compendiums.
     */
    static #onSelectAll(event, target) {
        if (!this.enabledMap) return;
        for (const packId of this.enabledMap.keys()) {
            this.enabledMap.set(packId, true);
        }

        const checkboxes = this.element.querySelectorAll(".compendium-toggle");
        for (const cb of checkboxes) {
            cb.checked = true;
            const card = cb.closest(".compendium-card");
            if (card) card.classList.add("enabled");
        }

        this._updateActiveCount();
    }

    /**
     * Action: Deselect all compendiums.
     */
    static #onDeselectAll(event, target) {
        if (!this.enabledMap) return;
        for (const packId of this.enabledMap.keys()) {
            this.enabledMap.set(packId, false);
        }

        const checkboxes = this.element.querySelectorAll(".compendium-toggle");
        for (const cb of checkboxes) {
            cb.checked = false;
            const card = cb.closest(".compendium-card");
            if (card) card.classList.remove("enabled");
        }

        this._updateActiveCount();
    }

    /**
     * Action: Save configuration.
     */
    static async #onSave(event, target) {
        if (!this.enabledMap) return;

        const allowedIds = [];
        for (const [packId, isEnabled] of this.enabledMap.entries()) {
            if (isEnabled) allowedIds.push(packId);
        }

        await MarketplaceSettingsService.setAllowedCompendiums(allowedIds);
        await MarketplaceSettingsService.setWorldItemsAllowed(this.allowWorldItems);

        ui.notifications.info(game.i18n.localize("SR5Marketplace.CompendiumSettings.SavedNotification"));
        this.close();
    }

    /**
     * Action: Cancel and close without saving.
     */
    static #onCancel(event, target) {
        this.close();
    }
}
