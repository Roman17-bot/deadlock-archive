# Full-page review and actionable findings

Use this contract for a new page, significant section or an explicitly requested full review. A focused icon/control review can use the smaller verdict-and-findings format without seven irrelevant scores. Review identity consistency and artistic quality independently: a page can match Heritage and still have weak composition or generic graphics. Technical correctness alone does not establish artistic quality.

## Expert scorecard

Ratings respect page purpose and the user's performance-first constraint. A restrained fast table/catalogue/calculator can score highly through clear composition, typography, graphic precision and useful feedback. Missing spectacle is not a deduction. Do not recommend heavy effects without user direction; separate a measured regression from an unmeasured cost concern.

For a full review, give each criterion a **0–10 expert rating**, with a short reason tied to the inspected result. These are judgments, not measurements or an estimate of human/AI authorship.

| Criterion                                                                             | Weight |
| ------------------------------------------------------------------------------------- | -----: |
| Художественная выразительность и оригинальность / Artistic expression and originality |    20% |
| Композиция и визуальная иерархия / Composition and hierarchy                          |    15% |
| Качество графики и визуальных элементов / Graphics and visual elements                |    15% |
| Соответствие существующему дизайну / Consistency with the existing site               |    15% |
| Анимации и интерактивность / Motion and interaction                                   |    10% |
| UX и доступность / UX and accessibility                                               |    15% |
| Адаптивность и производительность / Responsiveness and performance                    |    10% |

With all seven criteria supported, compute `total = Σ(rating × weight) / 100`, reported out of 10 to one decimal. Do not change weights between iterations. Critical UX/accessibility failures block approval regardless of the total; a high total cannot compensate for a lost action or unreadable essential text. Do not invent an automatic passing threshold.

Judge the actual graphics/controls, and the appropriateness of restrained or absent animation. Do not lower a rating merely because there is no 3D, WebGL library or elaborate effect. Conversely, renderer/library presence is not artistic quality. For 3D that is present, consider geometry, materials, lighting, camera, integration, interaction and mobile cost; for motion consider timing, rhythm and interruption as well as technical execution.

If evidence cannot support a criterion, mark it **н/д / not assessed**, name the missing check and withhold the aggregate total. Do not invent a score, silently assume unseen mobile/performance behavior, or renormalize the other weights. Still rate supported criteria and return confirmed findings. A still image does not establish motion, accessibility behavior or performance. A code-only review is not a visual scorecard. Missing evidence alone is a review limit, not an observed product defect.

## Report structure

1. **Overall assessment:** exact artifact/stage, scope and verdict (`ready`, `ready-with-limits`, `changes-needed`); scorecard/total when supported, visual quality, consistency with the site, main strength and main issue. Record inspected views/actions and evidence limits.
2. **What to preserve:** specific successful composition, typography, graphics or useful behavior. Do not redesign them without a reason.
3. **Confirmed problems:** ranked actionable findings using the fields below. Normally focus on the five most consequential; disclose every blocking defect, grouping only issues with the same cause. Zero confirmed findings is valid. Separate defects, reasoned concerns and preference-based suggestions.
4. **Artistic opportunities:** clearly optional improvements to composition, typographic hierarchy, graphic craft, material/light, motion or transitions. Explain the concrete gain; avoid effects for their own sake. A technically sound but aesthetically weak result still merits a reasoned critique here or a scoped quality finding against the brief.
5. **Prioritized designer tasks:** confirmed usability/accessibility/identity problems first, then the highest-value artistic opportunities. Each task references a finding/opportunity and an observable acceptance check. Recheck fixes and related regressions; do not restart an unrelated full redesign.

## Finding fields

- **ID:** `DESIGN-001`, `DESIGN-002`, etc.; retain the same ID for the same finding across the next iteration.
- **Priority:** `Critical`, `High`, `Medium`, `Low`. Critical blocks essential use or presents a severe accessibility failure; High is a major usability/regression/identity issue; Medium is a material but local craft or consistency issue; Low is minor polish. Label taste-based opportunities as optional rather than disguising them as defects.
- **Element:** exact page region/component and file when known.
- **Problem:** concrete visible or reproduced behavior.
- **Evidence:** inspected screenshot/state, browser observation or exact code fragment; distinguish supplied evidence from personal observation and code inference.
- **Reason:** consequence for the player or a specific unmet creative requirement.
- **Recommendation:** smallest justified correction within scope, keeping successful and user-approved decisions.
- **Acceptance:** what observable result confirms the correction, including the relevant state/width/input or motion preference.

Do not use “make it prettier”, “improve UI”, “more modern” or “more premium” as a task. Identify the actual hierarchy, drawing, timing, material or interaction change and its purpose. Approved fonts and colors are not defects merely because the critic prefers others; resolve a demonstrated readability problem within the approved system before proposing a larger change.

Return text only. Do not write a report, screenshots, code, configuration or memory; the coordinator persists evidence and tasks. Follow [rendered-evidence.md](rendered-evidence.md) for observation limits. Scores do not grant implementation, installation, publication or game-launch permission.
