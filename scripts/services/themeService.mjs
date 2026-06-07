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
    /**
     * Applies a theme class to a target element based on the document's sheet theme
     * configuration or the global theme.
     *
     * @param {string} sourceSelector - The CSS selector for the source element (e.g., '#actors', '#settings').
     * @param {HTMLElement} targetElement - The DOM element of your application window to apply the theme to.
     * @param {ClientDocument} [document] - Optional document instance associated with this sheet.
     *
     * @example
     * // In an ApplicationV2's _onRender method:
     * ThemeService.applyTheme("#actors", this.element, this.document);
     */
    static applyTheme(sourceSelector, targetElement, doc = null) {
        if (!targetElement) {
            console.warn("ThemeService | Target element not found.", { targetElement });
            return;
        }

        let theme = null;
        const themeClasses = ["theme-light", "theme-dark", "theme-neon", "theme-neon-light", "theme-silicon"];

        // 1. Check for document-specific sheet theme override first
        if (doc && typeof foundry !== "undefined" && foundry.applications?.apps?.DocumentSheetConfig) {
            try {
                const sheetTheme = foundry.applications.apps.DocumentSheetConfig.getSheetThemeForDocument(doc);
                if (sheetTheme) {
                    theme = `theme-${sheetTheme}`;
                }
            } catch (err) {
                console.warn("ThemeService | Failed to read document sheet theme:", err);
            }
        }

        // 2. If no document-specific override, check the source element for the active global theme
        if (!theme && sourceSelector) {
            const source = window.document.querySelector(sourceSelector);
            if (source) {
                for (const cls of themeClasses) {
                    if (source.classList.contains(cls)) {
                        theme = cls;
                        break;
                    }
                }
            }
        }

        // 3. Fallback to core UI config color scheme if still not determined
        if (!theme) {
            try {
                const uiConfig = game.settings.get("core", "uiConfig");
                const themeValue = uiConfig?.colorScheme.applications || "light";
                theme = `theme-${themeValue}`;
            } catch (err) {
                console.warn("ThemeService | Failed to read core uiConfig setting:", err);
                theme = "theme-light"; // Final fallback
            }
        }

        // Apply theme class safely
        for (const cls of themeClasses) {
            targetElement.classList.remove(cls);
        }
        targetElement.classList.add(theme);
    }
}