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
        if (!targetElement) {
            console.warn("ThemeService | Target element not found.", { targetElement });
            return;
        }

        const source = sourceSelector ? document.querySelector(sourceSelector) : null;
        let theme = null;

        if (source) {
            if (source.classList.contains("theme-dark")) theme = "theme-dark";
            else if (source.classList.contains("theme-light")) theme = "theme-light";
        }

        // Fallback to core UI config color scheme
        if (!theme) {
            try {
                const uiConfig = game.settings.get("core", "uiConfig");
                const themeValue = uiConfig?.colorScheme.applications;
                theme = themeValue === "dark" ? "theme-dark" : "theme-light";
            } catch (err) {
                console.warn("ThemeService | Failed to read core uiConfig setting:", err);
                theme = "theme-light"; // Final fallback
            }
        }

        if (theme === "theme-dark") {
            targetElement.classList.remove("theme-light");
            targetElement.classList.add("theme-dark");
        } else {
            targetElement.classList.remove("theme-dark");
            targetElement.classList.add("theme-light");
        }
    }
}