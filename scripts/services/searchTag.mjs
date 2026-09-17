import { MarketplaceSettingsService } from "./MarketplaceSettingsService.mjs";

/**
 * A service class to manage the state and DOM interactions for live search
 * and stacked filter tags in the marketplace.
 */
export class SearchService {
    /**
     * @param {HTMLElement} appElement The root element of the application window.
     * @param {Function} onFilterChange Callback triggered when search parameters change.
     */
    constructor(appElement, onFilterChange) {
        this.appElement = appElement;
        this.onFilterChange = onFilterChange; // The callback to filter data
        this.activeFilters = [];

        this._onSearch = this._onSearch.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onTagRemoveClick = this._onTagRemoveClick.bind(this);
        this._onGlobalActionClick = this._onGlobalActionClick.bind(this);
    }

    initialize() {
        this.searchBox = this.appElement.querySelector("#search-box");
        this.tagsContainer = this.appElement.querySelector("#filter-tags-container");

        // Ensure saved global default tags are loaded
        const savedGlobal = MarketplaceSettingsService.getGlobalDefaultFilterTags();
        if (this.activeFilters.length === 0) {
            if (savedGlobal.length > 0) {
                this.activeFilters = [...savedGlobal];
            }
        } else if (!game.user?.isGM) {
            // For players, ensure all active global filters are present
            for (const tag of savedGlobal) {
                if (!this.activeFilters.includes(tag)) {
                    this.activeFilters.push(tag);
                }
            }
        }

        if (this.searchBox) {
            this.searchBox.removeEventListener("keyup", this._onSearch);
            this.searchBox.addEventListener("keyup", this._onSearch);
            this.searchBox.removeEventListener("keydown", this._onKeyDown);
            this.searchBox.addEventListener("keydown", this._onKeyDown);
        }

        if (this.tagsContainer) {
            this.tagsContainer.removeEventListener("click", this._onTagRemoveClick);
            this.tagsContainer.addEventListener("click", this._onTagRemoveClick);
            this.tagsContainer.removeEventListener("click", this._onGlobalActionClick);
            this.tagsContainer.addEventListener("click", this._onGlobalActionClick);
        }

        // Initial render of tags
        this.applyFilters();
    }

    _onKeyDown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
        }
    }

    _onSearch(event) {
        const searchTerm = this.searchBox.value.trim().toLowerCase();

        // If the user presses "Enter", add the term as a permanent filter tag
        if (event.key === "Enter") {
            event.preventDefault();
            if (searchTerm && !this.activeFilters.includes(searchTerm)) {
                this.activeFilters.push(searchTerm);
            }
            // Clear the input box after adding a tag
            this.searchBox.value = "";
        }

        this.applyFilters();
    }

    _onTagRemoveClick(event) {
        const removeButton = event.target.closest(".remove-tag");
        if (removeButton) {
            const filterToRemove = removeButton.parentElement.dataset.filter;
            this.removeFilter(filterToRemove);
        }
    }

    removeFilter(filterTerm) {
        // Global filters can only be removed by the GM, not by players
        if (!game.user?.isGM) {
            const savedGlobal = MarketplaceSettingsService.getGlobalDefaultFilterTags();
            if (savedGlobal.includes(filterTerm)) {
                return;
            }
        }
        this.activeFilters = this.activeFilters.filter(f => f !== filterTerm);
        this.applyFilters();
    }

    clearAllFilters() {
        const savedGlobal = MarketplaceSettingsService.getGlobalDefaultFilterTags();
        if (!game.user?.isGM) {
            // For players, preserve global pills and only clear custom search tags
            this.activeFilters = this.activeFilters.filter(f => savedGlobal.includes(f));
        } else {
            this.activeFilters = [];
        }
        if (this.searchBox) this.searchBox.value = "";
        this.applyFilters();
    }

    _onGlobalActionClick(event) {
        const saveBtn = event.target.closest(".filter-save-global-btn");
        if (saveBtn) {
            event.preventDefault();
            event.stopPropagation();
            MarketplaceSettingsService.setGlobalDefaultFilterTags(this.activeFilters);
            ui.notifications?.info(game.i18n?.localize("SR5Marketplace.UI.FilterSavedGlobal") || "Marketplace global search filter saved.");
            this.applyFilters();
            return;
        }

        const clearBtn = event.target.closest(".filter-clear-global-btn");
        if (clearBtn) {
            event.preventDefault();
            event.stopPropagation();
            MarketplaceSettingsService.setGlobalDefaultFilterTags([]);
            ui.notifications?.info(game.i18n?.localize("SR5Marketplace.UI.FilterClearedGlobal") || "Marketplace global search filter cleared.");
            this.applyFilters();
            return;
        }
    }

    /**
     * Renders the HTML for the active filter tags and triggers the data filter callback.
     */
    applyFilters() {
        if (!this.tagsContainer || !this.searchBox) return;

        const liveSearchTerm = this.searchBox.value.trim().toLowerCase();

        // 1. Render the permanent filter tags (excluding category filters)
        const categoriesToOmit = ["drive", "protection", "weapons", "body", "electronics", "cosmetic"];
        const visibleFilters = this.activeFilters.filter(f => !categoriesToOmit.includes(f));
        const savedGlobal = MarketplaceSettingsService.getGlobalDefaultFilterTags();
        const isGM = Boolean(game.user?.isGM);

        let html = visibleFilters.map(filter => {
            const isGlobal = savedGlobal.includes(filter);
            const canRemove = isGM || !isGlobal;

            const removeBtn = canRemove
                ? `<span class="remove-tag" title="${game.i18n?.localize("SR5Marketplace.UI.RemoveFilter") || "Remove Filter"}">&times;</span>`
                : '';
            const globalIcon = isGlobal
                ? `<i class="fa-solid fa-earth-americas global-tag-icon" title="${game.i18n?.localize("SR5Marketplace.UI.GlobalFilterLocked") || "Global Default Filter"}"></i>`
                : '';

            return `
                <div class="filter-tag ${isGlobal ? 'is-global' : ''}" data-filter="${filter}">
                    ${globalIcon}
                    <span>${filter}</span>
                    ${removeBtn}
                </div>
            `;
        }).join('');

        // 2. If GM, render inline "Save Global" and "Clear Global" buttons
        if (game.user?.isGM) {
            const savedGlobal = MarketplaceSettingsService.getGlobalDefaultFilterTags();
            if (visibleFilters.length > 0) {
                const saveLabel = game.i18n?.localize("SR5Marketplace.UI.SaveGlobalFilter") || "Save Global";
                const saveTooltip = game.i18n?.localize("SR5Marketplace.UI.SaveGlobalFilterTooltip") || "Save as default global marketplace filter";
                html += `
                    <button type="button" class="filter-save-global-btn" title="${saveTooltip}">
                        <i class="fa-solid fa-floppy-disk"></i>
                        <span>${saveLabel}</span>
                    </button>
                `;
            }
            if (savedGlobal.length > 0) {
                const clearLabel = game.i18n?.localize("SR5Marketplace.UI.ClearGlobalFilter") || "Clear Global";
                const clearTooltip = game.i18n?.localize("SR5Marketplace.UI.ClearGlobalFilterTooltip") || "Clear saved global default filter";
                html += `
                    <button type="button" class="filter-clear-global-btn" title="${clearTooltip}">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>${clearLabel}</span>
                    </button>
                `;
            }
        }

        this.tagsContainer.innerHTML = html;

        // 3. Pass parameters to the callback
        if (typeof this.onFilterChange === "function") {
            this.onFilterChange(this.activeFilters, liveSearchTerm);
        }
    }
}