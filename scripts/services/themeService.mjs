/**
 * @summary A service to synchronize the theme of a custom application with the core Foundry UI.
 */
export class ThemeService {
    /**
     * Applies a 'theme-light' or 'theme-dark' class to a target element based on the
     * classes present on a source element.
     *
     * @param {string} sourceSelector - The CSS selector for the source element (e.g., '#actors', '#settings').
     * @param {HTMLElement} targetElement - The DOM element of your application window to apply the theme to.
     *
     * @example
     * // In an ApplicationV2's _onRender method:
     * ThemeService.applyTheme("#actors", this.element);
     */
    static applyTheme(sourceSelector, targetElement) {
        // Find the source element in the main document
        const source = document.querySelector(sourceSelector);
        
        // Ensure both elements exist before proceeding
        if (!source || !targetElement) {
            console.warn("ThemeService | Source or target element not found.", { sourceSelector, targetElement });
            return;
        }

        // Check for the dark theme and apply it
        if (source.classList.contains("theme-dark")) {
            targetElement.classList.remove("theme-light");
            targetElement.classList.add("theme-dark");
        } 
        // Otherwise, check for the light theme and apply it
        else if (source.classList.contains("theme-light")) {
            targetElement.classList.remove("theme-dark");
            targetElement.classList.add("theme-light");
        }
    }
}