import { SearchService } from "./searchTag.mjs";

/**
 * A specialized SearchService for vehicles and drones.
 * Extends the base SearchService and adds filtering based on name,
 * import category, and drone status.
 */
export class VehicleSearchService extends SearchService {
    /**
     * Filters a list of vehicle/drone items based on search tags and a live query.
     * @param {Array<object>} items - The list of vehicles/drones to filter.
     * @param {Array<string>} tags - The active filter tags.
     * @param {string} query - The live search term.
     * @returns {Array<object>} The filtered list of items.
     */
    static filter(items, tags = [], query = "") {
        if (!items) return [];
        const queryTerm = query.trim().toLowerCase();
        const tagTerms = tags.map(t => t.trim().toLowerCase());

        return items.filter(item => {
            const name = (item.name || "").toLowerCase();
            const matchesQuery = !queryTerm || name.includes(queryTerm);

            // Expanded vehicle/drone tags to match category (e.g. Rotorcraft) and drone/vehicle status
            const category = (item.system?.importFlags?.category || "").toLowerCase();
            const isDrone = item.system?.isDrone || item.system?.isdrone || false;
            const typeText = isDrone ? "drone" : "vehicle";

            const matchesTags = tagTerms.every(tag => {
                return name.includes(tag) || 
                       category.includes(tag) || 
                       typeText.includes(tag);
            });

            return matchesQuery && matchesTags;
        });
    }
}
