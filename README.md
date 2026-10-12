# MC Karting

Website for MC Karting, the go-kart track in the undercover parking at Highveld Mall, Emalahleni.

Live: https://obsidianstudiodesigns.github.io/MC-Karting/

- `index.html`: home page with the 3D hero, arrive and drive prices, online booking (sent via WhatsApp), and party, Grand Prix and year-end function enquiries (WhatsApp or email)
- `privacy.html`, `terms.html`: POPIA privacy policy and terms of use
- `assets/js/scene.js`: Three.js hero scene (procedural kart and garage track, PBR materials, post-processing with automatic quality tiers). Add `?debug3d` to the URL to expose `window.__mc` for tuning
- `assets/js/main.js`: price board, booking calculator (Friday Madness), enquiry forms
- Prices live in `PRICES` at the top of `assets/js/main.js` and in the static rows and JSON-LD in `index.html`

Designed by [Obsidian Studio Designs](https://obsidianstudiodesigns.co.za/).