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
        this._onTagRemoveClick = this._onTagRemoveClick.bind(this);
    }

    initialize() {
        this.searchBox = this.appElement.querySelector("#search-box");
        this.tagsContainer = this.appElement.querySelector("#filter-tags-container");

        if (this.searchBox) {
            this.searchBox.removeEventListener("keyup", this._onSearch);
            this.searchBox.addEventListener("keyup", this._onSearch);
        }
        
        if (this.tagsContainer) {
            this.tagsContainer.removeEventListener("click", this._onTagRemoveClick);
            this.tagsContainer.addEventListener("click", this._onTagRemoveClick);
        }
        
        // Initial render of tags
        this.applyFilters();
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
        this.activeFilters = this.activeFilters.filter(f => f !== filterTerm);
        this.applyFilters();
    }
    
    clearAllFilters() {
        this.activeFilters = [];
        if (this.searchBox) this.searchBox.value = "";
        this.applyFilters();
    }

    /**
     * Renders the HTML for the active filter tags and triggers the data filter callback.
     */
    applyFilters() {
        if (!this.tagsContainer || !this.searchBox) return;

        const liveSearchTerm = this.searchBox.value.trim().toLowerCase();

        // 1. Render the permanent filter tags
        this.tagsContainer.innerHTML = this.activeFilters.map(filter => `
            <div class="filter-tag" data-filter="${filter}">
                <span>${filter}</span>
                <span class="remove-tag" title="Remove Filter">&times;</span>
            </div>
        `).join('');

        // 2. Instead of filtering the DOM, we pass the parameters to the App!
        if (typeof this.onFilterChange === "function") {
            this.onFilterChange(this.activeFilters, liveSearchTerm);
        }
    }
}