# shared/ui policy

`shared/ui` is for small presentation primitives whose **meaning and behavior are domain-neutral**.

Good examples: Button, Card, Typography, Spinner.

`LearningCard` is the shared, domain-neutral visual surface for term, meaning, and sentence cards. Games provide their own labels, tones, selection behavior, and content while reusing its layout and interaction states.

Do not move a component here only because two screens look similar. Game timers, scoreboards, hints, answer tiles, lobby controls, and admin widgets stay with their owning feature/game until the same semantics are genuinely shared.

Hard rule: files in this directory may not import from `games`, `features`, `multiplayer`, `auth`, `firebase`, or `game-engine`.
