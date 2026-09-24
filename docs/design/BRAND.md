# PDF Master brand refresh

The supplied `PDF_Master_Brand_Assets.zip` is the source of the artwork in `public/brand`. SVG paths, proportions and colors are unchanged. `BrandLogo` renders the outlined wordmark; `BrandIcon` renders the connected document pages. The original wordmark sits on a white surface in dark mode to preserve its dark ink lettering.

## Palette

- Original artwork: PDF red `#FA3331`, page blue `#0275FC`, wordmark ink `#17212E`.
- Primary controls: white text on `#005FCC` (hover `#004DA8`). The darker blue maintains normal-text contrast; exact brand blue remains in artwork, navigation accents and decorative surfaces.
- Light canvas: `#F4F7FC`, white panels, ink `#17212E`, secondary text `#54647A`.
- Dark canvas: `#101824`, panels `#182435`, ink `#EDF3FC`, secondary text `#A9BBD3`.
- Success, warning and error retain distinct semantic color tokens in both themes.

`main.css` owns shared theme tokens. `extended.css` applies them to the additional workspace tools. `brand.css` owns identity sizing, navigation accents, cards, landing artwork and sign-in presentation. Existing functional icons keep their familiar meanings while using the brand palette.

## Assets and surfaces

The desktop sidebar, public header, mobile header and footer use the supplied wordmark. Sign-in, upload area, public hero, final call to action and local bot avatar use the supplied icon. Browser icons include SVG plus the supplied 32px and 64px PNGs; Apple touch uses the supplied 256px icon. The favicon URL is versioned to refresh the previous cached artwork.

The new document branding accent defaults to the supplied blue only when a user enables branding for a new document. Existing saved custom branding and document content colors are preserved.
