// scripts/tests/AvailabilityTest.mjs
// v13 — Use the system's SuccessTest flow (dialog + chat message are handled by the base class).
// We ONLY compute dice pools/limits and feed them into SuccessTest. No ChatMessage.create here.

export class AvailabilityTest extends game.shadowrun5e.tests.SuccessTest {
  constructor(actor, options = {}) {
    super(actor, options);
    this.availability = options.availability ?? ""; // e.g. "12F", "10R", "8", "12E", "10V"
  }

  /** Use your custom DialogV2 template */
  get _dialogTemplate() {
    return "modules/sr5-marketplace/templates/tests/availability-test-dialog.html";
  }

  /** Label key for i18n */
  static get label() {
    return "SR5.Marketplace.Tests.AvailabilityTest";
  }

  /* ----------------------- helpers (safe against SR5 impl) ----------------------- */

  static parseAvailability(str) {
    const m = String(str ?? "").trim().match(/^(\d+)\s*([A-Za-z]*)$/);
    return {
      rating: m ? Number(m[1]) : 0,
      tag: m && m[2] ? m[2].toUpperCase() : ""
    };
  }

  async _getAttr(actor, key) {
    // Prefer SR5 API
    try {
      const v = await actor.getAttribute?.(key);
      if (typeof v === "number") return v;
      if (v && typeof v === "object") return Number(v.value ?? v.total ?? v.base ?? 0) || 0;
    } catch (_) {}
    // Fallbacks (cha/wil/essence names vary by systems)
    const altKey = key.slice(0, 3);
    const p = foundry.utils.getProperty(actor, `system.attributes.${key}`) ??
              foundry.utils.getProperty(actor, `system.attributes.${altKey}`);
    return Number(p?.value ?? p ?? 0) || 0;
  }

  async _getSkill(actor, key) {
    try {
      const s = await actor.getSkill?.(key);
      if (typeof s === "number") return s;
      if (s && typeof s === "object") return Number(s.value ?? s.rating ?? s.total ?? 0) || 0;
    } catch (_) {}
    const p = foundry.utils.getProperty(actor, `system.skills.active.${key}`);
    return Number(p?.value ?? p?.rating ?? 0) || 0;
  }

  async _getLimit(actor, key) {
    try {
      const l = await actor.getLimit?.(key);
      if (typeof l === "number") return l;
      if (l && typeof l === "object") return Number(l.value ?? l.total ?? 0) || 0;
    } catch (_) {}
    if (key === "social") {
      // Conservative fallback: floor((2*CHA + WIL + ESS)/3)
      const cha = await this._getAttr(actor, "charisma");
      const wil = await this._getAttr(actor, "willpower");
      const essRaw = foundry.utils.getProperty(actor, "system.attributes.essence") ??
                     foundry.utils.getProperty(actor, "system.essence");
      const ess = Number(essRaw?.value ?? essRaw ?? 0) || 0;
      return Math.floor((2 * cha + wil + ess) / 3);
    }
    return 0;
  }

  /**
   * Compute pools and push them into the SuccessTest options the way the system expects.
   * We DO NOT roll or post here—SuccessTest handles that.
   */
  async _computeAndApplyOptions() {
    const { rating: itemPool } = this.constructor.parseAvailability(this.availability);

    // Actor side: Charisma + Negotiation (capped by Social limit)
    const cha = await this._getAttr(this.actor, "charisma");
    const neg = await this._getSkill(this.actor, "negotiation");
    const socialLimit = await this._getLimit(this.actor, "social");
    const actorPool = Math.max(0, cha + neg);

    // Feed every common field name that SuccessTest implementations tend to check.
    // (This makes us resilient across minor system updates.)
    this.options.pool = actorPool;
    this.options.dicePool = actorPool;
    this.options.limit = socialLimit;

    // Opposed: Availability as the opposing pool
    this.options.opposition = { label: "Availability", pool: itemPool };
    this.options.oppositionPool = itemPool;

    // Optional: a label/notes shown on the chat card, if the system merges this into card data
    this.options.notes = [
      { label: "Availability", value: this.availability },
      { label: "Opposition Pool", value: String(itemPool) }
    ];
  }

  /* ----------------------- dialog wiring into base flow ----------------------- */

  /**
   * If the base class queries dialog data, give it our availability field.
   * Different SR5 versions use different hook names; support both patterns.
   */
  async _getDialogData(...args) {
    const base = typeof super._getDialogData === "function" ? await super._getDialogData(...args) : {};
    return { ...base, availability: this.availability, actor: this.actor };
  }
  async _prepareDialogContext(...args) {
    const base = typeof super._prepareDialogContext === "function" ? await super._prepareDialogContext(...args) : {};
    return { ...base, availability: this.availability, actor: this.actor };
  }

  /**
   * If the base class lets us validate or read dialog form values before rolling,
   * use one of these hooks. We keep both for compatibility; whichever exists will run.
   */
  async _onDialogSubmit(htmlOrEl) {
    const root = htmlOrEl instanceof HTMLElement ? htmlOrEl : (htmlOrEl?.[0] ?? null);
    const input = root?.querySelector?.('input[name="availability"]');
    if (input?.value) this.availability = input.value.trim();
    if (typeof super._onDialogSubmit === "function") return super._onDialogSubmit(htmlOrEl);
  }
  async _onDialogClose(...args) {
    // Some base impls only give us close; read the form if still present
    const form = document.querySelector("#availability-test-form");
    const input = form?.querySelector?.('input[name="availability"]');
    if (input?.value) this.availability = input.value.trim();
    if (typeof super._onDialogClose === "function") return super._onDialogClose(...args);
  }

  /**
   * Final hook before executing the roll. We compute pools and hand them to the base class.
   * Then we call the base `roll()` which handles dice, limits, opposed logic, and chat output.
   */
  async roll(...args) {
    await this._computeAndApplyOptions();
    return super.roll?.(...args);
  }

  /**
   * If your system uses `execute()` as the main entry, keep it and let base post chat.
   * We only ensure options are set before the base flow resumes.
   */
  async execute(...args) {
    // Some base flows compute after dialog; to be safe, compute both here and in roll()
    await this._computeAndApplyOptions();
    return super.execute?.(...args);
  }

  /* ----------------------- convenience runner + registrar ----------------------- */

  static async run(actorRef, availabilityStr = "") {
    const actor = typeof actorRef === "string" ? await fromUuid(actorRef) : actorRef;
    if (!actor) throw new Error("AvailabilityTest: actor not found");
    const test = new this(actor, { availability: availabilityStr });
    // Most SR5 systems expose execute(); if not, fall back to roll().
    return typeof test.execute === "function" ? test.execute() : test.roll();
  }
}
