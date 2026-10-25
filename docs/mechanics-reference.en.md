# Deadlock — formulas and mechanics

**Reviewed October 25, 2026. Client 6819, SourceRevision 11162696.**

Consistent independent observations are used as working rules. Provenance, conditions and specific disagreements are preserved. This review uses game files and published observations; the game was not launched.

Percentages in equations are fractions: 30% = 0.30. Enter ordinary percentages in the calculator. HP and effective HP are different; rounding is applied only for display.

## Contents

- [Percentages: addition, multiplication and diminishing stacking](#stacking)
- [Resistance and resistance reduction](#resistance)
- [Stacks within one effect and separate sources are different](#source-grouping)
- [Effective health: how much unreduced damage a hero can withstand](#ehp)
- [Mixed damage: EHP depends on the damage composition](#mixed-ehp)
- [Weapon damage: levels, Spirit and Weapon Damage bonuses](#weapon-base)
- [Linear ability scaling](#spirit-scaling)
- [Multiple trajectories and the hit-once rule](#hit-once)
- [Headshots: scaling applies to the bonus portion](#headshots)
- [Damage falloff over distance](#falloff)
- [Damage amplification: distinguish pools and new hits](#damage-amps)
- [Debuff resistance shortens applicable status effects](#debuff-duration)
- [Resistance, immunity and cleansing](#control-types)
- [Slows and slow resistance](#movement-slow)
- [Anti-heal reduces both ordinary healing and lifesteal](#anti-heal)
- [Healing: who amplifies it and who receives it](#direct-heal)
- [Regeneration and healing over time](#regen)
- [Lifesteal: separate channels and target efficiency](#lifesteal)
- [Lifesteal with healing amplification: two models to test](#lifesteal-amp)
- [Ability cooldown and cast frequency](#cooldown)
- [Duration increases also stack diminishingly](#duration)
- [Radius and range increases](#range)
- [Maximum HP: base-health bonuses and flat health](#max-health)
- [Fire rate and fire-rate slows](#fire-rate)
- [DPS, accuracy, crits and disputed burst timing](#dps)
- [Magazine reloads and single-round reloads](#reload)
- [Buff uptime and overlapping debuffs](#uptime)

<a id="stacking"></a>
## Percentages: addition, multiplication and diminishing stacking

**Mathematics under the stated conditions · Fundamentals**

`Σx = x₁ + x₂ + …;   P(x) = 1 − ∏(1 − xᵢ)`

- xᵢ — an individual applicable source; in the equation, 30% = 0.30.
- ∏ means multiply all the bracketed terms. P of an empty list = 0.

Diminishing stacking applies each new percentage to the remaining share. If the current result is p, a new source x adds x × (1 − p). Changing the order of different sources within one such pool does not change the result.

This operation belongs to a specific stat; it is not a universal rule for all buffs. Ordinary Weapon Damage bonuses add together, while resistances, CDR and some other stats follow their own rules.

Percentage points differ from percentages: going from 30% to 40% is +10 percentage points; the remaining damage goes from 70% to 60%, a reduction of approximately 14.29%.

**Example.** 30% and 20%: 1 − 0.70 × 0.80 = 44%. Simple addition would give 50%, while two positive multipliers, 1.3 × 1.2, would give +56% — three different results.

**Scope and limitations:**

- Before combining sources, establish the stat type, activation condition and independence of the sources.
- Multiple stacks of one effect are not necessarily separate sources.

Sources: [Mekahippie: independent explanation of diminishing returns, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="resistance"></a>
## Resistance and resistance reduction

**Working rule supported by sources · Defense**

`R⁺ = P(r₁,…);   S⁻ = P(s₁,…);   R = R⁺ − S⁻;   D = D₀ × (1 − R)`

- rᵢ ≥ 0 — a positive source of the selected resistance type.
- sᵢ ≥ 0 — the magnitude of shred or negative innate resistance, without the minus sign.
- Bullet and Spirit are calculated separately.

Combine positive resistances in one pool, then negative resistances and shred in another. Subtract the second result from the first. Do not multiply all positive and negative values together in one list.

Negative resistance increases incoming damage and is not clamped at zero. Under the documented rule, negative innate resistance also belongs to the negative pool; the direct explanation for this edge case is older than the other measurements.

**Example.** 40% and 20% resistance give 52%. Shred of 25% and 20% gives 40%. Final resistance is 12%: 880 out of 1000 damage gets through. Pocket's −15% and an item's +30% give 15% in the two-pool model, rather than 19.5%.

**Scope and limitations:**

- Calculate one damage type at a time; Pure damage does not acquire Bullet or Spirit resistance.
- Specific defenses, piercing, barriers and damage limits may have a separate stage.
- Enter each negative source separately as a positive magnitude: 15;10, rather than −15;−10.

Sources: [Wiki: damage resistance, pinned revision](https://deadlock.wiki/index.php?title=Damage_Resistance&oldid=197376), [Mekahippie: independent explanation of diminishing returns, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [CoreDump742: measurements, October 2026](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/theorycraft_is_the_crit_bonus_scale/), [Bluedragon2513: separate checks on October 23](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/comment/19rijhefuq35u/), [Nailcliper: Pocket's negative innate resistance](https://www.reddit.com/r/DeadlockTheGame/comments/1gmlzfk/daily_item_discussion_42116_spirit_armor/), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="source-grouping"></a>
## Stacks within one effect and separate sources are different

**Working rule supported by sources · Defense**

`r_source = base + active internal bonus; then R⁺ = P(r_source,…)`

- The formula within a source depends on the specific effect.
- A consumed component is no longer in the current inventory.

In the observations checked, Bullet Resilience gives 30% plus a conditional 15% as one 45% source. That source is then combined with other items.

Do not extend this additive rule to every conditional buff: different behavior has been published for Frenzy. Likewise, linear stacks of one debuff are first combined up to their own cap before entering the overall pool.

**Example.** Resilience at 45% and Battle Vest at 18%: 1 − 0.55 × 0.82 = 54.9%. Incorrectly splitting these into 30%;15%;18% gives 51.21%.

**Scope and limitations:**

- In the standard EHP calculator, enter 45 as a single value while the condition is active.
- Resistance that activates only over part of the HP bar cannot be applied to all health.

Sources: [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Independent test of conditional resistances, March 2026](https://forums.playdeadlock.com/threads/frenzy-conditional-resist-is-inconsistent-with-resilience.115272/), [CoreDump742: measurements, October 2026](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/theorycraft_is_the_crit_bonus_scale/), [Separate investigation of Baba and resistance shred](https://www.reddit.com/r/DeadlockTheGame/comments/1x5nkp1/shredding_spirit_resist_baba_hate/).

<a id="ehp"></a>
## Effective health: how much unreduced damage a hero can withstand

**Mathematics under the stated conditions · Defense**

`EHP = HP / (1 − R);   ΔEHP = EHP − HP`

- HP — actual maximum health in the state being considered.
- R — the final resistance already calculated for the selected damage type.

Resistance does not add actual HP to the health bar. EHP expresses the equivalent health pool against a specific incoming damage type before defenses reduce it.

The model assumes constant resistance and no healing, evasion, executions or additional defenses. If an independent incoming-damage multiplier m is known, the denominator becomes (1 − R) × m.

**Example.** 1000 HP with 44% resistance: 1000 / 0.56 = 1785.71 EHP. Actual HP remains 1000; the equivalent gain against this damage is 785.71. At −15% resistance: 869.57 EHP.

**Scope and limitations:**

- At 100% resistance or above, the simple finite model is undefined; the calculator explains the error.
- For conditional defenses, split HP into segments and add HP_segment / multiplier_segment.
- Do not automatically add a barrier to HP and apply one resistance value to the total.

Sources: [Mekahippie: independent explanation of diminishing returns, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Wiki: damage resistance, pinned revision](https://deadlock.wiki/index.php?title=Damage_Resistance&oldid=197376).

<a id="mixed-ehp"></a>
## Mixed damage: EHP depends on the damage composition

**Mathematics under the stated conditions · Defense**

`EHP_mix = HP / [w_b × (1−R_b) + w_s × (1−R_s) + w_p];   w_b+w_s+w_p=1`

- w_b, w_s, w_p — shares of unreduced Bullet, Spirit and Pure damage.
- R_b, R_s — final resistances for the corresponding types.

Each damage share is first reduced by its own resistance, then the results are added. Bullet EHP and Spirit EHP cannot be added together.

This model assumes a fixed mix. A real combo can change its composition, resistances and conditions between hits; that requires individual events on a timeline.

**Example.** 2000 HP, 60% Bullet damage with 40% resistance and 40% Spirit damage with 20% resistance: the denominator is 0.6×0.6 + 0.4×0.8 = 0.68. Mixed EHP is 2941.18.

**Scope and limitations:**

- The shares must total 100%.
- Pure damage has a multiplier of 1 in this model; special all-damage effects are specified separately.

Sources: [Wiki: damage resistance, pinned revision](https://deadlock.wiki/index.php?title=Damage_Resistance&oldid=197376), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="weapon-base"></a>
## Weapon damage: levels, Spirit and Weapon Damage bonuses

**Working rule supported by sources · Damage**

`d_base = d₀ + B × g + S × k;   d_weapon = d_base × (1 + ΣW)`

- B = LVL − 1, normally 0…35 Boons.
- g — direct damage growth per Boon for one bullet or pellet.
- k — the weapon's native Spirit coefficient; W — applicable ordinary Weapon Damage bonuses as fractions.

First calculate the weapon's own base damage at the given level and Spirit. Then apply the sum of the ordinary Weapon Damage pool, including the applicable investment bonus.

Growth differs between heroes. In 6819, Vindicta, Grey Talon and Solomon have a Spirit contribution to bullet damage; Warden's Spirit changes fire rate. Warden's equivalent EFireRate and ERoundsPerSecond values are not two separate buffs.

**Example.** Nurse Harrow at 10 Boons: 14.858 + 10×0.37436 = 18.6016. With 46%+20% Weapon Damage: 18.6016×1.66 = 30.878656 before other layers.

**Scope and limitations:**

- Additional procs, flat additions after scaling and alternative charged shots do not enter the base without a separate rule.
- Outdated item values from a historical guide are not current inputs.

Sources: [Hero files: base stats, growth and scaling coefficients](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [CoreDump742: measurements, October 2026](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/theorycraft_is_the_crit_bonus_scale/), [Mekahippie: independent explanation of diminishing returns, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/).

<a id="spirit-scaling"></a>
## Linear ability scaling

**Working rule supported by sources · Damage**

`X = X₀ + Σflat_upgrade + (k₀ + Σscale_upgrade) × S`

- X — a specific property, such as damage, healing or duration.
- S — the stat named in the scaling function; it is not always Spirit.
- EAddToScale adds to the coefficient; an ordinary flat upgrade adds to the base.

Calculate each ability property separately. A Spirit icon does not mean every part of an ability uses the same multiplier.

After calculating raw damage, apply the corresponding defense type and other hit conditions. Multiple ticks or targets are separate events.

**Example.** Kelvin's Ice Grenade: base 60, T1 +30, coefficient 0.6, T3 +0.8. At 100 Spirit: 60+30+(0.6+0.8)×100 = 230. With a final 20% Spirit Resist, 184 gets through.

**Scope and limitations:**

- Special scaling functions, required upgrades, rounding, Brawl and disabled functions require their own handling.
- Do not reuse an already amplified tooltip value as an unamplified base.

Sources: [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Properties and scaling functions](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CitadelAbilityProperty_t.h), [CoreDump742: measurements, October 2026](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/theorycraft_is_the_crit_bonus_scale/), [Separate investigation of Baba and resistance shred](https://www.reddit.com/r/DeadlockTheGame/comments/1x5nkp1/shredding_spirit_resist_baba_hate/).

<a id="hit-once"></a>
## Multiple trajectories and the hit-once rule

**Working rule supported by sources · Damage**

`Ordinary pellets: D_volley = Σd_hits;   hitOnce: D_volley_per_target = d if any trajectory hits`

- P — the number of trajectories in the raw data, not guaranteed damage instances on one target.
- HitOnce = m_bHitOnceAcrossAllBullets.

For an ordinary shotgun, each pellet that hits contributes a separate damage term. With hit-once, any trajectory hitting deals the full single-hit damage to that target; three paths do not triple the damage.

This corrects the table's earlier hypothesis from October 24. The raw trajectory count remains in the notes to explain how the weapon works.

**Example.** Baba: 8.8, three paths, hitOnce=true → 8.8 to one target, rather than 26.4. Drifter: 19.5 and three paths → 19.5, rather than 58.5. Rat King: two ordinary bullets at 6 each → 12.

**Scope and limitations:**

- Baba and Drifter have stronger verification than extending this rule to every special mode.
- Violet has raw P=1; the additional 4/8 custom paths are not an ordinary damage multiplier.

Sources: [Weapon field definitions](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelWeaponInfo.h#L18), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Bluedragon2513: separate checks on October 23](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/comment/19rijhefuq35u/), [Wiki: weapon damage, revision with a disputed crit formula](https://deadlock.wiki/index.php?title=Weapon_Damage&oldid=194393).

<a id="headshots"></a>
## Headshots: scaling applies to the bonus portion

**Working rule supported by sources · Damage**

`C = 1 + (c − 1) × q_out × q_in;   D_head = D_body × C`

- c — the specific weapon's multiplier at the given distance.
- q_out — the attacker's CritDamageBonusScale; 0.7 means 70% of the bonus portion.
- q_in — the target's CritDamageReceivedScale; this is not ordinary Bullet resistance.

The current base for ordinary weapons is often 1.65, with exceptions such as Rat King's 1.35. Subtract one first, modify only the bonus portion, then restore the ordinary damage.

Recent measurements by two authors support this formula; one pinned wiki revision expresses outgoing crit scaling differently and gives a different result for Vyper. The measurement model is used as the working rule.

**Example.** Vyper: 1+0.65×0.7 = 1.455. Against Seven with incoming scale 0.45: 1+0.65×0.7×0.45 = 1.20475. Body damage 100 → 120.475 before ordinary resistance.

**Scope and limitations:**

- The multiplier does not apply to a weapon with CanCrit=false.
- Graves and special handlers require separate checks; one raw flag does not guarantee an ordinary headshot.
- NPC weakpoints and bonuses against NPCs do not automatically follow this rule.

Sources: [Hero files: base stats, growth and scaling coefficients](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata), [Weapon field definitions](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelWeaponInfo.h#L18), [Valve: standard headshot multiplier 1.65, November 21, 2025](https://forums.playdeadlock.com/threads/11-21-2025-update.90383/), [CoreDump742: measurements, October 2026](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/theorycraft_is_the_crit_bonus_scale/), [Bluedragon2513: separate checks on October 23](https://www.reddit.com/r/DeadlockGame/comments/1xbhphj/comment/19rijhefuq35u/), [Wiki: weapon damage, revision with a disputed crit formula](https://deadlock.wiki/index.php?title=Weapon_Damage&oldid=194393).

<a id="falloff"></a>
## Damage falloff over distance

**Model: verification has limitations · Damage**

`t = clamp((x−a)/(b−a),0,1);   F = F_a + (F_b−F_a) × t;   D = D₀ × F`

- a,b — falloff start and end; x — distance traveled.
- F_a,F_b — scales at the boundaries.

The linear working model applies to the checked bias of 0.5. Before the start, damage uses the initial scale; after the end, it uses the final scale, provided the projectile can still reach the target.

Thresholds and residual damage are individual: Drifter ends at 0.6, Sinclair at 0.3 and Graves at 0.5. Do not assign 10% to everyone.

**Example.** With thresholds of 590 and 1300 units and a scale from 1 to 0.1, the midpoint of 945 units gives 0.55. Of 100 damage, 55 remains before other defenses.

**Scope and limitations:**

- This interpolation is not confirmed for other bias values.
- When thresholds coincide and have identical scales, use the constant scale.
- Straight-line distance between heroes can differ from the path through a portal.

Sources: [Weapon field definitions](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelWeaponInfo.h#L18), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Wiki: weapon damage, revision with a disputed crit formula](https://deadlock.wiki/index.php?title=Weapon_Damage&oldid=194393), [Valve: standard headshot multiplier 1.65, November 21, 2025](https://forums.playdeadlock.com/threads/11-21-2025-update.90383/).

<a id="damage-amps"></a>
## Damage amplification: distinguish pools and new hits

**Working rule supported by sources · Damage**

`D = [d_base × (1+W) × (1+ΣA) + flat_post] × ∏(1+M) × F × C × (1−R)`

- A — only effects in a confirmed additive pool, with penalties entered as negative values.
- M — separate confirmed multiplicative amplifications.
- flat_post — a flat addition at its own stage.

The labels 'amplification' and 'damage reduction' do not determine a formula. The raw data has distinct increases, multipliers, target amplification, post-armor reduction and new damage instances.

For Inhibitor −30% and Fire Scarabs −20%, a published test shows a 50% additive penalty, in conflict with the overall direction of the May 22 patch. This is retained as the stated working model with conflicting evidence; Rat King's defense belongs to another modifier type and is not assigned to this pool.

The order of independent constant multipliers does not change the algebraic result. That does not prove the order of game events: on-hit shred may amplify only subsequent hits, while a proc can create separate damage.

**Example.** Base 100, Weapon Damage 50%, additive amplification 20% and a 30% penalty, flat addition 10: 100×1.5×0.9+10 = 145. A separate 25% amplification → 181.25; with 20% resistance → 145.

**Scope and limitations:**

- The calculator accepts established pools; it does not infer them from item names.
- Do not add all damage reductions together or automatically multiply them all.

Sources: [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h), [Wiki: damage amplification, pinned revision](https://deadlock.wiki/index.php?title=Damage_amplification&oldid=203362), [Published Inhibitor + Scarabs test](https://forums.playdeadlock.com/threads/damage-reduction-stacking.148395/), [Valve: total damage reduction changes, May 22, 2026](https://store.steampowered.com/news/app/1422450/view/1833334318572828), [Valve: shred affects subsequent hits, January 30, 2026](https://forums.playdeadlock.com/threads/01-30-2026-update.102822/).

<a id="debuff-duration"></a>
## Debuff resistance shortens applicable status effects

**Working rule supported by sources · Control**

`R_d = P(r₁,…);   t_target = t_base × (1+U) × (1−R_d)`

- t_base — duration after flat upgrades and applicable scaling.
- U — the attacker's already combined duration bonus.
- R_d — the target's debuff resistance.

Different applicable sources of debuff resistance stack diminishingly. The attacker's duration increase and the target's resistance are separate layers, so their multipliers multiply.

Check the specific modifier: reducible or extendible duration, an aura, linger and fuse are not the same timer. An aura that constantly reapplies an effect may keep it active almost continuously even when each individual status is brief.

**Example.** 25% and 22% debuff resistance → 41.5%. A 4-second status without duration amplification lasts 2.34 seconds. With a 4-second base, +20% duration and one 25% DR source: 4×1.2×0.75 = 3.6 seconds.

**Scope and limitations:**

- Do not automatically shorten all ability timers while preserving the same total DoT.
- Buying Dispel Magic does not grant the old passive DR from the historical Debuff Remover.
- One schema field does not prove a universal chain-CC system.

Sources: [Independent authors on debuff resistance, August 2026](https://www.reddit.com/r/DeadlockTheGame/comments/1vq87x1/stacking_debuff_resistance_on_wraith_is_actually/), [Valve: diminishing debuff resistance, May 8, 2025](https://store.steampowered.com/news/app/1422450/view/524216645064852902), [Mekahippie: independent explanation of diminishing returns, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Duration and applicability flags](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelModifierVData.h), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata).

<a id="control-types"></a>
## Resistance, immunity and cleansing

**Parameters and flags from game files · Control**

`Resistance → shorter applicable status;   Immunity/Suppression → prevent or suppress;   Purge → remove an eligible modifier`

- Each effect has its own states, flags and exceptions.

These operations cannot be replaced by 100% debuff resistance. Resistance does not remove an existing debuff. Immunity can suppress a state while the modifier's timer continues to run.

Cleansing removes only eligible effects. Unstoppable has separate masks and an unpurgeable buff; Dispel Magic has a separate active effect. The word 'purge' alone does not guarantee removal of any ultimate.

**Example.** If an aura repeatedly applies a short slow, shortening each instance does not necessarily free the hero while they remain inside the aura.

**Scope and limitations:**

- Check the disable and the specific modifier, not just the ability name.
- Damage immunity does not equal CC immunity.

Sources: [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Duration and applicability flags](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelModifierVData.h), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="movement-slow"></a>
## Slows and slow resistance

**Model: verification has limitations · Control**

`S = P(s₁,…);   Q = Σqᵢ;   S_eff = S × (1−Q);   v = 2 + (v₀−2) × (1−S_eff)`

- sᵢ — ordinary percentage movement slows.
- qᵢ — applicable slow-resistance bonuses; they are additive in this working model.
- v₀ ≥ 2 m/s — speed before these slows.

Ordinary slows combine diminishingly. Slow resistance then reduces the strength of the slow, rather than its duration. The working model reduces the portion of speed above 2 m/s.

The independence of the matching Wiki and Guru descriptions has not been established, so this model has lower confidence than DR or CDR. It is useful for estimates but is not a measurement of current movement physics.

**Example.** 30% and 25% slows → 47.5%. Slow resistance of 25%+35% → 60%. Effective slow: 19%. Starting at 10 m/s: 2+8×0.81 = 8.48 m/s.

**Scope and limitations:**

- Only 0…100% slow resistance is supported; values above 100% must not produce an invented speed boost.
- Does not apply to stuns or roots, dash penalties, airborne movement, sprinting, Urn limits or movement overrides.

Sources: [Wiki: movement and slow resistance](https://deadlock.wiki/Slow_Resistance), [Deadlock Guru: matching description of slows](https://deadlock.guru/wiki/mechanics/movement-slow/), [Game settings: lifesteal and limits](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/convars.txt), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="anti-heal"></a>
## Anti-heal reduces both ordinary healing and lifesteal

**Working rule supported by sources · Healing**

`A = P(a₁,…);   M_anti = ∏(1−aᵢ);   H_after = H_before × M_anti`

- aᵢ — different applicable anti-heal families.
- Receive and regen penalties from one source serve different routes and do not count as two anti-heal sources.

Applicable anti-heal reduces the corresponding HP restoration: direct healing, regeneration and healing from lifesteal. Multiple distinct sources stack diminishingly; two copies of the same debuff do not automatically become independent sources.

Current Healbane and Toxic Bullets each have 35% receive and 35% regen penalties. This is not 70% from one item. Barriers, max-HP changes and special external regeneration without reduction are separate mechanics.

**Example.** Healbane 35% + Toxic 35% → 57.75% reduction. A 200 heal with 20% outgoing amplification: 200×1.2×0.65×0.65 = 101.4 HP before the missing-health cap.

**Scope and limitations:**

- For identical copies, establish the effect family first; the exact refresh or strongest-effect policy may be specific to that effect.
- Pocket's T3 Affliction uses a separate DisableHealing effect, rather than ordinary percentage stacking.
- Fountain or external regeneration may have an explicit NO_REDUCTION exception.

Sources: [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Healing types in the schema](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EHealingTypes.h), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h), [Wiki: healing and its modifiers](https://deadlock.wiki/Healing), [Multiple players: Toxic + Healbane, June 2026](https://www.reddit.com/r/DeadlockTheGame/comments/1tvbr69/does_toxic_bullets_healing_reduction_stack_with/), [Other authors: anti-heal stacking, April 2026](https://www.reddit.com/r/DeadlockTheGame/comments/1s93kp5/anti_heal_stacks_or_no/).

<a id="direct-heal"></a>
## Healing: who amplifies it and who receives it

**Working rule supported by sources · Healing**

`H_potential = H₀ × M_cast × M_receive × M_anti;   H_actual = min(HP_missing, max(0,H_potential))`

- M_cast — applicable outgoing amplification from the healing source.
- M_receive — a separate applicable multiplier for the recipient.
- Enter the already combined multipliers for their respective groups.

First establish who owns the healing and what type of effect it is. In 6819, Healing Booster gives 20% outgoing cast amplification and 20% regeneration, rather than universal receive amplification. A Booster on the recipient does not by itself mean +20% to every direct heal from someone else.

Self-healing combines caster and recipient, often obscuring the distinction. If the starting value is already amplified, do not apply the same bonus again. The sources do not establish a complete universal rule for combining multiple different positive healing amplifications.

**Example.** Heal 250, 20% outgoing amplification, 35% anti-heal: potential healing is 195. If only 100 HP is missing, 100 is actually restored and the rest is overheal.

**Scope and limitations:**

- Barriers have their own amplification stats.
- Receive and regen are separate branches; do not multiply Booster's 20% cast and 20% regen into 1.44 on every tick without a separate rule.

Sources: [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h), [Healing types in the schema](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EHealingTypes.h), [Wiki: healing and its modifiers](https://deadlock.wiki/Healing).

<a id="regen"></a>
## Regeneration and healing over time

**Mathematics under the stated conditions · Healing**

`H(t) = rate × t × M_applicable_branch, capped by HP_missing`

- rate — the correct HP/s after base, flat, out-of-combat and scaling contributions for this effect.

Under constant conditions, restored HP equals the restoration rate multiplied by time. But amplifying total healing, rate and duration are different operations: a longer HoT does not always restore more health.

Victor's native regeneration is 1.5+0.08×Spirit. With a natural 38.5 Spirit at LVL 36, that gives 4.58 HP/s without items. Nurse Harrow has 0 base regeneration; a healing effect from someone else does not automatically give her native regeneration.

**Example.** A constant applicable regeneration rate of 10 HP/s over 5 seconds would restore 50 HP; with one 35% anti-heal source, 32.5 HP, provided health is missing throughout.

**Scope and limitations:**

- Out-of-combat regeneration, fountains and external sources have separate rules.
- Tick count, the order of medic heals, and the initial or final tick of a specific HoT require separate checks.

Sources: [Hero files: base stats, growth and scaling coefficients](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h), [Healing types in the schema](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EHealingTypes.h).

<a id="lifesteal"></a>
## Lifesteal: separate channels and target efficiency

**Working rule supported by sources · Healing**

`L = P(l₁,…);   H₀ = D_eligible × L × k_target × e_hero`

- Bullet and Spirit lifesteal are separate pools.
- D_eligible — eligible damage actually dealt, before calculating healing.
- k_target = 1 against heroes; ordinary non-hero coefficients are 0.6 for Bullet and 0.4 for Spirit.

First combine applicable lifesteal within one channel. A source that works only against a marked target or for one ability does not become global lifesteal for every hit.

Then apply target and hero efficiency limits and the appropriate healing and anti-heal branch. Rat King has a separate efficiency of 0.75 in the raw data; it must not be read as a +75% bonus.

**Example.** 13% and 28% → 37.36%. From 200 eligible damage to a hero: 74.72 HP before other healing modifiers. For an ordinary Bullet non-hero target: 44.832; Spirit non-hero target: 29.888.

**Scope and limitations:**

- Damage to barriers, overkill, summons and structures require separate applicability checks.
- The fixed Melee Lifesteal heal is not a percentage of global Bullet lifesteal.
- Do not combine ability-inherent healing and general lifesteal without checking the source and scope.

Sources: [Wiki: lifesteal](https://deadlock.wiki/Lifesteal), [Valve: diminishing lifesteal, October 10, 2024](https://forums.playdeadlock.com/threads/10-10-2024-update.36958/), [Mekahippie: independent explanation of diminishing returns, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Game settings: lifesteal and limits](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/convars.txt), [Hero files: base stats, growth and scaling coefficients](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="lifesteal-amp"></a>
## Lifesteal with healing amplification: two models to test

**Model: verification has limitations · Healing**

`Model A: D × P(lᵢ) × (1+a);   model B: D × P(lᵢ × (1+a))`

- a — applicable outgoing amplification, if the lifesteal values do not already include it.
- A amplifies the overall heal after pooling; B amplifies each lifesteal input first.

The common explanation uses A. However, several raw lifesteal properties have EHealingOutput scaling, which allows B. Available observations do not distinguish the models reliably enough.

The calculator shows both estimates when amplification is entered and makes the difference visible. With 0 amplification, the answers match. If entering lifesteal values that are already amplified, leave outgoing amplification at 0.

**Example.** 13%+28%, 20% amplification, 200 damage: A = 89.664 HP; B = 87.9168 HP before anti-heal and the missing-HP cap.

**Scope and limitations:**

- This is a localized disagreement about operation order; the diminishing lifesteal formula itself remains the working rule.
- If an amplified individual source reaches 100%, model B is outside its supported input range.

Sources: [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Properties and scaling functions](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CitadelAbilityProperty_t.h), [Wiki: lifesteal](https://deadlock.wiki/Lifesteal), [Wiki: healing and its modifiers](https://deadlock.wiki/Healing).

<a id="cooldown"></a>
## Ability cooldown and cast frequency

**Working rule supported by sources · Timing**

`C = P(c₁,…);   T_final = T_upgraded × (1−C);   ideal_rate = 1/T_final`

- T_upgraded — cooldown after flat upgrades to the relevant property.
- cᵢ — distinct eligible CDR sources for the same timer type.

Multiple ordinary CDR bonuses stack diminishingly. The percentage reduces time, so 20% CDR is not +20% cast frequency: all else being equal, frequency increases by a factor of 1/0.8 = 1.25.

Abilities, items, ultimates, charge recharge, delays between charges and parry have different timers. Ordinary ability CDR does not shorten an item active with EItemCooldown.

**Example.** 60 seconds, 20% and 5% CDR: final reduction 24%; cooldown 45.6 seconds. If a flat talent first changes the base to 50 seconds, the result is 38 seconds. Dispel at 45 seconds with an eligible 25% item CDR → 33.75 seconds.

**Scope and limitations:**

- Cooldown start timing, cast or channel time, resources and charges limit actual frequency.
- Resets and reductions to the remaining timer are separate operations.
- No unproven universal cap or floor is assigned.

Sources: [Wiki: ability cooldown](https://deadlock.wiki/Ability_Cooldown), [Valve: diminishing CDR, July 18, 2024](https://forums.playdeadlock.com/threads/07-18-2024-update.11831/), [Mekahippie: independent explanation of diminishing returns, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="duration"></a>
## Duration increases also stack diminishingly

**Working rule supported by sources · Timing**

`U = P(u₁,…);   t_final = t_upgraded × (1+U)`

- uᵢ — independent active duration bonuses.

For ordinary applicable duration bonuses, the working rule is a diminishing positive bonus rather than a product of (1+u). This agrees with the independent explanation and the direction of Valve's patch.

Current Duration Extender gives 20% and Superior gives 28%. The Wiki still shows the old 22% in places: numerical inputs use raw 6819. A consumed component does not remain as a second item.

**Example.** 28% and 15% → 1−0.72×0.85 = 38.8%. A 10-second base becomes 13.88 seconds, rather than the 14.72 seconds from 1.28×1.15.

**Scope and limitations:**

- The ability must allow duration scaling for the relevant modifier.
- Flat duration, Spirit-based duration, channels and projectile lifetime require their own order or property.

Sources: [Wiki: duration (some item values are outdated)](https://deadlock.wiki/Ability_Duration), [Valve: diminishing duration and range, December 6, 2024](https://forums.playdeadlock.com/threads/12-06-2024-update.50599/), [Mekahippie: independent explanation of diminishing returns, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Duration and applicability flags](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelModifierVData.h).

<a id="range"></a>
## Radius and range increases

**Working rule supported by sources · Timing**

`U_range = P(r₁,…);   range_final = range_upgraded × (1+U_range)`

- range_upgraded — the already selected base for the specific property, in meters.

Ordinary range and radius bonus percentages combine diminishingly. But cast range, explosion radius, width, height and maximum projectile travel distance are different properties.

The raw data contains separate TECH_RANGE_PERCENT and TECH_RADIUS_PERCENT values. Even matching 30% values do not guarantee that every ability distance reads that stat.

**Example.** 30% and 5% → 33.5%. A 20-meter radius becomes 26.7 meters if both sources apply.

**Scope and limitations:**

- Does not automatically change weapon falloff or dash range.
- Line of sight and height restrictions cannot be inferred from radius alone.

Sources: [Wiki: radius and range](https://deadlock.wiki/Range), [Valve: diminishing duration and range, December 6, 2024](https://forums.playdeadlock.com/threads/12-06-2024-update.50599/), [Mekahippie: independent explanation of diminishing returns, 2024](https://www.reddit.com/r/DeadlockTheGame/comments/1hb8b7z/heres_how_deadlocks_diminishing_returns_work_for/), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="max-health"></a>
## Maximum HP: base-health bonuses and flat health

**Working rule supported by sources · Stats**

`HP_max = ceil[(HP₀ + B × g_HP) × (1+b_base) + HP_flat]`

- b_base — the applicable, already combined bonus to base health plus growth.
- HP_flat — the sum of ordinary additions not scaled by this base bonus.
- ceil — rounding up to an integer in the adopted model.

The hero's base health and health from Boons belong to the base-health portion. Ordinary flat health from items is added after that portion is amplified. Do not multiply flat item HP by the base bonus again.

Vitality investment uses the current total for the relevant investment threshold. It is not the sum of historical percentages for every tier ever purchased.

**Example.** Base 800, 10 Boons at 49 each, 20% base bonus, flat 210: ceil((800+490)×1.2+210) = 1758 HP.

**Scope and limitations:**

- Glass Cannon's total max-health penalty, bonuses that do not scale, HP steal and overrides use other types; this simple formula does not model them.
- Current HP after maximum health changes follows a separate rule.

Sources: [Wiki: base and bonus health](https://deadlock.wiki/Bonus_Health), [Deadlock Shop: independent stat implementation](https://deadlockshop.app/), [Deadlock Meta: category investment](https://www.deadlockmeta.dev/en/mechanics/investment-bonus), [Hero files: base stats, growth and scaling coefficients](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="fire-rate"></a>
## Fire rate and fire-rate slows

**Model: verification has limitations · Timing**

`H=Σhᵢ; Q=P(sᵢ); z=max(−0.50,H−Q); f=f₀×(1+z) when z≥0; f=f₀/(1−z) when z<0`

- hᵢ — ordinary positive fire-rate bonuses.
- sᵢ — separate fire-rate slows, not movement slows.

Positive bonuses and fire-rate slows combine in different pools. A native change to the base cycle belongs to another stage.

The negative branch, 1/(1−z), is described by the current Wiki, but no recent independent timing test was found. The calculator and reference therefore treat it as a working estimate with lower confidence.

**Example.** Base 10 shots/s with 20%+30% bonuses → 15. A 38% bonus and 25%+28% slows → Q = 46%, z = −8%; the model gives 10/1.08 = 9.25926.

**Scope and limitations:**

- Does not automatically extend to burst, spin-up, charged or channeled weapons.
- −50% in this conversion model does not mean exactly half the firing frequency.

Sources: [Wiki: fire rate](https://deadlock.wiki/index.php?title=Fire_Rate&oldid=192243), [Separate measurements of fire-rate buffs and slows](https://www.reddit.com/r/DeadlockTheGame/comments/1i07acp/is_it_just_me_or_does_attack_speed_need_to_be_looked_at/), [Game settings: lifesteal and limits](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/convars.txt), [Distinct modifier types](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/EModifierValue.h).

<a id="dps"></a>
## DPS, accuracy, crits and disputed burst timing

**Model: verification has limitations · Timing**

`DPS = D_volley × f;   expected = DPS × p_hit × [1+h×(C−1)]`

- h — the share of headshots among hits; p_hit — the hit rate.
- In the table, f = N / [cycle + (N−1)×intra] is a comparison model.

DPS is neither damage per hit nor an exact time to kill. If misses are already included in actual damage, do not multiply by accuracy again.

Three interpretations were found for bursts: schema N/cycle, the adopted model N/[cycle+(N−1)intra], and the API's N/[cycle+Nintra]. Without an independent timing test, a new interpretation is not silently adopted as fact. The table retains an explicitly stated comparison model.

For an ordinary magazine, the average estimate including reload is m×D/(m/f+reload). The timing of the first shot, reload overlap and special modes can change the exact cycle boundary.

**Example.** D = 10, f = 5/s, magazine 10, reload 2 seconds → 50 DPS while firing and 25 DPS in the continuous model including reload. Seven's raw N = 3, cycle = 0.2625, intra = 0.084 gives 11.42857; 6.96864; 5.83090 shots/s under the three interpretations.

**Scope and limitations:**

- For hitOnce, use the correct single-target damage first; for spin-up, choose the starting or fully spun-up state.
- This is not engine-measured DPS or a guaranteed TTK.

Sources: [Weapon field definitions](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelWeaponInfo.h#L18), [API implementation of calculated DPS](https://github.com/deadlock-api/deadlock-api/blob/902a603c444796943cb8db268143aeb11c747fab/api/src/services/assets/versions/items/build.rs#L733), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata).

<a id="reload"></a>
## Magazine reloads and single-round reloads

**Model: verification has limitations · Timing**

`Ordinary: T=T_reload;   single-round: T≈initial_delay+n×T_round;   one reduction q: T≈T₀×(1−q)`

- n — the number of rounds that need to be inserted.
- For single-bullet reloads, m_reloadDuration means one operation rather than a full magazine.

Check the reload type. Abrams and Silver insert rounds individually; Nurse Harrow uses an ordinary magazine reload. The same raw duration field name does not mean the same operation.

One ordinary 20% Reload Reduction corresponds to approximately 80% of the original time. A universal stacking rule for multiple different reload modifiers has not been established here.

**Example.** Abrams: 0.705 seconds initial delay + 9×0.3525 seconds = 3.8775 seconds. Silver: 0.5+7×0.3 = 2.6 seconds. Nurse's full reload is 1.9 seconds; one 10% reduction gives 1.71 seconds in the ordinary model.

**Scope and limitations:**

- Active Reload, instant ammo refills, cancellations and active modes have separate timers.
- Pellet count does not equal ammunition consumption.

Sources: [Weapon field definitions](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelWeaponInfo.h#L18), [Weapon, ability and item files](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata), [Wiki: reload types](https://deadlock.wiki/Reload), [Reload duration observations](https://www.reddit.com/r/DeadlockTheGame/comments/1fe8z6d/we_all_did_that/).

<a id="uptime"></a>
## Buff uptime and overlapping debuffs

**Mathematics under the stated conditions · Timing**

`uptime = min(1, duration / period);   overlap = length of the union of intervals`

- period — the actual time between the starts of applications, which is not always the cooldown value.

If the same effect is regularly applied every P seconds and lasts T seconds, its uptime under constant conditions is min(1,T/P). Determine the period from cooldown start mechanics, casting and resources.

Adding the durations of two overlapping stuns does not give total control time. Only non-overlapping portions are added on the timeline. Refresh and queue mechanics have their own rules.

**Example.** A 6-second buff every 10 seconds → 60% uptime. Stuns over [0;2] and [1;3] control the target for 3 seconds, rather than 4 seconds.

**Scope and limitations:**

- This is a mathematical model for a known schedule, not a promise about how specific CC effects stack.
- Auras, duration resistance and unpredictable hits change the intervals.

Sources: [Duration and applicability flags](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CCitadelModifierVData.h), [Properties and scaling functions](https://github.com/SteamTracking/GameTracking-Deadlock/blob/17462b250a0ca80e7f80102f2c83cc3eecff5f12/DumpSource2/schemas/client/CitadelAbilityProperty_t.h).
