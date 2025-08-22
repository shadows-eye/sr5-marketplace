/**
 * @summary A helper class to manage lists of objects with `name` and `value` properties.
 * @description This class is specifically designed to build and manage the components of a dice pool for display in a dialog. It provides a simple interface for managing an array of objects, where each object represents a component of a larger value. It ensures the underlying data is always an array and provides methods for adding and clearing parts.
 *
 * @example
 * // Create a new, empty list
 * const myList = new DialogList();
 *
 * // Add parts to the list
 * myList.addPart('Negotiation Skill', 6);
 * myList.addPart('Charisma Attribute', 5);
 * // At this point, the internal list is:
 * // [{ name: 'Negotiation Skill', value: 6 }, { name: 'Charisma Attribute', value: 5 }]
 *
 * // Clear the list
 * myList.clear();
 * // The internal list is now: []
 *
 * // Create a list with initial parts
 * const initialData = [{ name: 'Wound Modifier', value: -1 }];
 * const prefilledList = new DialogList(initialData);
 * // The internal list is: [{ name: 'Wound Modifier', value: -1 }]
 */
export class DialogList {
    /**
     * The internal array holding the list of parts.
     * @type {Array<{name: string, value: *}>}
     * @private
     */
    _list;

    /**
     * @param {Array<{name: string, value: *}>} [parts=[]] - An optional initial array of part objects. Each object must have a `name` and `value` property.
     */
    constructor(parts = []) {
        // Ensure we are working with a valid array.
        this._list = Array.isArray(parts) ? parts : [];
    }

    /**
     * Adds a new part to the list.
     * @param {string} name  - The display label for the part (e.g., "Charisma").
     * @param {*}      value - The value of the part (e.g., 5).
     * @returns {void}
     */
    addPart(name, value) {
        this._list.push({ name, value });
    }

    /**
     * Removes all parts from the list, resetting it to an empty array.
     * @returns {void}
     */
    clear() {
        this._list.length = 0;
    }
}