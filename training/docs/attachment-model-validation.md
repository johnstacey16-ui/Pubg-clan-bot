# Attachment preset scoring — regression and limits (October 2026)

**Scope:** The Attachment Calculator's Best Vertical, Best Horizontal and Balanced presets select the highest-scoring legal combination **within its current additive modifier model**. They are not verified winners of actual 30-round spray testing.

## Verified patch facts

PUBG Update 41.1 (https://pubg.com/en/news/9926) explicitly documents the Tilted Grip at **12% vertical recoil control**, **6% horizontal recoil control** and **25% camera-shake control**. It also upgrades Half Grip horizontal control from **8% to 16%**, and removes Angled Foregrip from world spawn. The calculator stores camera shake separately rather than pretending it is vertical/horizontal recoil.

## Owner-built scoring model

For legal muzzle + grip + stock options, sum the listed vertical, horizontal and recovery modifier contributions. The Vertical preset weights vertical reduction at 1000 times the primary term, Horizontal reverses that priority, and Balanced favors combined control with a penalty for an unbalanced pair. It deliberately does **not** simulate player input, spread randomness, firing cadence, camera shake, screen-pixel recoil, recovery curves, or multiplicative interactions not established by source data.

`tests/attachment-model-all-weapons.test.cjs` enumerates every legal muzzle, grip and stock combination for all 45 weapons and checks that each proposed preset has the highest score under these declared rules. This catches compatibility and optimization regressions, **not** physical in-game effectiveness.

## Next evidence needed

Before changing attachment effects to a multiplicative/interaction model, obtain repeatable current-patch measured spray or extracted game-system evidence covering paired attachments on the same weapon, stance and firing mode. Do not invent multipliers to make a preset look more realistic.
