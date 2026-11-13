# D-0008: The app never prints an angle read from the 3D model

- Status: accepted
- Date: 2026-11-12
- Decided by: Lead (the build session)
- Teams: chem, lewis

## Context
The 3D view settles the electron groups with a small repulsion model. Its three strengths (lone pair to lone pair 2.6, lone pair to bond 1.4, bond to bond 1) were picked so that the textbook arrangement is the lowest-energy one for all 13 shapes. They are not fitted to measurements, so an angle read off the model would be a made-up number shown as a fact.

## Decision
Angle text comes from the shape table (the ideal angles in OpenStax Chemistry 2e, section 7.6), or from the two measured angles that section prints: water 104.5° and ammonia 106.8°. The model only decides whether an angle arc is drawn.

## Consequences
- An arc shows while its two bonds really are at that angle, so it goes away while a student pulls the model out of shape.
- When the outer atoms are different elements, the label says "about".
- Known gap: the model's seesaw (SF4) has its two middle bonds about 125° apart where the textbook says under 120°, so that arc is not drawn (W-006).
