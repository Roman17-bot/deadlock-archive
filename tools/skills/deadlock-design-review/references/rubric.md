# Review criteria

## Brief and layout

Compare the same route, content, language, theme and viewport before/after. Record which screenshots or live states were inspected. Check navigation order, search/filter/result placement, side-panel position, table scrolling and calculator/update actions. Small spacing/type changes are allowed; transferring controls to another region or hiding an existing action is scope drift unless separately requested.

## Product identity, not authorship detection

Ask what makes the result belong to Deadlock Archive. Specific illustration, material, lettering or icon decisions should support the noir/1930–40s city direction and data-reference purpose. Look for repeated card shells, gratuitous labels/badges, arbitrary icon metaphors, unmotivated gradients/glows, decorative numbering, empty marketing copy and competing animations.

These are prompts for judgment, not automatic failures. Existing dark colors, serif headings, fine rules and category colors may be appropriate to this brief. Don't replace them merely because a general anti-template guide lists similar patterns. Identify the concrete repetition, its effect and a smaller improvement.

## Reading and interaction

- RU/EN body text and long labels stay readable; numbers align and remain easy to compare.
- Palette and states distinguish text, selected/disabled controls and game categories without relying only on color. For measured contrast, report sampled colors/state and method; screenshots alone are insufficient for exact compliance claims.
- Keyboard focus, hover, touch targets, reduced motion, empty/error/loading states remain usable. Decorative SVGs have appropriate semantics; icon meaning survives small size.
- Relevant narrow/wide views preserve current order and show all required controls. Browser geometry verifies overflow/sticky behavior; jsdom does not.
- Original assets remain crisp and lightweight; no performance regression from large textures, font loading or constant motion.

## Motion

Review animation at normal speed with actual triggers, repeated activation and reduced motion when available. Check that movement fits the task, remains contained in the existing area, can be interrupted and does not delay the result. Keyboard/touch and OS motion preferences retain all feedback. Source review can identify missing cleanup or an unguarded animation, but a still image cannot prove timing, smoothness or reduced-motion behavior; record those checks separately. No blanket ban on custom animation: ask whether the particular effect makes the action clearer or the product more distinctive without distracting from the data.

## Findings

Block on lost functionality, unreadable text or serious layout drift. Rank lesser consistency/usability issues by actual impact. Pure style preferences are suggestions, not defects. A finding includes location, observation, consequence, smallest fix and evidence/limits. Zero confirmed findings is valid; unresolved checks are not silently treated as passed.

Do not use a single invented beauty/AI score as acceptance. Review the design proposal first and implemented screens again after integration; they are different artifacts.
