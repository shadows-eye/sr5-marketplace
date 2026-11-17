/**
 * @summary A service to synchronize the theme of a custom application with the core Foundry UI.
 */
export class ThemeService {
    static CUSTOM_THEME_CLASSES = [
        "shadows-theme",
        "theme-shadows",
        "theme-shadows-theme",
        "theme-neon",
        "theme-neon-light",
        "theme-silicon"
    ];

    static ALL_THEME_CLASSES = [
        ...ThemeService.CUSTOM_THEME_CLASSES,
        "theme-light",
        "theme-dark"
    ];

    static CUSTOM_THEME_BASE_CLASS = {
        "shadows-theme": "theme-dark",
        "shadows": "theme-dark",
        "neon": "theme-dark",
        "neon-light": "theme-light",
        "silicon": "theme-light"
    };

    /**
     * Normalize a Foundry/module theme identifier or class name to the CSS class used by Marketplace windows.
     * @param {string} themeName
     * @returns {string}
     */
    static normalizeThemeClass(themeName) {
        if (themeName === "shadows-theme" || themeName === "shadows" || themeName === "theme-shadows-theme" || themeName === "theme-shadows") {
            return "shadows-theme";
        }
        return themeName.startsWith("theme-") ? themeName : `theme-${themeName}`;
    }

    /**
     * Collect core UI interface targets themed by Foundry's `configureUI` (plus `#chat` fallback).
     * @returns {HTMLElement[]}
     */
    static getInterfaceThemeTargets() {
        const targets = new Set();
        const interfaceEl = document.getElementById("interface");
        if (interfaceEl) targets.add(interfaceEl);
        const chatEl = document.getElementById("chat");
        if (chatEl) targets.add(chatEl);

        if (typeof foundry !== "undefined" && foundry.applications?.instances) {
            const sidebarTabCls = foundry.applications.sidebar?.AbstractSidebarTab;
            const compendiumCls = foundry.applications.sidebar?.apps?.Compendium;
            const cameraViewsCls = foundry.applications.apps?.av?.CameraViews;
            const cameraPopoutCls = foundry.applications.apps?.av?.CameraPopout;
            const hudCls = foundry.applications.hud?.BasePlaceableHUD;

            for (const app of foundry.applications.instances.values()) {
                const isInterfaceApp =
                    (sidebarTabCls && app instanceof sidebarTabCls)
                    || (compendiumCls && app instanceof compendiumCls)
                    || (cameraViewsCls && app instanceof cameraViewsCls)
                    || (cameraPopoutCls && app instanceof cameraPopoutCls)
                    || (hudCls && app instanceof hudCls);
                if (!isInterfaceApp) continue;
                if (app.options?.classes?.includes("themed")) continue;
                if (app.element) targets.add(app.element);
            }
        }

        return Array.from(targets);
    }

    /**
     * Remove stale custom theme classes injected by prior `configureUI` runs.
     */
    static clearCustomInterfaceClasses() {
        if (document.body) {
            document.body.classList.remove(...ThemeService.CUSTOM_THEME_CLASSES);
        }
        for (const el of ThemeService.getInterfaceThemeTargets()) {
            el.classList.remove(...ThemeService.CUSTOM_THEME_CLASSES);
        }
    }

    /**
     * Apply the underlying core `theme-dark` or `theme-light` class onto custom-themed elements
     * so Foundry core CSS tokens (such as `--color-text-primary` on `#chat-message`) stay consistent.
     * @param {object} [config]
     */
    static syncCustomInterfaceThemes(config) {
        const resolvedConfig = config || game.settings?.get?.("core", "uiConfig");
        const appBase = ThemeService.CUSTOM_THEME_BASE_CLASS[resolvedConfig?.colorScheme?.applications];
        if (appBase && document.body) {
            document.body.classList.remove("theme-light", "theme-dark");
            document.body.classList.add(appBase);
        }

        const uiBase = ThemeService.CUSTOM_THEME_BASE_CLASS[resolvedConfig?.colorScheme?.interface];
        if (uiBase) {
            for (const el of ThemeService.getInterfaceThemeTargets()) {
                el.classList.remove("theme-light", "theme-dark");
                el.classList.add(uiBase);
            }
        }
    }

    /**
     * Applies a theme class to a target element based on the document's sheet theme
     * configuration or the global theme.
     *
     * @param {string} sourceSelector - The CSS selector for the source element (e.g., '#actors', '#settings').
     * @param {HTMLElement} targetElement - The DOM element of your application window to apply the theme to.
     * @param {ClientDocument} [doc] - Optional document instance associated with this sheet.
     */
    static applyTheme(sourceSelector, targetElement, doc = null) {
        if (!targetElement) {
            console.warn("ThemeService | Target element not found.", { targetElement });
            return;
        }

        let theme = null;

        // 1. Check for document-specific sheet theme override first
        if (doc && typeof foundry !== "undefined" && foundry.applications?.apps?.DocumentSheetConfig) {
            try {
                const sheetTheme = foundry.applications.apps.DocumentSheetConfig.getSheetThemeForDocument(doc);
                if (sheetTheme) {
                    theme = ThemeService.normalizeThemeClass(sheetTheme);
                }
            } catch (err) {
                console.warn("ThemeService | Failed to read document sheet theme:", err);
            }
        }

        // 2. If no document-specific override, check the source element for the active global theme
        if (!theme && sourceSelector) {
            const source = window.document.querySelector(sourceSelector);
            if (source) {
                for (const cls of ThemeService.ALL_THEME_CLASSES) {
                    if (source.classList.contains(cls)) {
                        theme = ThemeService.normalizeThemeClass(cls);
                        break;
                    }
                }
            }
        }

        // 3. Fallback to core UI config color scheme if still not determined
        if (!theme) {
            try {
                const uiConfig = game.settings.get("core", "uiConfig");
                const themeValue = uiConfig?.colorScheme?.applications;
                if (themeValue && themeValue !== "light" && themeValue !== "dark") {
                    theme = ThemeService.normalizeThemeClass(themeValue);
                } else {
                    theme = "shadows-theme"; // Default theme for marketplace suite
                }
            } catch (err) {
                console.warn("ThemeService | Failed to read core uiConfig setting:", err);
                theme = "shadows-theme"; // Final fallback
            }
        }

        // Apply theme class safely
        targetElement.classList.remove(...ThemeService.ALL_THEME_CLASSES);
        targetElement.classList.add(theme);
    }
}