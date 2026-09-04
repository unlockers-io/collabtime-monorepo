# Focus Black

Focus Black is Collabtime’s visual system: a still, monochromatic workspace where brightness establishes hierarchy and the shared meeting window is the clearest object on the page.

## Principles

- Use the shadcn neutral theme as the sole color source. Light and dark modes are equal presentations of the same system.
- Prefer open composition, rules, and whitespace over cards, shadows, gradients, or ornamental containers.
- The timeline is the primary visual material. Working hours use a middle brightness, overlap uses a stronger field, and current time is a single high-contrast line.
- Use Manrope for interface hierarchy, Inter for body copy, and Geist Mono only for clocks, hours, offsets, and measurements.
- Keep corners restrained. Small controls may use the shared radius; content regions stay square and flat.
- Reserve chroma for destructive, warning, success, and informational feedback where color improves safety. Normal navigation and product state remain monochromatic.

## Direction record

- **FORM:** Depth-ranked black interface, fused from challenger `operate-c-cracktro-scroller-queue` in direction seed `ddb70053`.

## Light and dark

- Theme values follow shadcn's canonical neutral semantic contract: background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, charts, and sidebar.
- Components consume semantic Tailwind utilities rather than raw palette colors or direct CSS values. Product-specific success, warning, and info roles extend that same token contract.
- Dark: neutral near-black ground, light foreground, and translucent shadcn borders and inputs.
- Light: white ground, neutral foreground, and shadcn's pale neutral surfaces.
- Respect the saved `next-themes` preference and system setting. All surfaces and browser chrome must work in both modes.

## Motion

The front plane stays still while read. Use short opacity changes for state replacement and layout animation only where it communicates reordering. Avoid ambient motion, glow, and decorative entrances.

## Core surfaces

- Landing: one large proposition, concise supporting copy, and the real timeline in the first viewport.
- Dashboard: a workspace index rather than a welcome screen; rows are separated by rules and the creation action remains visible.
- Team: the timeline leads, status follows as a compact strip, and roster/group management reads as flat operational lists.
