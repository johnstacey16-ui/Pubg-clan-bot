# Reload-inclusive TTK: provenance and limits (October 2026)

## What the toolkit computes

Normal TTK is `(hits to kill - 1) × 60 / weapon RPM` and **does not need a reload time**. The additional `Incl. reload` estimate is relevant only if hits to kill exceed the current magazine capacity. For a full magazine, reload count is `ceil(hits-to-kill / magazine-capacity) - 1`. The damage/RPM values have their own accuracy constraints.

## Provenance

- **Published base reloads:** RPD **5.2 s**, M249 **5.962 s**, from PUBG's 2026 developer letter, https://pubg.com/en/news/10874. These already reflect the 42.3 balance baseline. Do not apply the LMG reload-speed adjustment twice.
- **Unknown:** MG3 measured reload duration is not independently verified. Do not substitute its legacy data-table placeholder.
- **Other weapons:** Original supplied values are retained as model inputs. They have not all been independently verified against current reload animations and are explicitly treated as estimates when a reload is needed. Do not treat these as official timings.

For fights completed within a magazine, pure and reload-inclusive values match by definition; this is not evidence that reload timings are verified. Shotgun full-pellet connections and hit-to-kill limitations remain separate. This note is for maintainers, not a public research panel.

## Follow-up audit

Only change a weapon's reload provenance when a citable current-patch measurement is located. Include weapon, magazine/attachment variant, patch, reload-animation start and stop definition, and source URL. Do not infer base reload time from reload-speed attachment percentages.
