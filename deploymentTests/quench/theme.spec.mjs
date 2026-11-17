/**
 * @fileoverview Quench integration tests for UI theme ingestion and dark-mode chat contrast.
 */

function parseRelativeLuminance(rgbString) {
    const match = String(rgbString).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!match) return null;
    const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function getThemeTargets() {
    return [
        { name: "body", el: document.body },
        { name: "#interface", el: document.getElementById("interface") },
        { name: "#chat", el: document.getElementById("chat") }
    ];
}

export function registerThemeBatch(quench) {
    quench.registerBatch(
        "sr5marketplace.theme.chat",
        function (context) {
            const { describe, it, assert, beforeEach, afterEach } = context;
            let originalUiConfig;

            beforeEach(() => {
                originalUiConfig = foundry.utils.deepClone(game.settings.get("core", "uiConfig"));
            });

            afterEach(() => {
                document.querySelector('#chat .chat-log li[data-message-id="__quench_theme_test__"]')?.remove();
                if (originalUiConfig) {
                    game.configureUI(originalUiConfig);
                }
            });

            describe("Theme Ingester (game.configureUI)", () => {
                it("preserves theme-dark and keeps #chat-message editor text light for shadows-theme", () => {
                    game.configureUI({
                        ...originalUiConfig,
                        colorScheme: { applications: "shadows-theme", interface: "shadows-theme" }
                    });

                    for (const { name, el } of getThemeTargets()) {
                        assert.isTrue(el?.classList.contains("theme-dark"), `${name} should retain theme-dark`);
                    }

                    const editorContent = document.querySelector("#chat-message .editor-content");
                    assert.isOk(editorContent, "#chat-message .editor-content should exist");
                    const lum = parseRelativeLuminance(getComputedStyle(editorContent).color);
                    assert.isAbove(lum, 0.5, `#chat-message .editor-content text should be light in shadows-theme (got ${getComputedStyle(editorContent).color})`);
                });

                it("removes stale custom interface theme classes when switching back to core dark", () => {
                    game.configureUI({
                        ...originalUiConfig,
                        colorScheme: { applications: "shadows-theme", interface: "shadows-theme" }
                    });
                    game.configureUI({
                        ...originalUiConfig,
                        colorScheme: { applications: "dark", interface: "dark" }
                    });

                    for (const { name, el } of getThemeTargets()) {
                        assert.isFalse(el?.classList.contains("theme-shadows-theme"), `${name} should not keep stale theme-shadows-theme`);
                    }
                });

                it("applies theme-light and clears theme-dark on body, #interface, and #chat for neon-light", () => {
                    game.configureUI({
                        ...originalUiConfig,
                        colorScheme: { applications: "neon-light", interface: "neon-light" }
                    });

                    for (const { name, el } of getThemeTargets()) {
                        assert.isTrue(el?.classList.contains("theme-light"), `${name} should have theme-light`);
                        assert.isFalse(el?.classList.contains("theme-dark"), `${name} should not have theme-dark`);
                    }
                });
            });

            describe("Chat Log Dark Mode Contrast", () => {
                function mountTestMessage() {
                    const log = document.querySelector("#chat .chat-log");
                    assert.isOk(log, "#chat .chat-log should exist");
                    const li = document.createElement("li");
                    li.className = "chat-message message flexcol";
                    li.setAttribute("data-message-id", "__quench_theme_test__");
                    li.innerHTML = `
                        <header class="message-header flexrow">
                            <h4 class="message-sender">GM</h4>
                        </header>
                        <div class="message-content">
                            <h3>Heading 3</h3>
                            <p>Body text <a class="nue-action">Action Link</a></p>
                            <a class="button">Action Button</a>
                        </div>`;
                    log.appendChild(li);
                    return li;
                }

                for (const scheme of [
                    { applications: "dark", interface: "dark" },
                    { applications: "shadows-theme", interface: "shadows-theme" }
                ]) {
                    it(`renders light text for headings, links, and buttons inside dark .chat-message (${scheme.interface})`, () => {
                        game.configureUI({ ...originalUiConfig, colorScheme: scheme });
                        const li = mountTestMessage();

                        const logLum = parseRelativeLuminance(getComputedStyle(document.querySelector("#chat .chat-log")).color);
                        const h3Lum = parseRelativeLuminance(getComputedStyle(li.querySelector("h3")).color);
                        const pLum = parseRelativeLuminance(getComputedStyle(li.querySelector("p")).color);
                        const linkLum = parseRelativeLuminance(getComputedStyle(li.querySelector("a.nue-action")).color);
                        const btnLum = parseRelativeLuminance(getComputedStyle(li.querySelector("a.button")).color);

                        assert.isAbove(logLum, 0.45, `#chat .chat-log inherited color should not be forced dark (got ${getComputedStyle(document.querySelector("#chat .chat-log")).color})`);
                        assert.isAbove(h3Lum, 0.45, `h3 should be light on dark card (got ${getComputedStyle(li.querySelector("h3")).color})`);
                        assert.isAbove(pLum, 0.45, `p should be light on dark card (got ${getComputedStyle(li.querySelector("p")).color})`);
                        assert.isAbove(linkLum, 0.45, `a.nue-action should be light on dark card (got ${getComputedStyle(li.querySelector("a.nue-action")).color})`);
                        assert.isAbove(btnLum, 0.45, `a.button should be light on dark card (got ${getComputedStyle(li.querySelector("a.button")).color})`);
                    });
                }

                it("keeps dark text on light .chat-message cards when in core light mode", () => {
                    game.configureUI({
                        ...originalUiConfig,
                        colorScheme: { applications: "light", interface: "light" }
                    });
                    const li = mountTestMessage();
                    const h3Lum = parseRelativeLuminance(getComputedStyle(li.querySelector("h3")).color);
                    const pLum = parseRelativeLuminance(getComputedStyle(li.querySelector("p")).color);

                    assert.isBelow(h3Lum, 0.35, `h3 should stay dark in light mode (got ${getComputedStyle(li.querySelector("h3")).color})`);
                    assert.isBelow(pLum, 0.35, `p should stay dark in light mode (got ${getComputedStyle(li.querySelector("p")).color})`);
                });
            });
        },
        { displayName: "SR5 Marketplace: Theme & Chat Contrast" }
    );
}
