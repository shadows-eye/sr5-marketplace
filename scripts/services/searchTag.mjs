export class SearchService {
    constructor(appElement) {
        this.appElement = appElement;
        this.activeFilters = [];
        this._onSearch = this._onSearch.bind(this);
        this._onTagRemoveClick = this._onTagRemoveClick.bind(this);
    }

    /**
     * Initializes the service.
     * @param {object} selectors
     * @param {string} selectors.searchBox - Selector for the search input.
     * @param {string} selectors.itemsGrid - Selector for the container of item cards.
     * @param {string} selectors.nameSelector - Selector to find the name element within an item card.
     * @param {string} [selectors.tagsContainer] - Optional selector for filter tags.
     */
    initialize({ searchBox, itemsGrid, nameSelector, tagsContainer = null }) {
        this.searchBox = this.appElement.querySelector(searchBox);
        this.itemsGrid = this.appElement.querySelector(itemsGrid);
        this.nameSelector = nameSelector; // <-- Store the name selector
        this.tagsContainer = tagsContainer ? this.appElement.querySelector(tagsContainer) : null;

        if (this.searchBox) {
            this.searchBox.addEventListener("keyup", this._onSearch);
        }
        if (this.tagsContainer) {
            this.tagsContainer.addEventListener("click", this._onTagRemoveClick);
        }
        this.applyFilters();
    }

    _onSearch(event) {
        const searchTerm = this.searchBox.value.trim().toLowerCase();
        if (event.key === "Enter" && this.tagsContainer) {
            event.preventDefault();
            if (searchTerm && !this.activeFilters.includes(searchTerm)) {
                this.activeFilters.push(searchTerm);
            }
            this.searchBox.value = "";
        }
        this.applyFilters();
    }

    _onTagRemoveClick(event) {
        const removeButton = event.target.closest(".remove-tag");
        if (removeButton) {
            const filterToRemove = removeButton.parentElement.dataset.filter;
            this.activeFilters = this.activeFilters.filter(f => f !== filterToRemove);
            this.applyFilters();
        }
    }
    
    clearAllFilters() {
        this.activeFilters = [];
        if (this.searchBox) this.searchBox.value = "";
        this.applyFilters();
    }

    applyFilters() {
        if (!this.itemsGrid || !this.searchBox) return;

        const liveSearchTerm = this.searchBox.value.trim().toLowerCase();

        if (this.tagsContainer) {
            this.tagsContainer.innerHTML = this.activeFilters.map(filter => `
                <div class="filter-tag" data-filter="${filter}">
                    <span>${filter}</span>
                    <span class="remove-tag" title="Remove Filter">&times;</span>
                </div>
            `).join('');
        }

        // Use a more generic selector for the items themselves
        const items = this.itemsGrid.querySelectorAll(".item-card, .marketplace-item");
        for (const item of items) {
            // --- THIS IS THE FIX ---
            // Use the provided nameSelector to find the correct element.
            const nameElement = item.querySelector(this.nameSelector);
            if (nameElement) {
                const itemName = nameElement.textContent.toLowerCase();
                const matchesTags = this.activeFilters.every(filter => itemName.includes(filter));
                const matchesLiveSearch = liveSearchTerm ? itemName.includes(liveSearchTerm) : true;
                item.classList.toggle("hidden", !(matchesTags && matchesLiveSearch));
            }
        }
    }
}