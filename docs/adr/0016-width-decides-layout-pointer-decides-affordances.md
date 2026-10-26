# Width decides layout, pointer decides affordances

The app has one nav breakpoint, `640px` (`useIsMobile`, ADR 0010), and it had quietly come to mean two different things: "this window is narrow" and "this is a phone".
A phone held sideways is 844px wide, so it crossed the line and received the desktop layout together with the desktop's keyboard hints - a `⌘K` chip on the search box, and a Tour step that promised a shortcut the device has no key for.

**Width Class decides what is laid out. Pointer Class decides which affordances are offered.**
The two signals already existed (`useIsMobile` / `useWidthClass` read width; `useFinePointer` reads `(pointer: fine)`, the inverse of the 44px Touch Rule's own `(pointer: coarse)`); what was missing was the rule that a width may never stand in for a pointer.
Concretely: a keyboard shortcut is shown only to a Fine pointer, and a control grows to 44px only for a Coarse one - and neither question is ever answered by asking how wide the window is.

## Considered options

**Add `(pointer: coarse)` to `useIsMobile`**, so a landscape phone keeps the phone layout.
Rejected for two reasons.
It makes a touchscreen laptop permanently mobile, which is wrong about the one thing width is actually good at.
And `useIsMobile` is read by the nav, the editor sheet and the toolbar at once, so putting the pointer into it decides all three from one signal - which is exactly the conflation this ADR exists to undo.
Where a single surface genuinely needs the pointer, it reads the pointer itself; see the toolbar in Consequences.

**Keep the landscape nav layout wide** was the other half of the decision, and it is the one a reader is most likely to want to "fix".
PRODUCT.md names mobile landscape as an explicit target, and 844x390 genuinely has room for the rail and the inline capture bar; forcing the phone layout there would waste the axis the orientation exists to provide.

## Consequences

The 44px Touch Rule and the collapsed nav rail now have to coexist rather than take turns.
`SideNav` sets `px-4` on its groups, which left exactly 32px of content inside the 64px rail - enough for the rail's `size-8` buttons and 12px short of the Coarse floor, so the buttons overflowed right and dragged the first glyphs of their labels into a rail that is supposed to be icons only.
The rail makes room (`px-2` when collapsed) rather than opting out of the floor: 44px hit boxes at the rail's 36px pitch would have overlapped adjacent nav items, and a mis-tap in navigation is worse than the bug being fixed.

**The editor toolbar is the one Width Class that is not decided by width alone**, and it is the second place the same conflation was hiding.
`useWidthClass` now answers `compact` when the window is narrow **or** the primary pointer is coarse.
The Compact Layout was always specified in pointer units rather than width ones: its six slots are 44px apiece because of DESIGN.md's Touch Rule, and its "one row, never wrapping" rule exists because it rides above a virtual keyboard.
Both are facts about the pointer, so a width was standing in for one - the substitution this ADR forbids.
The landscape phone is where it showed: 844px of width bought the Wide Layout, which wraps, four rows deep, on a screen 390px tall with the keyboard about to take half of it.
`useWidthClass` is the sole consumer of the pointer signal, so nothing can desynchronise from it, and `(pointer: fine)` means a mouse is the *primary* pointer - a touchscreen laptop with a trackpad keeps the Wide Layout, and only a touch-only device flips.
`foldMarker`'s six-slot capacity stays 360px arithmetic: it is the floor the same Layout has to survive in the narrowest orientation, and a marker that moved with the current window would tell a user something different every time they rotated while editing one list.

Reading the query rather than the window is what makes any of this hold on a real device.
`useIsMobile` used to listen to the media query and then answer from `window.innerWidth`, and on an Android rotation those two disagree: the metrics are not guaranteed to have landed when the query changes, and no second event arrives to correct a wrong answer.
A phone rotated into portrait kept the Wide toolbar - wrapping, four rows - pinned to the bottom by the CSS, which had switched correctly because the stylesheet asks the query.
The hook now asks the same query, so JS and CSS cannot answer differently.
The cost is paid in tests: jsdom evaluates no media query at all, so setting `innerWidth` no longer simulates a viewport and `src/test/viewport.ts` does it instead.

## Amended 2026-10-25

A touch tablet in a keyboard case has a Coarse pointer and every key, so keyboard affordances now also follow a hardware key pressed this session ([ADR 0028](./0028-a-hardware-key-earns-keyboard-affordances.md)).
Width still never stands in for either, and the Width Class does not read the keyboard.
