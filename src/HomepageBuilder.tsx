import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, Gem, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useCreateHomepagePreviewTokenMutation,
  useCreateHomepageSectionMutation,
  useDeleteHomepageSectionMutation,
  useDuplicateHomepageSectionMutation,
  useGetHomepageSectionsQuery,
  useGetHomepageStatusQuery,
  useGetProductsQuery,
  usePresignHomepageImageMutation,
  usePublishHomepageMutation,
  useReorderHomepageSectionsMutation,
  useUnpublishHomepageMutation,
  useUpdateHomepageSectionMutation,
} from "./lib/adminApi";
import type { HomepageSection, HomepageSectionType, Product } from "./lib/adminApi";
import { compressImage, uploadToS3 } from "./lib/imageUpload";

// Site-wide chrome — renders on every page, not just the homepage — so it's
// content-editable but not reorderable/duplicable/deletable from here (see
// Eclat-Admin's PINNED_SECTION_TYPES, which the backend also enforces).
const PINNED_TYPES: HomepageSectionType[] = ["HEADER", "ANNOUNCEMENT_BAR", "FOOTER"];

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? "http://localhost:8080";

// ---------------------------------------------------------------------------
// Field specs — one entry per HomepageSectionType content shape. Mirrors
// Eclat-Admin/src/homepage/section-registry.ts exactly; this is the "what
// fields does this section have" registry the generic editor renders from.
// ---------------------------------------------------------------------------

type FieldSpec =
  | { kind: "text"; key: string; label: string }
  | { kind: "textarea"; key: string; label: string }
  | { kind: "number"; key: string; label: string }
  | { kind: "boolean"; key: string; label: string }
  | { kind: "image"; key: string; label: string }
  | { kind: "product"; key: string; label: string }
  | { kind: "products"; key: string; label: string }
  | { kind: "list"; key: string; label: string; itemLabel: string; fields: FieldSpec[] }
  | { kind: "object"; key: string; label: string; fields: FieldSpec[] };

const text = (key: string, label: string): FieldSpec => ({ kind: "text", key, label });
const textarea = (key: string, label: string): FieldSpec => ({ kind: "textarea", key, label });
const image = (key: string, label: string): FieldSpec => ({ kind: "image", key, label });
const products = (key: string, label: string): FieldSpec => ({ kind: "products", key, label });
const product = (key: string, label: string): FieldSpec => ({ kind: "product", key, label });

const SECTION_SPECS: Record<HomepageSectionType, FieldSpec[]> = {
  ANNOUNCEMENT_BAR: [{ kind: "list", key: "messages", label: "Messages", itemLabel: "Message", fields: [text("", "Message")] }],
  HEADER: [
    { kind: "list", key: "navLinks", label: "Nav links", itemLabel: "Link", fields: [text("label", "Label"), text("to", "URL")] },
    text("whatsappNumber", "WhatsApp number"),
  ],
  HERO: [
    {
      kind: "list",
      key: "slides",
      label: "Slides",
      itemLabel: "Slide",
      fields: [
        image("image", "Image"),
        text("alt", "Alt text"),
        text("collection", "Collection name"),
        text("kicker", "Kicker"),
        textarea("line", "Line"),
        text("slug", "Collection slug"),
      ],
    },
    { kind: "list", key: "promises", label: "Promise marquee", itemLabel: "Promise", fields: [text("", "Text")] },
  ],
  TRUST_STRIP: [{ kind: "list", key: "items", label: "Items", itemLabel: "Item", fields: [text("icon", "Icon name"), text("label", "Label")] }],
  CATEGORY_NAV: [
    {
      kind: "list",
      key: "items",
      label: "Category tiles",
      itemLabel: "Category",
      fields: [text("name", "Name"), text("slug", "Collection slug"), image("image", "Image"), text("position", "CSS object-position (optional)")],
    },
  ],
  HIGHLIGHTS: [
    text("eyebrow", "Eyebrow"),
    text("title", "Title"),
    textarea("sub", "Subtitle"),
    {
      kind: "list",
      key: "tabs",
      label: "Tabs",
      itemLabel: "Tab",
      fields: [text("id", "Id"), text("label", "Label"), text("icon", "Icon name"), text("slug", "Collection slug"), text("cta", "CTA label"), products("productIds", "Products")],
    },
  ],
  ECLAT_EDIT: [
    text("eyebrow", "Eyebrow"),
    text("title", "Title"),
    textarea("sub", "Subtitle"),
    {
      kind: "list",
      key: "tiles",
      label: "Tiles",
      itemLabel: "Tile",
      fields: [
        image("image", "Image"),
        text("alt", "Alt text"),
        text("caption", "Caption"),
        text("linkType", "Link type (product / custom)"),
        product("productId", "Product (if product tile)"),
        text("to", "Link to (if custom tile)"),
        text("label", "Link label (if custom tile)"),
      ],
    },
  ],
  BANNER: [image("image", "Image"), text("alt", "Alt text"), text("link", "Link (optional)")],
  OCCASIONS: [
    text("eyebrow", "Eyebrow"),
    text("title", "Title"),
    textarea("sub", "Subtitle"),
    {
      kind: "list",
      key: "items",
      label: "Occasions",
      itemLabel: "Occasion",
      fields: [text("slug", "Slug"), text("label", "Label"), image("image", "Image"), text("position", "CSS object-position (optional)"), textarea("note", "Note"), products("productIds", "Products")],
    },
  ],
  FEATURED_COLLECTION: [
    text("eyebrow", "Eyebrow"),
    text("title", "Title"),
    textarea("sub", "Subtitle"),
    image("heroImage", "Hero image"),
    text("heroAlt", "Hero alt text"),
    text("collectionSlug", "Collection slug"),
    text("ctaLabel", "CTA label"),
    text("ringText", "Ring text (orbit layout only)"),
    text("coverTitle", "Cover title (wave layout only)"),
    textarea("coverBody", "Cover body (wave layout only)"),
    products("productIds", "Products"),
  ],
  CURATED_EDITS: [
    text("eyebrow", "Eyebrow"),
    text("title", "Title"),
    textarea("sub", "Subtitle"),
    {
      kind: "list",
      key: "tiles",
      label: "Tiles",
      itemLabel: "Tile",
      fields: [text("slug", "Slug"), text("kicker", "Kicker"), text("title", "Title"), image("image", "Image"), text("alt", "Alt text"), products("productIds", "Products")],
    },
  ],
  PEARL_MOOD: [
    text("eyebrow", "Eyebrow"),
    text("title", "Title"),
    textarea("sub", "Subtitle"),
    { kind: "object", key: "left", label: "Left side", fields: [text("label", "Label"), image("image", "Image"), text("alt", "Alt text"), product("productId", "Product")] },
    { kind: "object", key: "right", label: "Right side", fields: [text("label", "Label"), image("image", "Image"), text("alt", "Alt text"), product("productId", "Product")] },
  ],
  SHOP_THE_LOOK: [
    text("eyebrow", "Eyebrow"),
    text("title", "Title"),
    textarea("lede", "Lede"),
    image("image", "Image"),
    text("alt", "Alt text"),
    {
      kind: "list",
      key: "hotspots",
      label: "Hotspots",
      itemLabel: "Hotspot",
      fields: [product("productId", "Product"), text("label", "Label"), { kind: "number", key: "x", label: "X position (%)" }, { kind: "number", key: "y", label: "Y position (%)" }],
    },
  ],
  TESTIMONIALS: [
    text("label", "Label"),
    text("title", "Title"),
    textarea("sub", "Subtitle"),
    text("ctaLabel", "CTA label"),
    {
      kind: "list",
      key: "entries",
      label: "Testimonials",
      itemLabel: "Testimonial",
      fields: [text("name", "Name"), text("city", "City"), textarea("quote", "Quote"), { kind: "number", key: "rating", label: "Rating (1-5)" }, image("image", "Photo")],
    },
    { kind: "boolean", key: "showTrustBar", label: "Show trust stats bar" },
    { kind: "list", key: "trustStats", label: "Trust stats", itemLabel: "Stat", fields: [text("value", "Value"), text("label", "Label")] },
    text("pullQuote", "Pull quote (optional)"),
    text("pullQuoteAttribution", "Pull quote attribution (optional)"),
  ],
  JOURNAL: [
    text("eyebrow", "Eyebrow"),
    text("title", "Title"),
    text("ctaLabel", "CTA label"),
    {
      kind: "list",
      key: "posts",
      label: "Posts",
      itemLabel: "Post",
      fields: [image("image", "Image"), text("title", "Title"), text("readTime", "Read time"), text("slug", "Slug")],
    },
  ],
  PEARL_GUIDE: [
    text("eyebrow", "Eyebrow"),
    text("title", "Title"),
    {
      kind: "list",
      key: "designs",
      label: "Designs",
      itemLabel: "Design",
      fields: [product("productId", "Product"), text("label", "Label"), text("colour", "Colour"), textarea("lede", "Lede")],
    },
  ],
  MOST_SEARCHED: [
    text("eyebrow", "Eyebrow"),
    text("title", "Title"),
    textarea("sub", "Subtitle"),
    { kind: "list", key: "popularChips", label: "Popular searches", itemLabel: "Chip", fields: [text("", "Text")] },
    {
      kind: "list",
      key: "groups",
      label: "Groups",
      itemLabel: "Group",
      fields: [
        text("title", "Title"),
        {
          kind: "list",
          key: "chips",
          label: "Chips",
          itemLabel: "Chip",
          fields: [text("label", "Label"), text("type", "Type (category / collection / query)"), text("value", "Value")],
        },
        products("productIds", "Featured products"),
      ],
    },
  ],
  NEWSLETTER: [text("eyebrow", "Eyebrow"), text("title", "Title"), textarea("sub", "Subtitle")],
  FOOTER: [
    text("tagline", "Tagline"),
    text("whatsappNumber", "WhatsApp number"),
    text("instagramUrl", "Instagram URL (optional)"),
    {
      kind: "list",
      key: "columns",
      label: "Columns",
      itemLabel: "Column",
      fields: [
        text("title", "Title"),
        { kind: "list", key: "links", label: "Links", itemLabel: "Link", fields: [text("label", "Label"), text("to", "URL")] },
      ],
    },
    text("paymentMethodsText", "Payment methods text"),
    text("copyrightText", "Copyright text"),
  ],
};

const SECTION_TYPE_LABELS: Record<HomepageSectionType, string> = {
  ANNOUNCEMENT_BAR: "Announcement bar",
  HEADER: "Header navigation",
  HERO: "Hero",
  TRUST_STRIP: "Trust strip",
  CATEGORY_NAV: "Category navigation",
  HIGHLIGHTS: "Weekly highlights",
  ECLAT_EDIT: "The Éclat edit",
  BANNER: "Banner image",
  OCCASIONS: "Shop by occasion",
  FEATURED_COLLECTION: "Featured collection",
  CURATED_EDITS: "Curated gift edits",
  PEARL_MOOD: "Find your pearl mood",
  SHOP_THE_LOOK: "Shop the look",
  TESTIMONIALS: "Testimonials",
  JOURNAL: "Pearl journal",
  PEARL_GUIDE: "Pearl & jewellery guide",
  MOST_SEARCHED: "Most searched",
  NEWSLETTER: "Newsletter",
  FOOTER: "Footer",
};

// A blank-ish starting point for "Add section" — enough that every list has
// one editable row instead of failing the backend's "at least 1 item"
// validation the instant it's created.
function emptyValueFor(spec: FieldSpec): unknown {
  switch (spec.kind) {
    case "text":
    case "textarea":
    case "image":
    case "product":
      return "";
    case "number":
      return 0;
    case "boolean":
      return true;
    case "products":
      return [];
    case "list":
      return [emptyItemFor(spec.fields)];
    case "object":
      return emptyItemFor(spec.fields);
  }
}
function emptyItemFor(fields: FieldSpec[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.key === "") continue; // primitive-list item (string), handled by caller
    obj[f.key] = emptyValueFor(f);
  }
  return obj;
}
function defaultContentFor(type: HomepageSectionType): Record<string, unknown> {
  const specs = SECTION_SPECS[type];
  const content: Record<string, unknown> = {};
  for (const spec of specs) content[spec.key] = emptyValueFor(spec);
  return content;
}

// ---------------------------------------------------------------------------
// Generic field editor — recursively renders whatever SECTION_SPECS says a
// section's content looks like, rather than 19 hand-built forms.
// ---------------------------------------------------------------------------

function get(obj: unknown, key: string): unknown {
  if (key === "") return obj;
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined;
}
function set(obj: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  if (key === "") return value as Record<string, unknown>;
  return { ...obj, [key]: value };
}

function useHomepageImageUpload(sectionId: string) {
  const [presign] = usePresignHomepageImageMutation();
  const [isUploading, setIsUploading] = useState(false);
  const upload = async (field: string, file: File): Promise<string> => {
    setIsUploading(true);
    try {
      const { blob, contentType } = await compressImage(file);
      const { data } = await presign({ sectionId, field, contentType }).unwrap();
      await uploadToS3(data.uploadUrl, blob, contentType, () => {});
      return data.publicUrl;
    } finally {
      setIsUploading(false);
    }
  };
  return { upload, isUploading };
}

function ImageField({
  label,
  value,
  onChange,
  sectionId,
  fieldPath,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  sectionId: string;
  fieldPath: string;
}) {
  const { upload, isUploading } = useHomepageImageUpload(sectionId);
  return (
    <label className="hb-field">
      <span>{label}</span>
      <div className="hb-image-field">
        {value && <img src={value} alt="" className="hb-image-preview" />}
        <input className="text-field" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Image URL" />
        <label className="icon-button" title="Upload">
          {isUploading ? "…" : "Upload"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const url = await upload(fieldPath, file);
              onChange(url);
            }}
          />
        </label>
      </div>
    </label>
  );
}

function ProductPickerSingle({ label, value, onChange, allProducts }: { label: string; value: string; onChange: (id: string) => void; allProducts: Product[] }) {
  return (
    <label className="hb-field">
      <span>{label}</span>
      <select className="select-field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {allProducts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProductPickerMulti({ label, value, onChange, allProducts }: { label: string; value: string[]; onChange: (ids: string[]) => void; allProducts: Product[] }) {
  const toggle = (id: string) => (value.includes(id) ? onChange(value.filter((v) => v !== id)) : onChange([...value, id]));
  return (
    <div className="hb-field">
      <span>{label}</span>
      <div className="hb-product-picker">
        {allProducts.map((p) => (
          <label key={p.id} className="hb-product-chip">
            <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} />
            {p.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function FieldEditor({
  spec,
  value,
  onChange,
  allProducts,
  sectionId,
  fieldPath,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  allProducts: Product[];
  sectionId: string;
  fieldPath: string;
}) {
  switch (spec.kind) {
    case "text":
      return (
        <label className="hb-field">
          <span>{spec.label}</span>
          <input className="text-field" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case "textarea":
      return (
        <label className="hb-field">
          <span>{spec.label}</span>
          <textarea className="text-field" rows={2} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    case "number":
      return (
        <label className="hb-field">
          <span>{spec.label}</span>
          <input className="text-field" type="number" value={(value as number) ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
        </label>
      );
    case "boolean":
      return (
        <label className="hb-field hb-field-inline">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          <span>{spec.label}</span>
        </label>
      );
    case "image":
      return (
        <ImageField
          label={spec.label}
          value={(value as string) ?? ""}
          onChange={onChange}
          sectionId={sectionId}
          fieldPath={fieldPath}
        />
      );
    case "product":
      return <ProductPickerSingle label={spec.label} value={(value as string) ?? ""} onChange={onChange} allProducts={allProducts} />;
    case "products":
      return <ProductPickerMulti label={spec.label} value={(value as string[]) ?? []} onChange={onChange} allProducts={allProducts} />;
    case "object": {
      const obj = (value as Record<string, unknown>) ?? {};
      return (
        <fieldset className="hb-fieldset">
          <legend>{spec.label}</legend>
          {spec.fields.map((f) => (
            <FieldEditor
              key={f.key}
              spec={f}
              value={get(obj, f.key)}
              onChange={(v) => onChange(set(obj, f.key, v))}
              allProducts={allProducts}
              sectionId={sectionId}
              fieldPath={`${fieldPath}.${f.key}`}
            />
          ))}
        </fieldset>
      );
    }
    case "list": {
      const items = (value as unknown[]) ?? [];
      const isPrimitive = spec.fields.length === 1 && spec.fields[0]?.key === "";
      return (
        <fieldset className="hb-fieldset">
          <legend>{spec.label}</legend>
          {items.map((item, i) => (
            <div key={i} className="hb-list-item">
              {isPrimitive ? (
                <FieldEditor
                  spec={spec.fields[0]!}
                  value={item}
                  onChange={(v) => onChange(items.map((it, idx) => (idx === i ? v : it)))}
                  allProducts={allProducts}
                  sectionId={sectionId}
                  fieldPath={`${fieldPath}.${i}`}
                />
              ) : (
                <div className="hb-list-item-fields">
                  {spec.fields.map((f) => (
                    <FieldEditor
                      key={f.key}
                      spec={f}
                      value={get(item, f.key)}
                      onChange={(v) => onChange(items.map((it, idx) => (idx === i ? set(it as Record<string, unknown>, f.key, v) : it)))}
                      allProducts={allProducts}
                      sectionId={sectionId}
                      fieldPath={`${fieldPath}.${i}.${f.key}`}
                    />
                  ))}
                </div>
              )}
              <button type="button" className="icon-button danger hb-list-remove" onClick={() => onChange(items.filter((_, idx) => idx !== i))} title={`Remove this ${spec.itemLabel.toLowerCase()}`}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary hb-list-add"
            onClick={() => onChange([...items, isPrimitive ? "" : emptyItemFor(spec.fields)])}
          >
            <Plus size={14} /> Add {spec.itemLabel.toLowerCase()}
          </button>
        </fieldset>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Section editor modal
// ---------------------------------------------------------------------------

function SectionEditorModal({ section, onClose }: { section: HomepageSection; onClose: () => void }) {
  const [updateSection, updateState] = useUpdateHomepageSectionMutation();
  const { data: productsData } = useGetProductsQuery();
  const allProducts = productsData?.data ?? [];
  const [name, setName] = useState(section.name);
  const [content, setContent] = useState<Record<string, unknown>>(section.content);
  const specs = SECTION_SPECS[section.type];

  const submit = async () => {
    try {
      await updateSection({ id: section.id, name, content }).unwrap();
      onClose();
    } catch {
      /* error shown below */
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal hb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <p className="eyebrow">{SECTION_TYPE_LABELS[section.type]}</p>
        <h2>Edit section</h2>
        <label className="hb-field">
          <span>Internal name</span>
          <input className="text-field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {specs.map((spec) => (
          <FieldEditor
            key={spec.key}
            spec={spec}
            value={get(content, spec.key)}
            onChange={(v) => setContent((c) => set(c, spec.key, v))}
            allProducts={allProducts}
            sectionId={section.id}
            fieldPath={spec.key}
          />
        ))}
        {updateState.error && (
          <p className="error">
            Couldn't save — check every field is filled in.{" "}
            {"data" in updateState.error && typeof updateState.error.data === "object"
              ? JSON.stringify((updateState.error.data as { details?: unknown }).details ?? "")
              : ""}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={updateState.isLoading} onClick={submit}>
            {updateState.isLoading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-section modal
// ---------------------------------------------------------------------------

function AddSectionModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<HomepageSectionType>("BANNER");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"type" | "content">("type");
  const addableTypes = (Object.keys(SECTION_SPECS) as HomepageSectionType[]).filter((t) => !PINNED_TYPES.includes(t));

  if (step === "content") {
    return <AddSectionContentModal type={type} name={name.trim() || SECTION_TYPE_LABELS[type]} onBack={() => setStep("type")} onClose={onClose} />;
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <p className="eyebrow">NEW SECTION</p>
        <h2>Add a homepage section.</h2>
        <label className="hb-field">
          <span>Type</span>
          <select className="select-field" value={type} onChange={(e) => setType(e.target.value as HomepageSectionType)}>
            {addableTypes.map((t) => (
              <option key={t} value={t}>
                {SECTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="hb-field">
          <span>Internal name</span>
          <input className="text-field" value={name} onChange={(e) => setName(e.target.value)} placeholder={SECTION_TYPE_LABELS[type]} />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={() => setStep("content")}>
            Next: fill in content
          </button>
        </div>
      </div>
    </div>
  );
}

// Content is filled in BEFORE the section is created — every field the
// backend requires (see section-registry.ts's `.min(1)` etc.) starts blank,
// so creating with unfilled defaults would just fail validation immediately.
function AddSectionContentModal({
  type,
  name,
  onBack,
  onClose,
}: {
  type: HomepageSectionType;
  name: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const [createSection, createState] = useCreateHomepageSectionMutation();
  const { data: productsData } = useGetProductsQuery();
  const allProducts = productsData?.data ?? [];
  const [content, setContent] = useState<Record<string, unknown>>(() => defaultContentFor(type));
  const [draftId] = useState(() => crypto.randomUUID());
  const specs = SECTION_SPECS[type];

  const submit = async () => {
    try {
      await createSection({ type, name, content, enabled: true }).unwrap();
      onClose();
    } catch {
      /* error shown below */
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal hb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <p className="eyebrow">{SECTION_TYPE_LABELS[type]}</p>
        <h2>{name}</h2>
        {specs.map((spec) => (
          <FieldEditor
            key={spec.key}
            spec={spec}
            value={get(content, spec.key)}
            onChange={(v) => setContent((c) => set(c, spec.key, v))}
            allProducts={allProducts}
            sectionId={draftId}
            fieldPath={spec.key}
          />
        ))}
        {createState.error && (
          <p className="error">
            Couldn't create this section — check every field is filled in.{" "}
            {"data" in createState.error && typeof createState.error.data === "object"
              ? JSON.stringify((createState.error.data as { details?: unknown }).details ?? "")
              : ""}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onBack}>
            Back
          </button>
          <button type="button" className="primary" disabled={createState.isLoading} onClick={submit}>
            {createState.isLoading ? "Creating…" : "Create section"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section list row
// ---------------------------------------------------------------------------

function SectionRow({
  section,
  isPinned,
  isFirst,
  isLast,
  onMove,
  onEdit,
}: {
  section: HomepageSection;
  isPinned: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
}) {
  const [deleteSection] = useDeleteHomepageSectionMutation();
  const [duplicateSection] = useDuplicateHomepageSectionMutation();
  const [updateSection] = useUpdateHomepageSectionMutation();

  const onDelete = async () => {
    if (!window.confirm(`Delete "${section.name}"? This can't be undone.`)) return;
    try {
      await deleteSection({ id: section.id }).unwrap();
    } catch {
      window.alert("Couldn't delete this section.");
    }
  };

  const isDraftAhead =
    section.publishedAt === null ||
    JSON.stringify(section.content) !== JSON.stringify(section.publishedContent) ||
    section.enabled !== section.publishedEnabled;

  return (
    <div className={`hb-row${section.enabled ? "" : " hb-row-disabled"}`}>
      <div className="hb-row-order">
        <button type="button" className="icon-button" disabled={isPinned || isFirst} onClick={() => onMove(-1)} title="Move up">
          <ArrowUp size={14} />
        </button>
        <button type="button" className="icon-button" disabled={isPinned || isLast} onClick={() => onMove(1)} title="Move down">
          <ArrowDown size={14} />
        </button>
      </div>
      <div className="hb-row-main">
        <div className="hb-row-title">
          {isPinned && (
            <span title="Site-wide chrome — always on, can't be reordered">
              <Lock size={13} />
            </span>
          )}
          <strong>{section.name}</strong>
          {isDraftAhead && <span className="status-pill DRAFT">Unpublished changes</span>}
        </div>
        <span className="hb-row-type">{SECTION_TYPE_LABELS[section.type]}</span>
      </div>
      <div className="hb-row-actions">
        <label className="hb-toggle">
          <input
            type="checkbox"
            checked={section.enabled}
            onChange={(e) => updateSection({ id: section.id, enabled: e.target.checked })}
          />
          <span>{section.enabled ? "Enabled" : "Disabled"}</span>
        </label>
        <button type="button" className="icon-button" onClick={onEdit} title="Edit">
          <Pencil size={15} />
        </button>
        {!isPinned && (
          <>
            <button type="button" className="icon-button" onClick={() => duplicateSection({ id: section.id })} title="Duplicate">
              <Copy size={15} />
            </button>
            <button type="button" className="icon-button danger" onClick={onDelete} title="Delete">
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-level view
// ---------------------------------------------------------------------------

export function HomepageBuilderView() {
  const { data: sectionsData, isLoading } = useGetHomepageSectionsQuery();
  const { data: statusData } = useGetHomepageStatusQuery();
  const [reorder] = useReorderHomepageSectionsMutation();
  const [publish, publishState] = usePublishHomepageMutation();
  const [unpublish, unpublishState] = useUnpublishHomepageMutation();
  const [createPreviewToken, previewState] = useCreateHomepagePreviewTokenMutation();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<HomepageSection | null>(null);

  const sections = [...(sectionsData?.data ?? [])].sort((a, b) => a.order - b.order);
  const draggable = sections.filter((s) => !PINNED_TYPES.includes(s.type));
  const isLive = statusData?.data.isLive ?? false;
  const hasUnpublished = sections.some(
    (s) => s.publishedAt === null || JSON.stringify(s.content) !== JSON.stringify(s.publishedContent) || s.enabled !== s.publishedEnabled
  );

  const move = async (section: HomepageSection, dir: -1 | 1) => {
    const ids = draggable.map((s) => s.id);
    const idx = ids.indexOf(section.id);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[idx], ids[swapWith]] = [ids[swapWith]!, ids[idx]!];
    await reorder({ ids });
  };

  const openPreview = async () => {
    try {
      const res = await createPreviewToken().unwrap();
      window.open(`${STOREFRONT_URL}/?preview=${res.data.token}`, "_blank", "noopener");
    } catch {
      window.alert("Couldn't create a preview link.");
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">HOMEPAGE</p>
          <h1>Homepage builder</h1>
        </div>
        <div className="top-actions" style={{ alignItems: "center", gap: 10 }}>
          <span className={`status-pill ${isLive ? "ACTIVE" : "DRAFT"}`}>{isLive ? "Live" : "Not published"}</span>
          <button type="button" className="icon-button" onClick={openPreview} disabled={previewState.isLoading} title="Preview draft">
            <Eye size={17} />
          </button>
          {isLive && (
            <button type="button" className="secondary" onClick={() => unpublish()} disabled={unpublishState.isLoading}>
              {unpublishState.isLoading ? "Unpublishing…" : "Unpublish"}
            </button>
          )}
          <button type="button" className="primary" onClick={() => publish()} disabled={publishState.isLoading || !hasUnpublished}>
            {publishState.isLoading ? "Publishing…" : hasUnpublished ? "Publish changes" : "Published"}
          </button>
        </div>
      </header>

      <section className="collection-heading">
        <div>
          <p className="eyebrow">SECTIONS</p>
          <h2>{sections.length} sections</h2>
        </div>
        <button type="button" className="primary" onClick={() => setAddOpen(true)}>
          <Plus size={17} /> New section
        </button>
      </section>

      {isLoading ? (
        <div className="loading">Loading homepage…</div>
      ) : (
        <div className="hb-list">
          {sections.map((section) => {
            const isPinned = PINNED_TYPES.includes(section.type);
            const dIdx = draggable.findIndex((s) => s.id === section.id);
            return (
              <SectionRow
                key={section.id}
                section={section}
                isPinned={isPinned}
                isFirst={isPinned || dIdx === 0}
                isLast={isPinned || dIdx === draggable.length - 1}
                onMove={(dir) => move(section, dir)}
                onEdit={() => setEditing(section)}
              />
            );
          })}
          {!sections.length && (
            <div className="empty">
              <Gem size={28} />
              <h3>No homepage sections yet.</h3>
              <p>Add your first section to start building the homepage.</p>
            </div>
          )}
        </div>
      )}

      {addOpen && <AddSectionModal onClose={() => setAddOpen(false)} />}
      {editing && <SectionEditorModal section={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
