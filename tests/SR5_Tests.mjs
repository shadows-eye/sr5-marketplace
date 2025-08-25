
import { MODULE_ID } from "../scripts/lib/constants.mjs";
// Foundry v13-ready: uses await roll.evaluate() (no async option)
// Exports: simpleAll, opposedAll, teamworkAll

/* ----------------------------- internals ----------------------------- */

async function _sr5Call(actor, name, ...args) {
  if (!actor) throw new Error("No actor");
  // 1) instance
  const inst = actor[name];
  if (typeof inst === "function") return await inst.apply(actor, args);
  if (inst !== undefined) return inst; // getter/value

  // 2) walk prototype chain (covers non-enumerable)
  let proto = Object.getPrototypeOf(actor);
  while (proto && proto !== Object.prototype) {
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (desc) {
      if (typeof desc.value === "function") return await desc.value.apply(actor, args);
      if (typeof desc.get === "function") return desc.get.call(actor);
    }
    proto = Object.getPrototypeOf(proto);
  }

  // 3) static helper on class?
  if (typeof actor?.constructor?.[name] === "function") {
    return await actor.constructor[name](actor, ...args);
  }
  throw new Error(`SR5 member "${name}" not found`);
}

const A = async (x) => (typeof x === "string" ? await fromUuid(x) : x);

function _speaker(actor) {
  return ChatMessage.getSpeaker({ actor });
}
async function _post(actor, title, lines) {
  return ChatMessage.create({
    speaker: _speaker(actor),
    content: `<h3>${title}</h3><ul>${lines.map((l)=>`<li>${l}</li>`).join("")}</ul>`
  });
}

async function _getPool(actor, skillKey) {
  let pool = await _sr5Call(actor, "getPool", skillKey).catch(()=>0);
  if (pool && typeof pool === "object") pool = pool.value ?? pool.total ?? pool.pool ?? 0;
  return Number.isFinite(pool) ? Math.max(0, pool) : 0;
}
async function _getSkillRating(actor, skillKey) {
  const s = await _sr5Call(actor, "getSkill", skillKey).catch(()=>null);
  return Number(s?.value ?? s?.rating ?? s ?? 0);
}

function _extractSocialKeys(actor) {
  const active = foundry.utils.getProperty(actor, "system.skills.active") || {};
  const keys = Object.entries(active)
    .filter(([_, data]) => ["Acting", "Influence"].includes(String(data?.group ?? "")))
    .map(([k]) => k);

  // Ensure common SR5 social keys if present in actor
  const common = ["con","etiquette","leadership","negotiation","intimidation","instruction","impersonation","disguise"];
  for (const k of common) if (active[k] && !keys.includes(k)) keys.push(k);
  return keys;
}

function _digest(roll, pool) {
  const dice = roll?.dice?.[0]?.results ?? [];
  const hits = dice.filter(d => (d?.result ?? 0) >= 5).length;
  const ones = dice.filter(d => (d?.result ?? 0) === 1).length;
  const glitch = ones > pool/2;
  const critGlitch = glitch && hits === 0;
  return { hits, ones, glitch, critGlitch };
}

async function _roll(pool) {
  const r = new Roll(`${Math.max(0, pool)}d6`);
  if (typeof r.evaluate === "function") {
    await r.evaluate();            // v13+: async by default (no {async:true})
  } else if (typeof r.evaluateSync === "function") {
    r.evaluateSync();              // fallback (older)
  }
  return { roll: r, ..._digest(r, pool) };
}

/* ------------------------------ exports ------------------------------ */

/** Simple tests for all social skills of one actor. */
export async function simpleAll(actorRef, { postToChat = true } = {}) {
  const actor = await A(actorRef);
  const keys = _extractSocialKeys(actor);
  const lines = [];
  for (const key of keys) {
    const pool = await _getPool(actor, key);
    const { roll, hits, glitch, critGlitch } = await _roll(pool);
    lines.push(
      `<b>${key}</b>: ${hits} hits (pool ${pool})` +
      (glitch ? (critGlitch ? " — <span style='color:red'>CRIT GLITCH</span>" : " — <i>glitch</i>") : "")
    );
    console.debug(`[${MODULE_ID}] simpleAll`, { actor: actor.name, key, pool, roll, hits, glitch, critGlitch });
  }
  if (postToChat) await _post(actor, "Social Skills — Simple Tests", lines);
  return lines;
}

/** Opposed tests for all social skills between two actors. */
export async function opposedAll(attackerRef, defenderRef, { postToChat = true } = {}) {
  const attacker = await A(attackerRef);
  const defender = await A(defenderRef);
  const keys = _extractSocialKeys(attacker);
  const lines = [];
  for (const key of keys) {
    const aPool = await _getPool(attacker, key);
    const dPool = await _getPool(defender, key);
    const aRes = await _roll(aPool);
    const dRes = await _roll(dPool);
    const net = aRes.hits - dRes.hits;
    lines.push(`<b>${key}</b>: ${attacker.name} ${aRes.hits} vs ${defender.name} ${dRes.hits} → <b>${net >= 0 ? "+" : ""}${net}</b>`);
    console.debug(`[${MODULE_ID}] opposedAll`, { key, a: aRes, d: dRes, net });
  }
  if (postToChat) await _post(attacker, `Opposed Social — ${attacker.name} vs ${defender.name}`, lines);
  return lines;
}

/** Teamwork tests across all social skills. Helpers add hits as bonus dice (capped by leader skill rating). */
export async function teamworkAll(leaderRef, helpersRefs = [], { capByLeaderRating = true, postToChat = true } = {}) {
  const leader = await A(leaderRef);
  const helpers = await Promise.all(helpersRefs.map(A));
  const keys = _extractSocialKeys(leader);
  const lines = [];
  for (const key of keys) {
    const leaderPoolBase = await _getPool(leader, key);
    const leaderSkill = await _getSkillRating(leader, key);
    let assistHits = 0;
    for (const h of helpers) {
      const hPool = await _getPool(h, key);
      const hRes = await _roll(hPool);
      assistHits += hRes.hits;
      console.debug(`[${MODULE_ID}] teamwork helper`, { helper: h.name, key, hits: hRes.hits });
    }
    const bonus = capByLeaderRating ? Math.min(assistHits, Math.max(0, leaderSkill)) : assistHits;
    const leaderPool = leaderPoolBase + bonus;
    const lRes = await _roll(leaderPool);
    lines.push(
      `<b>${key}</b>: base ${leaderPoolBase} + assist ${assistHits}` +
      (capByLeaderRating ? ` (cap ${leaderSkill})` : "") +
      ` → roll ${leaderPool} = <b>${lRes.hits}</b> hits`
    );
    console.debug(`[${MODULE_ID}] teamwork leader`, { key, leaderPoolBase, assistHits, leaderPool });
  }
  if (postToChat) await _post(leader, `Teamwork Social — Leader: ${leader.name}`, lines);
  return lines;
}

/* Optional: expose on a global namespace for macro/API usage */
globalThis.sr5Marketplace ??= {};
globalThis.sr5Marketplace.tests = { simpleAll, opposedAll, teamworkAll };
