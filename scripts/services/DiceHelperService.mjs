/**
 * @summary A helper service for preparing dice roll results for rendering.
 */
export class DiceHelperService {
    /**
     * @summary Processes a test result object to prepare dice for rendering.
     * @description This method takes the `result` object from the flag, extracts the
     * dice rolls and glitch count, and returns an array of objects ready for styling.
     *
     * @param {object} result - The `result` object from the flag's test state.
     * @returns {Array<{cssClass: string, text: string}>} An array of dice ready for rendering.
     */
    static processDice(result) {
        // 1. Safely get the dice results and glitch count from the result object.
        const diceResults = result?.diceResults || [];
        const glitches = result?.values?.glitches?.value || 0;
        
        if (!Array.isArray(diceResults) || diceResults.length === 0) return [];

        // 2. Determine if the roll was a glitch.
        const isGlitch = glitches > (diceResults.length / 2);

        // 3. Map over the dice to create the rendering data.
        return diceResults.map(die => {
            let cssClass = 'MarketAppDialog-die-result';
            
            if (isGlitch && die.result === 1) {
                // Highlight the 1s that caused the glitch.
                cssClass = ' glitch';
            } else if (die.success) {
                cssClass = ' success';
            } else {
                cssClass = ' failure';
            }
            
            return {
                cssClass: cssClass,
                text: die.result
            };
        });
    }
}