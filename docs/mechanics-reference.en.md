# Deadlock — formulas and mechanics

**Game version: 6819. Data as of October 25, 2026.**

Percentages in equations are fractions: 30% = 0.30. Enter ordinary percentages in the calculator. HP means health; EHP means effective health. Results are rounded only for display.

## Contents

- [How percentages combine](#stacking)
- [Damage resistance and resistance reduction](#resistance)
- [Bonuses within one effect](#source-grouping)
- [Effective health](#ehp)
- [Effective health against mixed damage](#mixed-ehp)
- [Base weapon damage and weapon damage bonuses](#weapon-base)
- [How stats scale an ability](#spirit-scaling)
- [Pellets and one hit per target](#hit-once)
- [Headshot damage](#headshots)
- [Damage falloff with distance](#falloff)
- [Damage amplification and reduction](#damage-amps)
- [Debuff resistance](#debuff-duration)
- [Resistance, immunity and cleansing](#control-types)
- [Movement slows](#movement-slow)
- [Healing reduction](#anti-heal)
- [Outgoing and received healing bonuses](#direct-heal)
- [Regeneration and healing over time](#regen)
- [Bullet and spirit lifesteal](#lifesteal)
- [Lifesteal amplification order](#lifesteal-amp)
- [Ability cooldowns](#cooldown)
- [Duration bonuses](#duration)
- [Range and radius bonuses](#range)
- [Maximum health](#max-health)
- [Fire rate and fire-rate slows](#fire-rate)
- [Damage per second, accuracy and headshots](#dps)
- [Magazine and single-round reloads](#reload)
- [Effect uptime and overlap](#uptime)

<a id="stacking"></a>
## How percentages combine

**Fundamentals**

`Σx = x₁ + x₂ + …;   P(x) = 1 − ∏(1 − xᵢ)`

- xᵢ — one active bonus or penalty; write 30% as 0.30.
- ∏ means multiply all brackets. With no sources, P = 0.

With diminishing stacking, each new percentage affects the remaining share. If the current total is p, a source x adds x × (1 − p). Source order does not change the result.

The rule depends on the stat: ordinary weapon damage bonuses add together, while resistance and cooldown reduction use diminishing stacking.

Going from 30% to 40% adds 10 percentage points. Remaining damage falls from 70% to 60%, a reduction of about 14.29%.

**Example.** 30% and 20%: 1 − 0.70 × 0.80 = 44%. Simple addition would give 50%, while two positive multipliers, 1.3 × 1.2, would give +56% — three different results.

**Calculation conditions:**

- Combine only active bonuses to the same stat.
- Multiple stacks of one effect do not always count as separate sources.

<a id="resistance"></a>
## Damage resistance and resistance reduction

**Defense**

`R⁺ = P(r₁,…);   S⁻ = P(s₁,…);   R = R⁺ − S⁻;   D = D₀ × (1 − R)`

- rᵢ ≥ 0 — one resistance bonus for the chosen damage type.
- sᵢ ≥ 0 — one resistance reduction or innate negative resistance, entered without a minus sign.
- Bullet and spirit resistance are calculated separately.

Combine resistance bonuses with diminishing stacking. Separately combine resistance reductions and innate negative resistance, then subtract that total from the bonuses.

Resistance can fall below zero, causing the target to take more than the original damage.

**Example.** 40% and 20% resistance give 52%. Reductions of 25% and 20% give 40%. Final resistance is 12%: 880 out of 1000 damage gets through. Pocket’s −15% and an item’s +30% give 15%, rather than 19.5%.

**Calculation conditions:**

- Calculate one damage type at a time. Bullet and spirit resistance do not affect pure damage.
- Piercing, barriers and damage limits are handled separately.
- Enter each reduction as a separate positive number: 15;10, rather than −15;−10.

<a id="source-grouping"></a>
## Bonuses within one effect

**Defense**

`r_source = base + active internal bonus; then R⁺ = P(r_source,…)`

- First calculate the full bonus of each active effect.
- A component consumed by an item upgrade no longer counts as a separate item.

Bullet Resilience grants 30% plus a conditional 15%, forming one 45% source. Combine that source with other items afterward.

Other conditional bonuses, such as Frenzy, can combine differently. Stacks of one debuff first build up to that effect’s own limit.

**Example.** Resilience at 45% and Battle Vest at 18%: 1 − 0.55 × 0.82 = 54.9%. Incorrectly splitting these into 30%;15%;18% gives 51.21%.

**Calculation conditions:**

- While the condition is active, enter 45 as one value in the effective health calculator.
- Count protection that applies to only part of the health bar only for that part.

<a id="ehp"></a>
## Effective health

**Defense**

`EHP = HP / (1 − R);   ΔEHP = EHP − HP`

- HP — maximum health in the chosen state.
- R — total resistance to the chosen damage type.

Effective health is the amount of damage before resistance that a hero can survive. Resistance does not increase the health bar itself.

Use constant resistance, without healing, evasion, executions or extra protection. A separate constant incoming damage multiplier m changes the denominator to (1 − R) × m.

**Example.** 1000 HP with 44% resistance: 1000 / 0.56 = 1785.71 EHP. Actual HP remains 1000; the equivalent gain against this damage is 785.71. At −15% resistance: 869.57 EHP.

**Calculation conditions:**

- Resistance must be below 100%.
- If protection changes across the health bar, divide each portion by its damage multiplier and add the results.
- Calculate barriers separately; they do not automatically use the same resistance as health.

<a id="mixed-ehp"></a>
## Effective health against mixed damage

**Defense**

`EHP_mix = HP / [w_b × (1−R_b) + w_s × (1−R_s) + w_p];   w_b+w_s+w_p=1`

- w_b, w_s, w_p — shares of original bullet, spirit and pure damage.
- R_b, R_s — total bullet and spirit resistance.

Reduce each damage share by its own resistance, then add the results. Do not add bullet effective health to spirit effective health.

Damage shares and resistances must stay constant. If they change between hits, calculate the hits in order.

**Example.** 2000 HP, 60% Bullet damage with 40% resistance and 40% Spirit damage with 20% resistance: the denominator is 0.6×0.6 + 0.4×0.8 = 0.68. Mixed EHP is 2941.18.

**Calculation conditions:**

- Damage shares must add up to 100%.
- Pure damage is included without resistance reduction. Handle effects that affect all damage separately.

<a id="weapon-base"></a>
## Base weapon damage and weapon damage bonuses

**Damage**

`d_base = d₀ + B × g + S × k;   d_weapon = d_base × (1 + ΣW)`

- B = LVL − 1 — level increases, normally 0 to 35.
- g — damage gained per bullet or pellet for each level increase.
- S — spirit power; k — its contribution to weapon damage; W — active ordinary weapon damage bonuses as fractions.

First calculate base weapon damage at the chosen level and spirit power. Then apply the sum of ordinary weapon damage bonuses, including the item investment bonus.

Growth depends on the hero. Spirit power increases bullet damage for Vindicta, Grey Talon and Solomon, while it changes fire rate for Warden. Count the same fire-rate increase only once.

**Example.** Nurse Harrow after 10 level increases: 14.858 + 10×0.37436 = 18.6016. With 46%+20% weapon damage: 18.6016×1.66 = 30.878656 before other bonuses and defenses.

**Calculation conditions:**

- Calculate extra on-hit damage, additions after scaling and special charged shots separately.
- Use item values for the chosen game version.

<a id="spirit-scaling"></a>
## How stats scale an ability

**Damage**

`X = X₀ + Σflat_upgrade + (k₀ + Σscale_upgrade) × S`

- X — one property, such as damage, healing or duration.
- S — the stat that scales this property; it is not always spirit power.
- An upgrade can add to the base value or increase the scaling coefficient.

Calculate each ability property separately. A spirit power icon does not mean every part scales equally.

After calculating damage, apply target defenses and hit conditions. Calculate repeated ticks and hits on different targets separately.

**Example.** Kelvin's Ice Grenade: base 60, T1 +30, coefficient 0.6, T3 +0.8. At 100 Spirit: 60+30+(0.6+0.8)×100 = 230. With a final 20% Spirit Resist, 184 gets through.

**Calculation conditions:**

- This formula covers linear scaling. Special scaling, upgrade conditions and Brawl mode can change the calculation.
- Do not scale a tooltip value again if it already includes the bonuses.

<a id="hit-once"></a>
## Pellets and one hit per target

**Damage**

`Ordinary pellets: D_volley = Σd_hits;   one hit per target: D_volley_per_target = d if any trajectory hits`

- P — the number of shot paths.
- With one hit per target, several paths from one shot deal damage only once to that target.

For an ordinary shotgun, add the damage of every pellet that hits.

When a shot can damage a target only once, any one path hitting is enough. Three paths do not triple damage to one target.

**Example.** Baba: 8.8 damage and three paths with one hit per target deal 8.8 to one target, rather than 26.4. Drifter: 19.5 and three paths deal 19.5, rather than 58.5. Rat King: two ordinary bullets at 6 each deal 12.

**Calculation conditions:**

- Use the hit rules of each special weapon mode.
- Violet’s additional 4/8 paths do not multiply ordinary damage.

<a id="headshots"></a>
## Headshot damage

**Damage**

`C = 1 + (c − 1) × q_out × q_in;   D_head = D_body × C`

- c — the weapon’s headshot multiplier at the chosen distance.
- q_out — the attacker’s bonus headshot damage multiplier; 0.7 keeps 70% of the bonus part.
- q_in — the target’s incoming bonus headshot damage multiplier, separate from bullet resistance.

Subtract one from the headshot multiplier, modify the remaining bonus, then add one back.

The starting multiplier is often 1.65 for ordinary weapons and 1.35 for Rat King. Use the value for the specific weapon.

**Example.** Vyper: 1+0.65×0.7 = 1.455. Against Seven with an incoming bonus multiplier of 0.45: 1+0.65×0.7×0.45 = 1.20475. Body damage of 100 becomes headshot damage of 120.475 before resistance.

**Calculation conditions:**

- Apply this only to weapons that can deal headshot damage.
- Graves and special weapon modes can have their own critical-hit rules.
- Calculate creature weak points and bonuses against creatures separately.

<a id="falloff"></a>
## Damage falloff with distance

**Damage**

`t = clamp((x−a)/(b−a),0,1);   F = F_a + (F_b−F_a) × t;   D = D₀ × F`

- a, b — distances where falloff starts and ends; x — projectile travel distance.
- F_a, F_b — damage multipliers at those boundaries.

With linear falloff, damage decreases evenly between the two boundaries. Before the first, use the starting multiplier; after the second, use the final multiplier while the projectile can still reach.

Remaining damage depends on the weapon: the final multiplier is 0.6 for Drifter, 0.3 for Sinclair and 0.5 for Graves.

**Example.** With thresholds of 590 and 1300 units and a scale from 1 to 0.1, the midpoint of 945 units gives 0.55. Of 100 damage, 55 remains before other defenses.

**Calculation conditions:**

- Use this for linear falloff with a curve parameter of 0.5. Other curve shapes need a different calculation.
- If both boundaries and multipliers match, the multiplier stays constant.
- When firing through a portal, projectile travel can differ from the direct distance to the target.

<a id="damage-amps"></a>
## Damage amplification and reduction

**Damage**

`D = [d_base × (1+W) × (1+ΣA) + flat_post] × ∏(1+M) × F × C × (1−R)`

- A — bonuses that add together, with penalties entered as negative values.
- M — separate damage multipliers.
- flat_post — damage added after the relevant scaling.

Additive bonuses, separate multipliers, amplification on the target, protection after resistance and extra hits use different rules. An effect’s name alone does not determine its calculation order.

For Inhibitor −30% with Fire Scarabs −20%, use a combined 50% penalty in this calculation. Rat King’s protection is a different effect and does not join that sum.

The order of constant independent multipliers does not change the result. Hit order matters: on-hit resistance reduction can affect only later hits, while an extra trigger deals separate damage.

**Example.** Base 100, Weapon Damage 50%, additive amplification 20% and a 30% penalty, flat addition 10: 100×1.5×0.9+10 = 145. A separate 25% amplification → 181.25; with 20% resistance → 145.

**Calculation conditions:**

- Enter additive bonuses separately from independent multipliers.
- Do not apply one stacking rule to every damage reduction effect.

<a id="debuff-duration"></a>
## Debuff resistance

**Control**

`R_d = P(r₁,…);   t_target = t_base × (1+U) × (1−R_d)`

- t_base — duration after flat increases and scaling of the relevant ability property.
- U — the attacker’s combined duration bonus.
- R_d — the target’s debuff resistance.

Active debuff resistance sources combine with diminishing stacking. The attacker’s duration bonus and the target’s resistance apply as separate multipliers.

Check whether the specific effect can be extended or shortened. Auras, trigger delays and lingering effects have different timers. A constantly refreshed aura can keep an effect active almost continuously.

**Example.** 25% and 22% debuff resistance give 41.5%. A 4-second effect without duration amplification lasts 2.34 seconds. With a 4-second base, +20% duration and 25% debuff resistance: 4×1.2×0.75 = 3.6 seconds.

**Calculation conditions:**

- Shortening an effect does not necessarily preserve its total damage over time.
- Calculate chains of control using each effect’s rules and hit timing.

<a id="control-types"></a>
## Resistance, immunity and cleansing

**Control**

`Resistance → shorter applicable status;   Immunity/Suppression → prevent or suppress;   Purge → remove an eligible modifier`

- Each effect has its own affected states and exceptions.

Resistance shortens applicable debuffs and does not remove existing ones. Immunity can suppress a state while the effect’s timer keeps running.

Cleansing removes only effects that allow removal. Unstoppable and Dispel Magic have different rules. Unstoppable’s protective buff cannot be cleansed.

**Example.** If an aura repeatedly applies a short slow, shortening each instance does not necessarily free the hero while they remain inside the aura.

**Calculation conditions:**

- Check the specific control effect and the protection being used.
- Damage immunity does not imply control immunity.

<a id="movement-slow"></a>
## Movement slows

**Control**

`S = P(s₁,…);   Q = Σqᵢ;   S_eff = S × (1−Q);   v = 2 + (v₀−2) × (1−S_eff)`

- sᵢ — ordinary percentage movement slows.
- qᵢ — active slow resistance bonuses, added together in this calculation.
- v₀ ≥ 2 m/s — speed before slows.

Ordinary slows combine with diminishing stacking. Slow resistance reduces their strength rather than their duration.

In this calculation, slows reduce the portion of movement speed above 2 m/s.

**Example.** 30% and 25% slows → 47.5%. Slow resistance of 25%+35% → 60%. Effective slow: 19%. Starting at 10 m/s: 2+8×0.81 = 8.48 m/s.

**Calculation conditions:**

- Enter slow resistance from 0 to 100%; exceeding 100% does not grant speed.
- This covers ordinary movement. Stuns, roots, dashes, airborne movement, sprinting, urn limits and forced speeds are handled separately.

<a id="anti-heal"></a>
## Healing reduction

**Healing**

`A = P(a₁,…);   M_anti = ∏(1−aᵢ);   H_after = H_before × M_anti`

- aᵢ — separate active healing reduction effects.
- Received healing and regeneration penalties from one source affect different types of recovery and do not add together.

Healing reduction weakens applicable direct healing, regeneration and lifesteal. Different sources combine with diminishing stacking; reapplying the same effect does not necessarily add another source.

Healbane and Toxic Bullets each reduce received healing and regeneration by 35%. One item does not provide 70%. Barriers and maximum health changes are handled separately.

**Example.** Healbane 35% and Toxic 35% give 57.75% healing reduction. A 200 heal with 20% outgoing amplification: 200×1.2×0.65×0.65 = 101.4 health, provided that much health is missing.

**Calculation conditions:**

- Repeated applications can refresh duration or use the strongest effect.
- Pocket’s T3 Affliction prevents healing through a separate effect.
- Fountain recovery and some external sources can be exempt from healing reduction.

<a id="direct-heal"></a>
## Outgoing and received healing bonuses

**Healing**

`H_potential = H₀ × M_cast × M_receive × M_anti;   H_actual = min(HP_missing, max(0,H_potential))`

- M_cast — the active outgoing healing multiplier.
- M_receive — the separate received healing multiplier.
- Enter an already combined multiplier for each group.

Identify who provides the healing and which type of recovery it uses. Healing Booster grants 20% outgoing healing and 20% regeneration, rather than a universal received healing bonus. A recipient’s Booster alone does not boost every heal from someone else by 20%.

With self-healing, the source and recipient are the same hero. Do not apply a bonus again if the starting value already includes it.

**Example.** A 250 heal with 20% outgoing amplification and 35% healing reduction can restore 195 health. If only 100 is missing, it restores 100 and the rest is lost.

**Calculation conditions:**

- Barriers have their own amplification.
- Outgoing healing and regeneration bonuses apply to different recovery types; do not multiply Booster’s two 20% bonuses into 1.44 for every tick.
- Combine multiple bonuses according to the rules of their effects first.

<a id="regen"></a>
## Regeneration and healing over time

**Healing**

`H(t) = rate × t × M_applicable_branch, capped by HP_missing`

- rate — health restored per second after active additions, bonuses and combat conditions.

At a constant rate, multiply recovery per second by duration. Increasing the rate, total healing and duration are different bonuses; a longer effect does not always restore more health.

Victor’s base regeneration is 1.5 + 0.08 × spirit power. With 38.5 natural spirit power at level 36, this gives 4.58 health per second without items. Nurse Harrow has 0 base regeneration; receiving healing does not add it by itself.

**Example.** A constant applicable regeneration rate of 10 HP/s over 5 seconds would restore 50 HP; with one 35% anti-heal source, 32.5 HP, provided health is missing throughout.

**Calculation conditions:**

- Out-of-combat recovery, fountains and external healing can have separate rules.
- Account for tick frequency, tick order and whether the effect includes an initial or final tick.

<a id="lifesteal"></a>
## Bullet and spirit lifesteal

**Healing**

`L = P(l₁,…);   H₀ = D_eligible × L × k_target × e_hero`

- Bullet and spirit lifesteal are calculated separately.
- D_eligible — actual damage dealt that qualifies for lifesteal.
- k_target = 1 against heroes; ordinary non-hero factors are 0.6 for bullet and 0.4 for spirit damage.

First combine applicable lifesteal sources of one type with diminishing stacking. A bonus for a marked target or one ability applies only to those hits.

Then apply hero and target effectiveness, healing amplification and healing reduction. Rat King’s separate effectiveness factor is 0.75; this is not a 75% bonus.

**Example.** 13% and 28% → 37.36%. From 200 eligible damage to a hero: 74.72 HP before other healing modifiers. For an ordinary Bullet non-hero target: 44.832; Spirit non-hero target: 29.888.

**Calculation conditions:**

- Damage to barriers, overkill damage, summons and structures have their own eligibility rules.
- The fixed heal from Melee Lifesteal is not a percentage of global bullet lifesteal.
- Calculate healing built into an ability separately from general lifesteal.

<a id="lifesteal-amp"></a>
## Lifesteal amplification order

**Healing**

`A: D × P(lᵢ) × (1+a);   B: D × P(lᵢ × (1+a))`

- a — outgoing healing bonus, if it is not already included in the lifesteal values.
- Option A amplifies the final heal; option B amplifies each lifesteal source first.

The calculator compares two calculation orders. Option A combines lifesteal sources with diminishing stacking, then amplifies the resulting heal. Option B amplifies each source before combining them.

The order depends on how the specific bonus applies. If that order is unknown, compare both results. With 0 amplification they match. If the lifesteal values already include amplification, leave outgoing amplification at 0.

**Example.** 13%+28% lifesteal, 20% amplification, 200 damage: option A gives 89.664 health; option B gives 87.9168 before healing reduction and the missing-health limit.

**Calculation conditions:**

- These options show the effect of calculation order; they do not mean every in-game effect uses both orders.
- Option B is supported only while each amplified source remains below 100%.

<a id="cooldown"></a>
## Ability cooldowns

**Timing**

`C = P(c₁,…);   T_final = T_upgraded × (1−C);   ideal_rate = 1/T_final`

- T_upgraded — cooldown after flat upgrade adjustments.
- cᵢ — separate active cooldown reductions for the same timer type.

Ordinary cooldown reduction bonuses combine with diminishing stacking. They shorten time: 20% reduction increases use frequency by 1/0.8 = 1.25 times if other conditions stay the same.

Abilities, items, ultimates, charge recovery, delays between charges and parries have different timers. Ability cooldown reduction does not automatically affect active items.

**Example.** 60 seconds with 20% and 5% cooldown reduction: 24% total reduction leaves 45.6 seconds. If an upgrade first reduces the base to 50 seconds, the result is 38 seconds. Dispel at 45 seconds with an applicable 25% item cooldown reduction takes 33.75 seconds.

**Calculation conditions:**

- Actual use frequency depends on when the cooldown starts, cast and channel time, resources and charges.
- Cooldown resets and reductions to remaining time are separate operations.
- Apply special time limits according to the specific ability’s rules.

<a id="duration"></a>
## Duration bonuses

**Timing**

`U = P(u₁,…);   t_final = t_upgraded × (1+U)`

- uᵢ — separate active duration bonuses.

Ordinary duration bonuses combine with diminishing stacking. The combined bonus increases the starting duration.

Duration Extender grants 20% and Superior grants 28%. A component consumed by an upgrade does not count as a second item.

**Example.** 28% and 15% → 1−0.72×0.85 = 38.8%. A 10-second base becomes 13.88 seconds, rather than the 14.72 seconds from 1.28×1.15.

**Calculation conditions:**

- The effect must allow duration increases.
- Handle flat seconds, spirit scaling, channel time and projectile lifetime separately.

<a id="range"></a>
## Range and radius bonuses

**Timing**

`U_range = P(r₁,…);   range_final = range_upgraded × (1+U_range)`

- range_upgraded — the chosen property’s starting range or radius in meters after upgrades.

Ordinary percentage bonuses to range or radius combine with diminishing stacking.

Cast range, explosion radius, width, height and projectile travel distance are different properties. A radius bonus does not necessarily increase cast range, or vice versa.

**Example.** 30% and 5% → 33.5%. A 20-meter radius becomes 26.7 meters if both sources apply.

**Calculation conditions:**

- These bonuses do not automatically change weapon falloff or dash distance.
- Radius alone does not remove line-of-sight requirements or height limits.

<a id="max-health"></a>
## Maximum health

**Stats**

`HP_max = ceil[(HP₀ + B × g_HP) × (1+b_base) + HP_flat]`

- b_base — combined bonus to base health and health gained from levels.
- HP_flat — ordinary health additions not increased by this base health bonus.
- ceil — round the result up to a whole number.

First increase the hero’s base health together with health gained from levels. Then add ordinary item health; do not multiply it by the base health bonus again.

Use the vitality investment bonus for the currently reached threshold. Do not add the percentages from earlier thresholds.

**Example.** Base health 800, 10 level increases at 49 each, 20% base bonus and 210 added health: ceil((800+490)×1.2+210) = 1758 health.

**Calculation conditions:**

- Glass Cannon’s total health penalty, unscaled bonuses, health stealing and forced maximum health changes need separate calculations.
- Changes to current health when maximum health changes are handled separately.

<a id="fire-rate"></a>
## Fire rate and fire-rate slows

**Timing**

`H=Σhᵢ; Q=P(sᵢ); z=max(−0.50,H−Q); f=f₀×(1+z) when z≥0; f=f₀/(1−z) when z<0`

- hᵢ — ordinary positive fire-rate bonuses.
- sᵢ — separate fire-rate slows, rather than movement slows.

Positive fire-rate bonuses add together, while fire-rate slows combine with diminishing stacking. Subtract the second total from the first, then use the appropriate branch of the formula.

For a negative total, divide the starting fire rate by 1 − z. Handle changes to the base time between shots separately.

**Example.** A base of 10 shots/s with 20%+30% bonuses gives 15. A 38% bonus and 25%+28% fire-rate slows give Q = 46%, z = −8%; 10/1.08 = 9.25926 shots/s.

**Calculation conditions:**

- Bursts, spin-up, charged shots and channeled weapons need their own firing cycle.
- A final −50% in this formula does not mean half the starting fire rate.

<a id="dps"></a>
## Damage per second, accuracy and headshots

**Timing**

`DPS = D_volley × f;   expected = DPS × p_hit × [1+h×(C−1)]`

- h — headshots as a share of hits; p_hit — the share of shots that hit.
- For bursts, the table uses f = N / [cycle + (N−1)×intra]: shots divided by cycle time plus the gaps within the burst.

Damage per second describes average damage output. If the starting damage already includes misses, do not apply accuracy again.

Burst results depend on whether the stated cycle already includes gaps between shots. Establish that meaning before choosing a fire-rate formula.

For an ordinary magazine, average damage including reload is m×D/(m/f+reload). First-shot timing, actions that overlap reloading and special modes can change the full cycle duration.

**Example.** Damage per shot 10, fire rate 5/s, magazine 10, reload 2 seconds: 50 damage per second while firing and an average of 25 including reloads. Seven fires 3 shots per burst, with a 0.2625-second cycle and 0.084-second gaps. Using the cycle alone gives 11.42857 shots/s; adding gaps between the shots gives 6.96864; adding a gap after every shot gives 5.83090.

**Calculation conditions:**

- For several paths that damage a target once, use the single-target damage. For spin-up weapons, choose the starting or fully spun-up fire rate.
- To calculate time to kill, account for individual hits, defenses, healing and pauses.

<a id="reload"></a>
## Magazine and single-round reloads

**Timing**

`Ordinary: T=T_reload;   single-round: T≈initial_delay+n×T_round;   one reduction q: T≈T₀×(1−q)`

- n — the number of rounds to insert.
- For single-round reloads, inserting one round takes a different amount of time from filling the whole magazine.

Abrams and Silver insert rounds individually, while Nurse Harrow reloads a whole magazine. For single-round reloads, add the initial delay to the time needed to insert the missing rounds.

One ordinary 20% reload reduction leaves approximately 80% of the starting time. Combine multiple bonuses according to their effects’ rules.

**Example.** Abrams: 0.705 seconds initial delay + 9×0.3525 seconds = 3.8775 seconds. Silver: 0.5+7×0.3 = 2.6 seconds. Nurse Harrow’s full reload takes 1.9 seconds; one 10% reduction lowers it to 1.71 seconds.

**Calculation conditions:**

- Active Reload, instant ammo refills, reload cancellation and active modes have separate timers.
- Pellets per shot do not equal ammunition consumed.

<a id="uptime"></a>
## Effect uptime and overlap

**Timing**

`uptime = min(1, duration / period);   overlap = length of the union of intervals`

- period — the time between application starts; it is not always the cooldown.

If an effect lasts T seconds and repeats every P seconds, its uptime is min(1,T/P). Account for cooldown start, cast time and resources.

Do not simply add overlapping stun durations: count the total time when at least one stun is active. Apply extension, refresh and delayed application according to the effect’s rules.

**Example.** A 6-second buff every 10 seconds → 60% uptime. Stuns over [0;2] and [1;3] control the target for 3 seconds, rather than 4 seconds.

**Calculation conditions:**

- The calculation needs known start and end times for each effect.
- Auras, duration resistance and missed applications can change those intervals.
