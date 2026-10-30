# Custom motion and implementation handoff

Create motion for the particular interaction: a crisp filter selection, a restrained archive-tab transition, an icon response, a panel opening or a meaningful loading/result change. Noir character can come from a mechanical stop, an engraved line or a small shutter reveal. These are options, not effects to repeat on every control. Keep the existing layout, text and interaction targets stable.

Prefer scoped CSS transitions/keyframes and SVG for small effects. Use the Web Animations API when cancellation, reversal or sequencing warrants JavaScript; supply React/TSX when component state is involved. Do not add a general motion dependency for a simple effect. If a larger library materially helps an assigned task, explain the reason and loading cost before proposing it.

For each effect provide runnable source and a concise specification: target selector/component, trigger, duration/easing, initial/final state, replay rules, interruption/cancellation, reduced-motion alternative and integration files. Short control responses around 120–220 ms and contained reveals around 180–320 ms are starting points, not requirements. No artificial delay before filtering, navigation or displaying loaded data.

Include fallback behavior and a proportional performance plan: what will be measured on the representative surface, and which browser/device checks remain open. For a Canvas/WebGL/3D effect also read [creative-graphics.md](creative-graphics.md); ordinary button feedback does not need a renderer.

Animate transform/opacity when suitable. Avoid animating document geometry for decoration, broad `transition: all`, permanent `will-change`, flashing, continuous background loops or mass stagger on the item grid. Clip only decoration, not focus outlines or content. Check actual animation/paint cost when it is material; don't claim a frame-rate target from source inspection alone.

Honor `prefers-reduced-motion` in CSS and JavaScript. The reduced version keeps the final state and task feedback without spatial movement. React examples clean up event listeners and cancel owned animations on interruption/unmount; repeated clicks and Strict Mode must not duplicate effects. Touch/keyboard users can perform every action without hover, and a change to the OS motion preference is handled when JavaScript retains that preference.

Keep editable sources and a self-contained preview in the assigned private designer run. Website/coordinator integrates accepted work into the existing components, using the same semantics, focus behavior and loading/error states. Give designcritic a rendered preview plus normal/reduced-motion interaction evidence. Static screenshots show appearance only; identify motion behavior that has not actually been exercised.

Technical references, checked 29 October 2026: [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), [MDN Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API), [web.dev animation performance](https://web.dev/articles/animations-guide). Verify relevant browser support when using an unfamiliar or recently added API.
