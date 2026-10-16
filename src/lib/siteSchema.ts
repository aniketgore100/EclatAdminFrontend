// What the website builder lets an admin edit, section by section. Each type lists its fields; the
// generic form (SiteForm.tsx) renders any of them, so adding a section type is a few lines here.
// These match the backend's validation (Eclat-Admin/src/site/schemas.ts) and, through it, exactly what the
// storefront's section components read.
import type { Json } from "./adminApi";

export type Option = { value: string; label: string };
export type Field =
  | { kind: "text" | "textarea"; key: string; label: string; placeholder?: string; help?: string; optional?: boolean; rows?: number }
  | { kind: "number"; key: string; label: string; min: number; max: number; scale?: number; optional?: boolean; help?: string }
  | { kind: "select"; key: string; label: string; options: Option[]; help?: string; optional?: boolean }
  | { kind: "multiselect"; key: string; label: string; optionsFrom: "categories" | "collections"; help?: string }
  | { kind: "image"; key: string; label: string; optional?: boolean; help?: string }
  | { kind: "link"; key: string; label: string; optional?: boolean; urlKey?: "to" | "url" }
  | { kind: "product"; key: string; label: string }
  | { kind: "strings"; key: string; label: string; placeholder?: string; min?: number; max: number; fixed?: number }
  | { kind: "list"; key: string; label: string; itemLabel: string; fields: Field[]; make: () => Json; min?: number; max: number; summary?: (item: Json) => string };

// Collections a "New drops"-style carousel or tile can show (a product joins one by its tag), and the
// looks that "Build your stack" can feature.
export const COLLECTIONS: Option[] = [
  { value: "new-drops", label: "New drops" },
  { value: "bestsellers", label: "Bestsellers" },
  { value: "everyday-minimal", label: "Everyday minimal" },
  { value: "night-out", label: "Night out" },
  { value: "stack-season", label: "Stack season" },
  { value: "promise", label: "Promise & engagement" },
  { value: "wedding-bands", label: "Wedding bands" },
];
export const LOOKS: Option[] = [
  { value: "everyday-stack", label: "The everyday stack" },
  { value: "late-night-silver", label: "Late-night silver" },
  { value: "main-character", label: "Main character" },
];

const img = (url = "/media/placeholder.jpg"): Json => ({ url, alt: "" });
const lnk = (label = "Shop now", to = "/shop"): Json => ({ label, to });

export type SectionMeta = {
  label: string;
  blurb: string;
  fields: Field[];
  make: () => Json; // defaults for a newly added section
  summary: (s: Json) => string;
};

export const SECTION_TYPES: Record<string, SectionMeta> = {
  hero: {
    label: "Hero banner",
    blurb: "The big photo carousel at the very top, with a headline and a button.",
    summary: (s) => `${s.title} · ${s.slides?.length ?? 0} slide${s.slides?.length === 1 ? "" : "s"}`,
    make: () => ({ type: "hero", fit: "contain", title: "New headline", text: "", cta: lnk("Shop new drops", "/collections/new-drops"), sticker: "", slides: [{ image: img() }] }),
    fields: [
      { kind: "text", key: "title", label: "Headline" },
      { kind: "textarea", key: "text", label: "Sub-text", rows: 2, optional: true },
      { kind: "link", key: "cta", label: "Button", optional: true },
      { kind: "text", key: "sticker", label: "Rotating sticker text", optional: true, placeholder: "new drop", help: "Leave empty for no sticker." },
      { kind: "select", key: "fit", label: "Photo fit", options: [{ value: "contain", label: "Show whole photo (wide shots)" }, { value: "cover", label: "Fill the space (crop)" }] },
      { kind: "number", key: "interval", label: "Seconds per slide", min: 2, max: 30, scale: 1000, optional: true, help: "Leave empty for the default (about 5.6 seconds)." },
      { kind: "list", key: "slides", label: "Slides", itemLabel: "Slide", min: 1, max: 12, make: () => ({ image: img() }), fields: [{ kind: "image", key: "image", label: "Photo (desktop)" }, { kind: "image", key: "mobileImage", label: "Photo for phones (optional)", optional: true }], summary: (i) => i.image?.url?.split("/").pop() ?? "" },
    ],
  },
  ticker: {
    label: "Scrolling strip",
    blurb: "A moving line of short trust messages (anti-tarnish, free shipping…).",
    summary: (s) => (s.items ?? []).join(" · "),
    make: () => ({ type: "ticker", items: ["Free shipping above ₹999"] }),
    fields: [{ kind: "strings", key: "items", label: "Messages", max: 12, min: 1, placeholder: "e.g. Anti-tarnish" }],
  },
  "product-carousel": {
    label: "Product row",
    blurb: "A scrolling row of products from one collection (New drops, Bestsellers…).",
    summary: (s) => `${s.title} · ${s.collection}`,
    make: () => ({ type: "product-carousel", title: "New drops", collection: "new-drops", limit: 8 }),
    fields: [
      { kind: "text", key: "title", label: "Heading" },
      { kind: "select", key: "collection", label: "Collection", options: COLLECTIONS, help: "Shows products tagged with this collection in the admin." },
      { kind: "number", key: "limit", label: "How many products", min: 1, max: 24 },
    ],
  },
  "category-tiles": {
    label: "Category tiles",
    blurb: "Large photo tiles that link to categories (Rings, Earrings…).",
    summary: (s) => (s.categories ?? []).join(", "),
    make: () => ({ type: "category-tiles", categories: [] }),
    fields: [{ kind: "multiselect", key: "categories", label: "Categories (in order shown)", optionsFrom: "categories", help: "Tile photo and text come from each category's own page in Categories." }],
  },
  "price-edit": {
    label: "Price links",
    blurb: "A heading with quick links such as “Under ₹999”.",
    summary: (s) => `${s.title} · ${(s.items ?? []).length} links`,
    make: () => ({ type: "price-edit", title: "Gifting, sorted.", items: [lnk("Under ₹999", "/shop?price_max=999")] }),
    fields: [
      { kind: "text", key: "title", label: "Heading" },
      { kind: "list", key: "items", label: "Links", itemLabel: "Link", min: 1, max: 8, make: () => lnk("Under ₹999", "/shop?price_max=999"), fields: [{ kind: "text", key: "label", label: "Text" }, { kind: "text", key: "to", label: "Goes to", placeholder: "/shop?price_max=999" }], summary: (i) => `${i.label} → ${i.to}` },
    ],
  },
  "collection-tiles": {
    label: "Collection tiles (“Shop by vibe”)",
    blurb: "Tall photo cards that link to collections.",
    summary: (s) => `${s.title} · ${(s.collections ?? []).join(", ")}`,
    make: () => ({ type: "collection-tiles", title: "Shop by vibe", collections: [] }),
    fields: [
      { kind: "text", key: "title", label: "Heading" },
      { kind: "multiselect", key: "collections", label: "Collections (in order shown)", optionsFrom: "collections" },
    ],
  },
  campaign: {
    label: "Two-photo campaign",
    blurb: "Two big photos side by side with a tagline and “Shop now” buttons.",
    summary: (s) => (s.labels ?? []).join(" ") || s.title || "Campaign",
    make: () => ({ type: "campaign", labels: ["Soft", "but", "make it sharp"], leftImage: img(), rightImage: img() }),
    fields: [
      { kind: "strings", key: "labels", label: "Three words across the left photo", max: 3, fixed: 3, placeholder: "e.g. Soft" },
      { kind: "text", key: "title", label: "Big text over the right photo", optional: true },
      { kind: "text", key: "titleItalic", label: "…second line, in italics", optional: true },
      { kind: "link", key: "cta", label: "Button over the right photo", optional: true },
      { kind: "image", key: "leftImage", label: "Left photo" },
      { kind: "product", key: "leftProduct", label: "Left photo links to product" },
      { kind: "image", key: "rightImage", label: "Right photo" },
      { kind: "product", key: "rightProduct", label: "Right photo links to product" },
    ],
  },
  "pearl-story": {
    label: "Story bands (“The story of pearls”)",
    blurb: "A run of photo + story bands. The first can be one full-width photo with text over it.",
    summary: (s) => `${(s.items ?? []).length} bands`,
    make: () => ({ type: "pearl-story", items: [] }),
    fields: [
      {
        kind: "list", key: "items", label: "Bands", itemLabel: "Band", min: 1, max: 12,
        make: () => ({ id: `story_${Math.random().toString(36).slice(2, 7)}`, eyebrow: "New story", title: "A new\nstory.", text: "Tell the story here.", image: img(), imageSide: "left" }),
        summary: (i) => i.eyebrow ?? "",
        fields: [
          { kind: "text", key: "eyebrow", label: "Small label above the heading" },
          { kind: "textarea", key: "title", label: "Heading", rows: 2, help: "A new line in the box becomes a line break on the site." },
          { kind: "textarea", key: "text", label: "Story text", rows: 4 },
          { kind: "image", key: "image", label: "Photo" },
          { kind: "select", key: "layout", label: "Layout", optional: true, options: [{ value: "", label: "Photo beside the text" }, { value: "banner", label: "One full-width photo, text over it" }] },
          { kind: "select", key: "imageSide", label: "Photo on the…", optional: true, options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }] },
          { kind: "link", key: "cta", label: "Link under the text", optional: true },
        ],
      },
    ],
  },
  "look-teaser": {
    label: "Shop the look",
    blurb: "A featured outfit with its products and a “Shop the look” button.",
    summary: (s) => `${s.title} · ${s.look}`,
    make: () => ({ type: "look-teaser", look: "everyday-stack", title: "Build your stack" }),
    fields: [
      { kind: "text", key: "title", label: "Small heading" },
      { kind: "select", key: "look", label: "Which look", options: LOOKS },
    ],
  },
  reviews: {
    label: "Customer reviews",
    blurb: "A row of featured reviews with your rating headline.",
    summary: (s) => s.title,
    make: () => ({ type: "reviews", title: "Loved by you" }),
    fields: [{ kind: "text", key: "title", label: "Headline", help: "The reviews themselves come from approved customer reviews." }],
  },
  ugc: {
    label: "Customer photos (“Worn by you”)",
    blurb: "A photo strip of customers wearing the jewellery, with a follow link.",
    summary: (s) => s.title,
    make: () => ({ type: "ugc", title: "Worn by you", text: "Tag @eclatempire to get featured.", cta: { label: "Follow on Instagram", url: "https://instagram.com/" } }),
    fields: [
      { kind: "text", key: "title", label: "Heading" },
      { kind: "text", key: "text", label: "Sub-text", optional: true },
      { kind: "link", key: "cta", label: "Follow button", optional: true, urlKey: "url" },
    ],
  },
};

// Everything outside the homepage sections: header, footer, announcement bar, etc.
export const CHROME_FIELDS: { title: string; blurb: string; fields: Field[] }[] = [
  { title: "Store", blurb: "Name and tagline used in the header, footer and browser tab.", fields: [{ kind: "text", key: "store.name", label: "Store name" }, { kind: "text", key: "store.tagline", label: "Tagline", optional: true }] },
  { title: "Announcement bar", blurb: "The thin black strip above the header. Messages scroll across it.", fields: [{ kind: "strings", key: "announcements", label: "Messages", max: 8, min: 1 }] },
  {
    title: "Header menu",
    blurb: "The links across the top of the site (desktop) and in the phone menu.",
    fields: [
      { kind: "list", key: "navigation.main", label: "Desktop menu", itemLabel: "Link", max: 8, make: () => lnk("New link", "/shop"), fields: [{ kind: "text", key: "label", label: "Text" }, { kind: "text", key: "to", label: "Goes to" }], summary: (i) => `${i.label} → ${i.to}` },
      { kind: "list", key: "navigation.mobile", label: "Phone menu", itemLabel: "Link", max: 12, make: () => lnk("New link", "/shop"), fields: [{ kind: "text", key: "label", label: "Text" }, { kind: "text", key: "to", label: "Goes to" }], summary: (i) => `${i.label} → ${i.to}` },
    ],
  },
  {
    title: "Footer",
    blurb: "The link columns at the bottom, the newsletter box and the social links.",
    fields: [
      {
        kind: "list", key: "navigation.footer", label: "Link columns", itemLabel: "Column", max: 6, make: () => ({ title: "New column", links: [lnk("New link", "/shop")] }), summary: (i) => `${i.title} (${(i.links ?? []).length})`,
        fields: [{ kind: "text", key: "title", label: "Column heading" }, { kind: "list", key: "links", label: "Links", itemLabel: "Link", min: 1, max: 10, make: () => lnk("New link", "/shop"), fields: [{ kind: "text", key: "label", label: "Text" }, { kind: "text", key: "to", label: "Goes to" }], summary: (i) => `${i.label} → ${i.to}` }],
      },
      { kind: "text", key: "newsletter.title", label: "Newsletter heading" },
      { kind: "text", key: "newsletter.text", label: "Newsletter text", optional: true },
      { kind: "list", key: "socials", label: "Social links", itemLabel: "Social link", max: 8, make: () => ({ label: "Instagram", url: "https://instagram.com/" }), fields: [{ kind: "text", key: "label", label: "Name" }, { kind: "text", key: "url", label: "Address (https://…)" }], summary: (i) => `${i.label}` },
    ],
  },
  { title: "Contact", blurb: "Shown in the footer and help pages.", fields: [{ kind: "text", key: "contact.email", label: "Email" }, { kind: "text", key: "contact.whatsapp", label: "WhatsApp number", optional: true }] },
  { title: "Product page perks", blurb: "The small reassurance chips under “Add to bag”.", fields: [{ kind: "strings", key: "productPerks", label: "Perks", max: 8, placeholder: "e.g. COD available" }] },
  { title: "Search engine defaults", blurb: "Title and description used when a page doesn't set its own.", fields: [{ kind: "text", key: "seo.title", label: "Title" }, { kind: "textarea", key: "seo.description", label: "Description", rows: 2, optional: true }] },
];
