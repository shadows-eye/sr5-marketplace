/**
 * A service class to manage the state and DOM interactions for live search
 * and stacked filter tags in the marketplace.
 */
export class SearchService {
    /**
     * @param {HTMLElement} appElement The root element of the application window.
     */
    constructor(appElement) {
        this.appElement = appElement;
        this.activeFilters = [];
        
        // Bind the context of 'this' for the event handlers
        this._onSearch = this._onSearch.bind(this);
        this._onTagRemoveClick = this._onTagRemoveClick.bind(this);
    }

    /**
     * Initializes the service by finding the necessary DOM elements and attaching listeners.
     */
    initialize() {
        this.searchBox = this.appElement.querySelector("#search-box");
        this.tagsContainer = this.appElement.querySelector("#filter-tags-container");
        this.itemsGrid = this.appElement.querySelector("#marketplace-items");

        if (this.searchBox) {
            // Use 'keyup' to react after the input value has changed
            this.searchBox.removeEventListener("keyup", this._onSearch);
            this.searchBox.addEventListener("keyup", this._onSearch);
        }
        
        if (this.tagsContainer) {
            this.tagsContainer.removeEventListener("click", this._onTagRemoveClick);
            this.tagsContainer.addEventListener("click", this._onTagRemoveClick);
        }
        
        // Initial render of tags and application of filters
        this.applyFilters();
    }

    /**
     * Handles the keyup event on the search input. It adds a filter on "Enter"
     * and live-searches on every key press.
     * @param {KeyboardEvent} event
     */
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
        
        // In all cases, apply the filters to update the view
        this.applyFilters();
    }

    /**
     * Handles clicks within the tags container to remove a filter.
     * @param {PointerEvent} event
     */
    _onTagRemoveClick(event) {
        const removeButton = event.target.closest(".remove-tag");
        if (removeButton) {
            const filterToRemove = removeButton.parentElement.dataset.filter;
            this.removeFilter(filterToRemove);
        }
    }

    /**
     * Removes a filter from the active list and updates the view.
     * @param {string} filterTerm The filter term to remove.
     */
    removeFilter(filterTerm) {
        this.activeFilters = this.activeFilters.filter(f => f !== filterTerm);
        this.applyFilters();
    }
    
    /**
     * Clears all active filters.
     */
    clearAllFilters() {
        this.activeFilters = [];
        // Also clear the text in the search box
        if (this.searchBox) {
            this.searchBox.value = "";
        }
        this.applyFilters();
    }

    /**
     * Renders the HTML for the active filter tags and applies the filtering
     * logic to the item cards in the DOM.
     */
    applyFilters() {
        if (!this.tagsContainer || !this.itemsGrid || !this.searchBox) return;

        // Get the current live search term (what the user is currently typing)
        const liveSearchTerm = this.searchBox.value.trim().toLowerCase();

        // 1. Render the permanent filter tags
        this.tagsContainer.innerHTML = this.activeFilters.map(filter => `
            <div class="filter-tag" data-filter="${filter}">
                <span>${filter}</span>
                <span class="remove-tag" title="Remove Filter">&times;</span>
            </div>
        `).join('');

        // 2. Apply the filters to the item list
        const items = this.itemsGrid.querySelectorAll(".marketplace-item.grid-item, .item-card");
        for (const item of items) {
            const nameElement = item.querySelector("h4.item-name, h4.marketplace_h4");
            if (nameElement) {
                const itemName = nameElement.textContent.toLowerCase();
                
                // An item is visible if it matches ALL tag filters AND the live search term
                const matchesTags = this.activeFilters.every(filter => itemName.includes(filter));
                const matchesLiveSearch = liveSearchTerm ? itemName.includes(liveSearchTerm) : true;

                if (matchesTags && matchesLiveSearch) {
                    item.classList.remove("hidden");
                } else {
                    item.classList.add("hidden");
                }
            }
        }
    }
}