/**
 * @typedef {object} DeliveryTime
 * @property {number} value - The numeric value of the time.
 * @property {string} unit - The unit of time (e.g., 'hours', 'days', 'week', 'month').
 */

/**
 * @summary A helper service for calculating item delivery times based on cost.
 */
export class DeliveryTimeService {
    /**
     * @summary Gets the base delivery time for a given total cost.
     * @param {number} totalCost - The total cost of the items in Nuyen.
     * @returns {DeliveryTime} An object representing the base delivery time.
     */
    static getBaseDeliveryTime(totalCost) {
        if (totalCost <= 100) {
            return { value: 6, unit: "SR5Marketplace.Marketplace.Time.Hours" };
        } else if (totalCost <= 1000) {
            return { value: 1, unit: "SR5Marketplace.Marketplace.Time.Day" };
        } else if (totalCost <= 10000) {
            return { value: 2, unit: "SR5Marketplace.Marketplace.Time.Days" };
        } else if (totalCost <= 100000) {
            return { value: 1, unit: "SR5Marketplace.Marketplace.Time.Week" };
        } else {
            return { value: 1, unit: "SR5Marketplace.Marketplace.Time.Month" };
        }
    }

    /**
     * @summary Calculates the final delivery time.
     * @description This is the base time multiplied by the number of rolls it took to succeed.
     * @param {DeliveryTime} baseTime - The base delivery time object.
     * @param {number} rollCount - The number of rolls made.
     * @returns {DeliveryTime} An object representing the final delivery time.
     */
    static calculateFinalDeliveryTime(baseTime, rollCount) {
        // For simplicity, we'll keep the units the same and just multiply the value.
        // You could add more complex logic here to convert hours to days, etc.
        return {
            value: baseTime.value * rollCount,
            unit: baseTime.unit
        };
    }
}