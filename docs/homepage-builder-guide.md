# Éclat Homepage Builder — Content Guide

A field-by-field reference for editing the storefront homepage from the admin panel. No coding needed — every section on the homepage is edited here.

---

## How the Homepage Builder works

**Where to find it:** log in to the admin panel, then click **Homepage** in the left sidebar.

**The basics:**

- The homepage is made of **sections**, stacked top to bottom in the order shown in the list (Hero, Trust Strip, Weekly Highlights, and so on).
- Every section has an **internal name** (only you see this — it's just a label to tell sections apart) and its real, customer-facing **content** (the text, images, and products shown on the site).
- Changes you make are saved as a **draft** immediately. Customers do **not** see draft changes until you click **Publish changes**.
- Use **Preview** (the eye icon) to open the live site showing your draft, before anyone else sees it.
- **Enable / Disable** a section to hide it from the site without deleting it.
- **Duplicate** copies a section (handy for making a second banner or a similar tile grid).
- Sections marked with a lock icon (Header, Announcement Bar, Footer) appear on **every page** of the site, not just the homepage, so they can't be reordered or deleted — only edited.
- Drag order is controlled with the up/down arrows next to each section.

**Uploading images:** every image field has an **Upload** button — click it, choose a photo from your computer, and the image address fills in automatically. You never need to type an image URL by hand.

**Picking products:** fields labeled "Product" or "Products" show a checklist of every product in your catalogue — tick the ones you want to feature. The product's name, price, and image are then pulled automatically from its real catalogue listing, so you only pick *which* products, never re-type their details.

**Text formatting:** in Title fields, wrap a word in single asterisks for *italic* emphasis (`Find your *pearl* mood`) or double asterisks for **bold** (`**Wear.** Love. Shop.`). This matches how the original homepage design highlights certain words.

---

## Table of contents

1. Announcement Bar
2. Header Navigation
3. Hero
4. Trust Strip
5. Category Navigation
6. Weekly Highlights
7. The Éclat Edit
8. Banner Image
9. Shop by Occasion
10. Featured Collection
11. Curated Gift Edits
12. Find Your Pearl Mood
13. Shop the Look
14. Testimonials
15. Pearl Journal
16. Pearl & Jewellery Guide
17. Most Searched
18. Newsletter
19. Footer

---

## 1. Announcement Bar

The scrolling strip of messages at the very top of every page.

| Field | What to put | Example |
|---|---|---|
| **Messages** (list — add as many as you like) | One short promotional line per row | `Complimentary insured shipping above ₹2,999`, `15-day easy returns`, `Certified real freshwater pearls`, `Cash on delivery available` |

---

## 2. Header Navigation

The main navigation menu and WhatsApp contact number, shown on every page.

| Field | What to put | Example |
|---|---|---|
| **Nav links → Label** | The text shown in the menu | `Office & Daily` |
| **Nav links → URL** | The page it links to, starting with `/` | `/collections/office-daily` |
| **WhatsApp number** | Your business WhatsApp number, country code first, no spaces or `+` | `919999999999` |

Add one "Nav link" row per menu item, in the order you want them to appear.

---

## 3. Hero

The full-width image carousel at the top of the homepage.

| Field | What to put | Example |
|---|---|---|
| **Slides → Image** | Upload a wide lifestyle/model photo (landscape, at least 1600px wide) | *(uploaded file)* |
| **Slides → Alt text** | A plain description of the photo, for accessibility and search engines | `Woman wearing an Éclat pearl necklace and earrings` |
| **Slides → Collection name** | The short name shown as the big heading on the slide | `Moonlit` |
| **Slides → Kicker** | The small line above the collection name | `The new harvest` |
| **Slides → Line** | One sentence of supporting copy under the heading | `Luminous freshwater pearls, grown with patience and finished by hand.` |
| **Slides → Collection slug** | The URL the "Shop the collection" button goes to (must match a real collection page) | `moonlit` |
| **Promise marquee** (list) | Short trust phrases scrolling under the hero | `Certified real pearls`, `Free insured shipping above ₹2,999`, `15-day easy returns` |

Add one "Slide" row per photo in the carousel — most homepages use 2–4.

---

## 4. Trust Strip

The row of small icon + label badges just under the hero (e.g. "Certified real pearls").

| Field | What to put | Example |
|---|---|---|
| **Items → Icon name** | One of the supported icon names (ask your developer for the current list — common ones are `ShieldCheck`, `RotateCcw`, `Truck`, `Sparkles`) | `ShieldCheck` |
| **Items → Label** | The short phrase next to the icon | `Certified real pearls` |

---

## 5. Category Navigation

The row of circular category tiles under the trust strip.

| Field | What to put | Example |
|---|---|---|
| **Category tiles → Name** | The name shown under the photo | `Office & daily` |
| **Category tiles → Collection slug** | The URL this tile links to | `office-daily` |
| **Category tiles → Image** | Upload a square-ish photo — it's shown in a circle, so keep the subject centered | *(uploaded file)* |
| **Category tiles → CSS object-position** *(optional)* | Only needed if the photo needs re-centering inside the circle; leave blank normally | `50% 30%` |

---

## 6. Weekly Highlights

The tabbed "New arrivals / Best sellers / Trending" product rail.

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `Curated this week` |
| **Title** | The section heading (supports `*italic*`/`**bold**`) | `This week's *highlights*` |
| **Subtitle** | One sentence under the heading | `Fresh from the harvest, the pieces everyone is reaching for.` |
| **Tabs → Id** | A short internal code, lowercase, no spaces (used to tell tabs apart) | `new` |
| **Tabs → Label** | The tab's visible name | `New arrivals` |
| **Tabs → Icon name** | Icon shown on the tab | `Sparkles` |
| **Tabs → Collection slug** | Where "View new arrivals" links to | `new-harvest` |
| **Tabs → CTA label** | The link text at the end of the row | `View new arrivals` |
| **Tabs → Products** | Tick the products to show in this tab, in the order you want them | *(select from list)* |

Add one "Tab" row per tab (e.g. New, Best sellers, Trending).

---

## 7. The Éclat Edit

The horizontally-scrolling "reel" of styled photo tiles.

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `The Éclat edit` |
| **Title** | Section heading | `**Wear.** *Love.* **Shop.**` |
| **Subtitle** | One sentence under the heading | `See how our pearls catch real light.` |
| **Tiles → Image** | Upload a styled lifestyle photo | *(uploaded file)* |
| **Tiles → Alt text** | Description of the photo | `Everyday luminous` |
| **Tiles → Caption** | The short caption on the tile | `Everyday luminous` |
| **Tiles → Link type** | Type exactly `product` (tile links to one product) or `custom` (tile links anywhere) | `product` |
| **Tiles → Product** *(only if link type is `product`)* | Which product the tile links to | *(select from list)* |
| **Tiles → Link to** *(only if link type is `custom`)* | Where the tile links, starting with `/` | `/shop` |
| **Tiles → Link label** *(only if link type is `custom`)* | The button text for a custom tile | `Shop all pearls` |

---

## 8. Banner Image

A full-width image with no text overlay, used to break up the page between sections. Each banner is its own section — add another "Banner image" section for a second banner elsewhere on the page.

| Field | What to put | Example |
|---|---|---|
| **Image** | Upload a wide banner photo (landscape) | *(uploaded file)* |
| **Alt text** | Description of the image | `Éclat — Jewelry for every story` |
| **Link** *(optional)* | If you want the banner clickable, the page it goes to; otherwise leave blank | `/shop` |

---

## 9. Shop by Occasion

The rotating "Casual / Work / Wedding guest…" tabbed section.

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `Choose by occasion` |
| **Title** | Section heading | `Styled for every *moment*` |
| **Subtitle** | One sentence under the heading | `From slow brunches to wedding receptions.` |
| **Occasions → Slug** | A short internal code for this occasion, lowercase, hyphenated | `wedding-guest` |
| **Occasions → Label** | The tab's visible name | `Wedding guest` |
| **Occasions → Image** | Upload a photo representing the occasion | *(uploaded file)* |
| **Occasions → CSS object-position** *(optional)* | Only if the photo needs re-cropping; leave blank normally | `50% 40%` |
| **Occasions → Note** | One line of styling advice for this occasion | `Grace for the big day.` |
| **Occasions → Products** | Tick the products to feature for this occasion | *(select from list)* |

Add one "Occasion" row per tab.

---

## 10. Featured Collection

A spotlighted product collection. There are **three different visual layouts** for this section type — a grid, a rotating "orbit" dial, and a horizontal scroll — chosen by your developer per section, but the fields you fill in are the same either way.

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `Featured collection` |
| **Title** | Section heading | `The *Moonlit* collection` |
| **Subtitle** | One or two sentences describing the collection | `Soft, silvery lustre inspired by quiet evenings.` |
| **Hero image** | Upload the main photo for this collection | *(uploaded file)* |
| **Hero alt text** | Description of the photo | `The Moonlit collection` |
| **Collection slug** | The URL the "Shop the collection" button goes to | `moonlit` |
| **CTA label** | The button/link text | `Shop the collection` |
| **Ring text** *(only used by the "orbit" layout)* | Decorative text that circles around the center photo | `MORNING DEW · LIGHT CAUGHT AT DAWN ·` |
| **Cover title** *(only used by the "wave" layout)* | A second heading shown on the cover panel | `Shaped by *water*` |
| **Cover body** *(only used by the "wave" layout)* | A paragraph shown on the cover panel | `Baroque pearls kept in their natural, sculptural forms.` |
| **Products** | Tick the products in this collection, in display order | *(select from list)* |

*Tip: if your section uses the grid or orbit layout, you can leave Ring text/Cover title/Cover body blank — they simply won't be used.*

---

## 11. Curated Gift Edits

The 2–3 tile grid of gift ideas (e.g. "Gifts under ₹3,999").

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `Curated edits` |
| **Title** | Section heading | `Timeless pearls, *thoughtful* gifts` |
| **Subtitle** | One sentence under the heading | `Hand-picked edits for the moments worth marking.` |
| **Tiles → Slug** | A short internal code for this tile | `under-3999` |
| **Tiles → Kicker** | The small line above the tile's title | `Thoughtful gifting` |
| **Tiles → Title** | The tile's main heading | `Gifts under ₹3,999` |
| **Tiles → Image** | Upload a photo for the tile | *(uploaded file)* |
| **Tiles → Alt text** | Description of the photo | `Gifts under ₹3,999` |
| **Tiles → Products** | Tick the products that belong in this edit | *(select from list)* |

---

## 12. Find Your Pearl Mood

The draggable before/after comparison slider (exactly two sides — left and right).

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `Style it your way` |
| **Title** | Section heading | `Find your *pearl* mood` |
| **Subtitle** | One or two sentences | `Drag the pearl to compare.` |
| **Left side → Label** | The caption on the left photo | `Everyday ease` |
| **Left side → Image** | Upload the left-hand photo | *(uploaded file)* |
| **Left side → Alt text** | Description of the photo | `Model wearing a layered pearl necklace` |
| **Left side → Product** | The product shown/linked on this side | *(select from list)* |
| **Right side → Label / Image / Alt text / Product** | Same fields as the left side, for the other end of the slider | `Evening glow` |

---

## 13. Shop the Look

One photo with clickable hotspots pointing to the products worn in it.

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `Shop the look` |
| **Title** | Section heading | `Quietly *luminous.*` |
| **Lede** | One sentence naming the pieces shown | `Neer Necklace with Tidal Drops — made to layer, beautiful alone.` |
| **Image** | Upload the styled photo the hotspots sit on | *(uploaded file)* |
| **Alt text** | Description of the photo | `Model wearing the Neer necklace and Tidal drops` |
| **Hotspots → Product** | Which product this hotspot points to | *(select from list)* |
| **Hotspots → Label** | The name shown when the hotspot is tapped | `Neer Freshwater Pearl Necklace` |
| **Hotspots → X position (%)** | How far from the **left** edge of the photo the dot sits, 0–100 | `81` |
| **Hotspots → Y position (%)** | How far from the **top** edge of the photo the dot sits, 0–100 | `60` |

*Tip: to find X/Y, imagine the photo on a 100×100 grid — 0,0 is the top-left corner and 100,100 is the bottom-right. Look at where the item sits on the model and estimate.*

---

## 14. Testimonials

The customer review carousel, with an optional trust-stats bar underneath.

| Field | What to put | Example |
|---|---|---|
| **Label** | Small label above the heading | `Testimonial` |
| **Title** | Section heading | `More than jewellery, it's a feeling.` |
| **Subtitle** | One sentence under the heading | `Real stories from people who made pearls part of their most cherished moments.` |
| **CTA label** | The link text (goes to your reviews page) | `Read more stories` |
| **Testimonials → Name** | Customer's name | `Aditi Sharma` |
| **Testimonials → City** | Customer's city | `Mumbai` |
| **Testimonials → Quote** | The review text, without quotation marks (they're added automatically) | `The quality is unlike anything I've bought before.` |
| **Testimonials → Rating** | A number from 1 to 5 | `5` |
| **Testimonials → Photo** | Upload the customer's photo | *(uploaded file)* |
| **Show trust stats bar** | Tick to show the stat bar below the reviews, untick to hide it | ✓ |
| **Trust stats → Value** | The big number | `10K+` |
| **Trust stats → Label** | What the number means | `Happy Customers` |
| **Pull quote** *(optional)* | A short quote shown inside the trust stats bar | `Pearls are a part of life's most beautiful stories.` |
| **Pull quote attribution** *(optional)* | Who said it | `— Team Éclat` |

---

## 15. Pearl Journal

The 3-card blog/journal teaser grid.

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `The pearl journal` |
| **Title** | Section heading | `Stories from the water` |
| **CTA label** | The link text (goes to your full journal/blog page) | `Read the journal` |
| **Posts → Image** | Upload the article's cover photo | *(uploaded file)* |
| **Posts → Title** | The article's headline | `How a freshwater pearl grows` |
| **Posts → Read time** | Estimated reading time | `6 min read` |
| **Posts → Slug** | The article's URL — must match a real blog post | `how-a-pearl-grows` |

---

## 16. Pearl & Jewellery Guide

The interactive "choose your design" spec-comparison widget.

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `Pearl & Jewellery Guide` |
| **Title** | Section heading | `Know your pearl, *choose your design*` |
| **Designs → Product** | The product this design option represents | *(select from list)* |
| **Designs → Label** | The button text for this option | `Necklace` |
| **Designs → Colour** | The pearl colour shown in the spec table (can differ from the product's own colour field if you want a simplified display name) | `White` |
| **Designs → Lede** | One sentence describing this design | `A single strand that goes anywhere.` |

---

## 17. Most Searched

The quick-discovery accordion of popular search groups.

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `Quick discovery` |
| **Title** | Section heading | `Most *searched*` |
| **Subtitle** | One sentence under the heading | `Jump straight to the pieces other pearl lovers look for most.` |
| **Popular searches** (list) | Quick-search chip labels shown above the accordion | `Pearl studs`, `Pearl necklace`, `Baroque drops` |
| **Groups → Title** | The accordion group's heading | `Necklaces & pendants` |
| **Groups → Chips → Label** | The chip's visible text | `All necklaces` |
| **Groups → Chips → Type** | Type exactly `category`, `collection`, or `query` | `category` |
| **Groups → Chips → Value** | The category slug, collection slug, or search term matching the Type above | `necklaces` |
| **Groups → Featured products** | Up to a few products shown as "picks" in this group | *(select from list)* |

---

## 18. Newsletter

The email sign-up block inside the footer.

| Field | What to put | Example |
|---|---|---|
| **Eyebrow** | Small label above the heading | `The Éclat letter` |
| **Title** | Section heading (supports `*italic*`) | `Letters on pearls, care and *new harvests*` |
| **Subtitle** | One sentence describing what subscribers get | `Occasional notes on pearl care, styling ideas and first look at new pieces.` |

---

## 19. Footer

The site-wide footer shown at the bottom of every page.

| Field | What to put | Example |
|---|---|---|
| **Tagline** | One line about the brand, shown next to the logo | `Real freshwater pearls, thoughtfully made in India.` |
| **WhatsApp number** | Country code first, no spaces or `+` | `919999999999` |
| **Instagram URL** *(optional)* | Full link to your Instagram profile | `https://instagram.com/eclat` |
| **Columns → Title** | A footer column heading | `Shop` |
| **Columns → Links → Label** | A link's visible text | `All jewellery` |
| **Columns → Links → URL** | Where the link goes, starting with `/` | `/shop` |
| **Payment methods text** | The line listing accepted payment methods | `UPI · Visa · Mastercard · RuPay · COD` |
| **Copyright text** | The bottom copyright line | `© 2026 Éclat` |

Add one "Column" per footer column (e.g. Shop, Help, Éclat), and one "Link" row per link inside it.

---

## Quick checklist before you publish

1. Every **Image** field has a photo uploaded (a section with a blank image field will fail to save).
2. Every **Product** picker has at least one product selected where required.
3. Titles read correctly with your `*italic*`/`**bold**` markers.
4. Click **Preview** and check the section looks right on the live design.
5. Click **Publish changes** — this is the only step that makes changes visible to customers.
