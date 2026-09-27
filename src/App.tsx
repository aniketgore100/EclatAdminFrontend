import { FormEvent, useState } from "react";
import { useEffect } from "react";
import { Archive, ArrowUpRight, Camera, Gem, Grid2X2, Layout, LayoutDashboard, LogOut, Package, Pencil, Plus, Search, Settings, Sparkles, Trash2, Users } from "lucide-react";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { clearSession, setSession } from "./features/auth/authSlice";
import {
  useConfirmCategoryImageMutation,
  useConfirmProductImageMutation,
  useCreateCategoryMutation,
  useCreateCategoryTabMutation,
  useCreateProductMutation,
  useCreateVariantMutation,
  useDeleteCategoryMutation,
  useGetCategoriesQuery,
  useGetCategoryTabsQuery,
  useGetPearlColoursQuery,
  useGetPolishesQuery,
  useGetProductsQuery,
  useGetProductTypesQuery,
  useGetStonesQuery,
  useLoginMutation,
  useLogoutMutation,
  usePresignCategoryImageMutation,
  usePresignProductImageMutation,
  useRefreshMutation,
  useUpdateCategoryMutation,
  useUpdateProductMutation,
  useUpdateVariantMutation,
} from "./lib/adminApi";
import type { Category, CategoryTab, Facet, Product, ProductAttribute } from "./lib/adminApi";
import { compressImage, uploadToS3 } from "./lib/imageUpload";
import { HomepageBuilderView } from "./HomepageBuilder";

// Direct-to-S3 upload flow used by both category and product images:
// compress client-side -> presign -> PUT straight to S3 (one hop, with
// progress) -> confirm so the backend saves the resulting URL. `presign`/
// `confirm` are small, fast JSON requests; only the actual file transfer
// (compress + PUT) is where the real bytes move, and that skips our server.
function useCategoryImageUpload() {
  const [presign] = usePresignCategoryImageMutation();
  const [confirm] = useConfirmCategoryImageMutation();
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const upload = async (id: string, file: File, field: "image" | "banner") => {
    setIsUploading(true); setProgress(0);
    try {
      const { blob, contentType } = await compressImage(file);
      const { data } = await presign({ id, contentType, field }).unwrap();
      await uploadToS3(data.uploadUrl, blob, contentType, setProgress);
      await confirm({ id, key: data.key, field }).unwrap();
    } finally {
      setIsUploading(false); setProgress(0);
    }
  };
  return { upload, progress, isUploading };
}

function useProductImageUpload() {
  const [presign] = usePresignProductImageMutation();
  const [confirm] = useConfirmProductImageMutation();
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const upload = async (id: string, file: File) => {
    setIsUploading(true); setProgress(0);
    try {
      const { blob, contentType } = await compressImage(file);
      const { data } = await presign({ id, contentType }).unwrap();
      await uploadToS3(data.uploadUrl, blob, contentType, setProgress);
      await confirm({ id, key: data.key }).unwrap();
    } finally {
      setIsUploading(false); setProgress(0);
    }
  };
  return { upload, progress, isUploading };
}

type View = "catalogue" | "products" | "homepage";
const nav: { label: string; icon: typeof LayoutDashboard; view?: View }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Homepage", icon: Layout, view: "homepage" },
  { label: "Catalogue", icon: Grid2X2, view: "catalogue" },
  { label: "Products", icon: Package, view: "products" },
  { label: "Orders", icon: Archive },
  { label: "Clients", icon: Users },
];

function Login() {
  const dispatch = useAppDispatch(); const [login, { isLoading, error }] = useLoginMutation();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); try { const result = await login({ email, password }).unwrap(); dispatch(setSession(result.data)); } catch { /* error is displayed below */ } }
  return <main className="login-page"><section className="login-brand"><p className="eyebrow">EST. 2026 · ADMINISTRATION</p><Gem size={42} strokeWidth={1.25}/><h1>Éclat<br/>Atelier</h1><p>Curate the pieces, stories, and moments that make every collection shine.</p><div className="orb orb-one"/><div className="orb orb-two"/></section><section className="login-panel"><form onSubmit={submit} className="login-form"><p className="eyebrow">WELCOME BACK</p><h2>Enter the atelier.</h2><p className="form-note">Sign in to manage your storefront.</p><label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@eclat.com" required autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password"/></label>{error && <p className="error">Unable to sign in. Check your credentials and try again.</p>}<button className="primary wide" disabled={isLoading}>{isLoading ? "Signing in…" : "Sign in"}<ArrowUpRight size={17}/></button></form></section></main>;
}

// A category needs two different photos: a tight, tile-cropped shot for the
// home page grid, and a wide hero shot for its own page banner. Same upload
// mechanics, different `field` and different spot in the UI so it's obvious
// which is which.
function CategoryImageSlot({
  label,
  src,
  isUploading,
  progress,
  onFile,
}: {
  label: string;
  src?: string | null;
  isUploading: boolean;
  progress: number;
  onFile: (file?: File) => void;
}) {
  return (
    <div className="category-media-slot">
      <div className="category-media">
        {src ? <img src={src} alt={label} /> : <div className="media-placeholder"><Gem size={27} /></div>}
        <label className="image-action">
          <Camera size={15} />
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {isUploading && <span className="uploading">Uploading… {progress}%</span>}
      </div>
      <small className="category-media-label">{label}</small>
    </div>
  );
}

function CategoryCard({ category, onEdit, onDelete }: { category: Category; onEdit: (category: Category) => void; onDelete: (category: Category) => void }) {
  const tile = useCategoryImageUpload();
  const banner = useCategoryImageUpload();
  const onTileFile = async (file?: File) => { if (file) await tile.upload(category.id, file, "image"); };
  const onBannerFile = async (file?: File) => { if (file) await banner.upload(category.id, file, "banner"); };
  return <article className="category-card">
    <div style={{ display: "flex", gap: 8 }}>
      <CategoryImageSlot label="Home tile" src={category.image} isUploading={tile.isUploading} progress={tile.progress} onFile={onTileFile} />
      <CategoryImageSlot label="Page banner" src={category.banner} isUploading={banner.isUploading} progress={banner.progress} onFile={onBannerFile} />
    </div>
    <div className="category-copy"><div><p className="category-index">COLLECTION · {String(category.position + 1).padStart(2, "0")}</p><h3>{category.name}</h3></div><p>{category.description || "A considered collection, ready for your next edit."}</p><div className="category-foot"><span>/{category.slug}</span><span style={{ display: "flex", gap: 6 }}><button type="button" className="icon-button" title="Edit collection" onClick={() => onEdit(category)}><Pencil size={15}/></button><button type="button" className="icon-button danger" title="Delete collection" onClick={() => onDelete(category)}><Trash2 size={15}/></button></span></div></div>
  </article>;
}

// Select box for the create/edit category forms — the tab bar in
// CatalogueView is where tabs actually get created; this just assigns an
// existing one.
function CategoryTabSelect({
  tabs,
  value,
  onChange,
}: {
  tabs: CategoryTab[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label>
      Tab
      <select className="select-field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {tabs.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditCategoryModal({
  category,
  tabs,
  onClose,
}: {
  category: Category;
  tabs: CategoryTab[];
  onClose: () => void;
}) {
  const [updateCategory, updateState] = useUpdateCategoryMutation();
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [eyebrow, setEyebrow] = useState(category.eyebrow ?? "");
  const [title, setTitle] = useState(category.title ?? "");
  const [text, setText] = useState(category.text ?? "");
  const [caption, setCaption] = useState(category.caption ?? "");
  const [categoryTabId, setCategoryTabId] = useState(category.categoryTabId ?? "");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await updateCategory({
        id: category.id,
        name,
        description: description || undefined,
        eyebrow: eyebrow || undefined,
        title: title || undefined,
        text: text || undefined,
        caption: caption || undefined,
        categoryTabId: categoryTabId || undefined,
      }).unwrap();
      onClose();
    } catch {
      /* standard API error below */
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <p className="eyebrow">EDIT COLLECTION</p>
        <h2>Update the story.</h2>
        <label>
          Collection name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <CategoryTabSelect tabs={tabs} value={categoryTabId} onChange={setCategoryTabId} />
        <label>
          Short description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </label>
        <label>
          Hero eyebrow
          <input
            value={eyebrow}
            onChange={(e) => setEyebrow(e.target.value)}
            placeholder="Shop by category"
          />
        </label>
        <label>
          Hero heading
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pearl Necklaces" />
        </label>
        <label>
          Hero copy
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Shown on the storefront's category page, under the heading."
          />
        </label>
        <label>
          Image caption
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Worn every day" />
        </label>
        {updateState.error && <p className="error">This collection could not be saved.</p>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={updateState.isLoading}>
            {updateState.isLoading ? "Saving…" : "Save changes"}
            <ArrowUpRight size={17} />
          </button>
        </div>
      </form>
    </div>
  );
}

// The Catalogue view's tab bar — tabs group collections (e.g. "Live
// Collection", "Featured Collection") and are entirely admin-created, so the
// list grows as new tabs get added here instead of being fixed in code.
function CollectionTabBar({
  tabs,
  activeId,
  onSelect,
  onCreate,
  creating,
}: {
  tabs: CategoryTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  creating: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate(name.trim());
    setName("");
    setAdding(false);
  };
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-pill${tab.id === activeId ? " active" : ""}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.name}
        </button>
      ))}
      {adding ? (
        <form className="tab-pill-form" onSubmit={submit}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Featured Collection"
          />
          <button type="submit" className="primary" disabled={creating}>
            Add
          </button>
          <button type="button" className="icon-button" onClick={() => { setAdding(false); setName(""); }}>
            ×
          </button>
        </form>
      ) : (
        <button type="button" className="tab-pill tab-pill-add" onClick={() => setAdding(true)}>
          <Plus size={13} />
          New tab
        </button>
      )}
    </div>
  );
}

function CatalogueView() {
  const { data, isLoading } = useGetCategoriesQuery();
  const { data: tabsData } = useGetCategoryTabsQuery();
  const [createCategory, createState] = useCreateCategoryMutation();
  const [createCategoryTab, createTabState] = useCreateCategoryTabMutation();
  const [deleteCategory] = useDeleteCategoryMutation();
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const tabs = tabsData?.data ?? [];
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const effectiveTabId = activeTabId ?? tabs[0]?.id ?? null;
  const [categoryTabId, setCategoryTabId] = useState(effectiveTabId ?? "");
  // Until any tab exists, fall back to the old flat listing so an empty
  // Catalogue isn't blocked on creating a tab first.
  const categories = tabs.length
    ? (data?.data ?? []).filter((c) => c.categoryTabId === effectiveTabId)
    : data?.data ?? [];
  const activeTabName = tabs.find((t) => t.id === effectiveTabId)?.name;
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await createCategory({ name, description: description || undefined, categoryTabId: categoryTabId || undefined }).unwrap(); setName(""); setDescription(""); setOpen(false); } catch { /* standard API error below */ } };
  const onDelete = async (category: Category) => {
    if (!window.confirm(`Delete "${category.name}"? This can't be undone.`)) return;
    try { await deleteCategory({ id: category.id }).unwrap(); }
    catch { window.alert("Couldn't delete this collection — it may still have products in it. Move or delete those first."); }
  };
  const onCreateTab = async (tabName: string) => {
    try {
      const res = await createCategoryTab({ name: tabName }).unwrap();
      setActiveTabId(res.data.id);
    } catch {
      window.alert("Couldn't create this tab. The name may already be in use.");
    }
  };
  const openCreate = () => { setCategoryTabId(effectiveTabId ?? ""); setOpen(true); };
  return <>
    <header className="topbar"><div><p className="eyebrow">CATALOGUE / COLLECTIONS</p><h1>The collection edit</h1></div><div className="top-actions"><button className="icon-button"><Search size={19}/></button><button className="primary" onClick={openCreate}><Plus size={17}/>New collection</button></div></header>
    <section className="hero"><div><p className="eyebrow">THE CURATOR'S DESK</p><h2>Give every piece<br/><em>a place to belong.</em></h2><p>Build collections that turn a catalogue into a point of view.</p></div><Sparkles className="hero-sparkle" size={46} strokeWidth={1}/></section>
    <CollectionTabBar tabs={tabs} activeId={effectiveTabId} onSelect={setActiveTabId} onCreate={onCreateTab} creating={createTabState.isLoading} />
    <section className="collection-heading"><div><p className="eyebrow">{(activeTabName ?? "LIVE COLLECTIONS").toUpperCase()}</p><h2>{categories.length} collections</h2></div><span>Drag to arrange the storefront order</span></section>
    {isLoading ? <div className="loading">Loading your collection…</div> : <section className="category-grid">{categories.map((category) => <CategoryCard key={category.id} category={category} onEdit={setEditing} onDelete={onDelete}/>)}{!categories.length && <div className="empty"><Gem size={28}/><h3>{tabs.length ? "No collections in this tab yet." : "Your first collection starts here."}</h3><p>Create a category, then add its imagery and products.</p><button className="primary" onClick={openCreate}><Plus size={17}/>Create collection</button></div>}</section>}
    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}><p className="eyebrow">NEW COLLECTION</p><h2>Name the story.</h2><label>Collection name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pearl essentials" required autoFocus/></label><CategoryTabSelect tabs={tabs} value={categoryTabId} onChange={setCategoryTabId} /><label>Short description <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="An elegant line about this collection." rows={3}/></label>{createState.error && <p className="error">This collection could not be saved. The name may already be in use.</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary" disabled={createState.isLoading}>{createState.isLoading ? "Creating…" : "Create collection"}<ArrowUpRight size={17}/></button></div></form></div>}
    {editing && <EditCategoryModal category={editing} tabs={tabs} onClose={() => setEditing(null)} />}
  </>;
}

// paise <-> rupees: variant price/mrp are stored in paise (see Eclat prisma
// seed data), the form works in rupees like every other price shown here.
const toPaise = (rupees: string) => Math.round(Number(rupees) * 100);
const toRupees = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, "");

function skuFor(name: string) {
  return `${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-STD`;
}

function ProductRow({ product, onEdit }: { product: Product; onEdit: (product: Product) => void }) {
  const { upload, progress, isUploading } = useProductImageUpload();
  const onImage = async (file?: File) => { if (file) await upload(product.id, file); };
  const thumb = product.images?.[0]?.url;
  const variant = product.variants[0];
  return <tr>
    <td>
      <label style={{ cursor: "pointer", display: "inline-block" }} title={thumb ? "Replace image" : "Upload image"}>
        {thumb ? <img src={thumb} alt={product.name} className="product-thumb"/> : <span className="product-thumb-placeholder"><Camera size={16}/></span>}
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onImage(e.target.files?.[0])}/>
      </label>
      {isUploading && ` Uploading… ${progress}%`}
    </td>
    <td><b>{product.name}</b>{product.subtitle && <div style={{ color: "#8a8178", fontSize: ".8rem" }}>{product.subtitle}</div>}</td>
    <td>{product.category?.name ?? "—"}</td>
    <td>{product.type?.name ?? "—"}</td>
    <td>{product.pearlGrade ?? "—"}</td>
    <td>{product.pearlSizeMm != null ? `${product.pearlSizeMm} mm` : "—"}</td>
    <td>{variant ? `₹${toRupees(variant.price)}` : <span style={{ color: "#b33b32" }}>No price</span>}</td>
    <td>{variant?.inventory ? variant.inventory.onHand - variant.inventory.reserved : "—"}</td>
    <td>{product.badges[0] ?? "—"}</td>
    <td><span className={`status-pill ${product.status}`}>{product.status}</span></td>
    <td><button type="button" className="icon-button" title="Edit product" onClick={() => onEdit(product)}><Pencil size={15}/></button></td>
  </tr>;
}

// Free-form label/value rows for whatever properties apply to *this*
// product — a necklace might get "Chain Length"/"Clasp", an earring "Post
// Type", a ring nothing at all. Deliberately not a fixed set of inputs.
function AttributesEditor({
  attributes,
  onChange,
}: {
  attributes: ProductAttribute[];
  onChange: (next: ProductAttribute[]) => void;
}) {
  const update = (i: number, field: "label" | "value", value: string) =>
    onChange(attributes.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  const remove = (i: number) => onChange(attributes.filter((_, idx) => idx !== i));
  const add = () => onChange([...attributes, { label: "", value: "" }]);

  return (
    <div style={{ margin: "1rem 0" }}>
      <p className="eyebrow" style={{ marginBottom: ".5rem" }}>Custom properties</p>
      {attributes.map((a, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={a.label}
            onChange={(e) => update(i, "label", e.target.value)}
            placeholder="Label (e.g. Chain Length)"
            style={{ flex: 1 }}
          />
          <input
            value={a.value}
            onChange={(e) => update(i, "value", e.target.value)}
            placeholder="Value (e.g. Adjustable 16–20 in)"
            style={{ flex: 1 }}
          />
          <button type="button" className="icon-button danger" title="Remove property" onClick={() => remove(i)}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={add}>
        + Add property
      </button>
    </div>
  );
}

function EditProductModal({
  product,
  categories,
  types,
  colours,
  polishes,
  stones,
  onClose,
}: {
  product: Product;
  categories: Category[];
  types: Facet[];
  colours: Facet[];
  polishes: Facet[];
  stones: Facet[];
  onClose: () => void;
}) {
  const [updateProduct, updateState] = useUpdateProductMutation();
  const [createVariant, createVariantState] = useCreateVariantMutation();
  const [updateVariant, updateVariantState] = useUpdateVariantMutation();
  const variant = product.variants[0];

  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [name, setName] = useState(product.name);
  const [subtitle, setSubtitle] = useState(product.subtitle ?? "");
  const [typeId, setTypeId] = useState(product.type?.id ?? "");
  const [pearlColourId, setPearlColourId] = useState(product.pearlColour?.id ?? "");
  const [polishId, setPolishId] = useState(product.polish?.id ?? "");
  const [stoneId, setStoneId] = useState(product.stone?.id ?? "");
  const [pearlType, setPearlType] = useState(product.pearlType ?? "");
  const [pearlGrade, setPearlGrade] = useState(product.pearlGrade ?? "");
  const [pearlSizeMm, setPearlSizeMm] = useState(product.pearlSizeMm != null ? String(product.pearlSizeMm) : "");
  const [pearlLustre, setPearlLustre] = useState(product.pearlLustre ?? "");
  const [setting, setSetting] = useState(product.setting ?? "");
  const [attributes, setAttributes] = useState<ProductAttribute[]>(product.attributes);
  const [badge, setBadge] = useState(product.badges[0] ?? "");
  const [price, setPrice] = useState(variant ? toRupees(variant.price) : "");
  const [mrp, setMrp] = useState(variant ? toRupees(variant.mrp) : "");
  const [stock, setStock] = useState(variant?.inventory ? String(variant.inventory.onHand) : "0");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE" | "ARCHIVED">(product.status as "DRAFT" | "ACTIVE" | "ARCHIVED");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      // Always send `attributes` (even empty) — the edit form is the
      // source of truth for this product's list, so removing every row
      // and saving should clear them, not leave the old ones untouched.
      const cleanAttributes = attributes.filter((a) => a.label.trim() && a.value.trim());
      await updateProduct({
        id: product.id,
        categoryId,
        name,
        subtitle: subtitle || undefined,
        pearlType: pearlType || undefined,
        pearlGrade: pearlGrade || undefined,
        pearlSizeMm: pearlSizeMm ? Number(pearlSizeMm) : undefined,
        pearlLustre: pearlLustre || undefined,
        setting: setting || undefined,
        attributes: cleanAttributes,
        typeId: typeId || undefined,
        pearlColourId: pearlColourId || undefined,
        polishId: polishId || undefined,
        stoneId: stoneId || undefined,
        badges: badge ? [badge] : undefined,
        status,
      }).unwrap();
      if (price) {
        if (variant) {
          await updateVariant({ productId: product.id, variantId: variant.id, price: toPaise(price), mrp: mrp ? toPaise(mrp) : toPaise(price), onHand: Number(stock) || 0 }).unwrap();
        } else {
          await createVariant({ productId: product.id, sku: skuFor(name), options: { Size: "Standard" }, price: toPaise(price), mrp: mrp ? toPaise(mrp) : toPaise(price), onHand: Number(stock) || 0 }).unwrap();
        }
      }
      onClose();
    } catch {
      /* standard API error below */
    }
  };

  const saving = updateState.isLoading || createVariantState.isLoading || updateVariantState.isLoading;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <p className="eyebrow">EDIT PRODUCT</p>
        <h2>Update this piece.</h2>
        <label>Category<select className="select-field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Product name<input value={name} onChange={(e) => setName(e.target.value)} required/></label>
        <label>Subtitle <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)}/></label>
        <label>Type <select className="select-field" value={typeId} onChange={(e) => setTypeId(e.target.value)}><option value="">—</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Pearl colour <select className="select-field" value={pearlColourId} onChange={(e) => setPearlColourId(e.target.value)}><option value="">—</option>{colours.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Polish <select className="select-field" value={polishId} onChange={(e) => setPolishId(e.target.value)}><option value="">—</option>{polishes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Stone <select className="select-field" value={stoneId} onChange={(e) => setStoneId(e.target.value)}><option value="">—</option>{stones.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Pearl type <input value={pearlType} onChange={(e) => setPearlType(e.target.value)}/></label>
        <label>Pearl grade <input value={pearlGrade} onChange={(e) => setPearlGrade(e.target.value)}/></label>
        <label>Pearl size (mm) <input type="number" min="0" step="0.1" value={pearlSizeMm} onChange={(e) => setPearlSizeMm(e.target.value)}/></label>
        <label>Lustre <input value={pearlLustre} onChange={(e) => setPearlLustre(e.target.value)}/></label>
        <label>Metal / setting <input value={setting} onChange={(e) => setSetting(e.target.value)}/></label>
        <AttributesEditor attributes={attributes} onChange={setAttributes} />
        <label>Badge <input value={badge} onChange={(e) => setBadge(e.target.value)}/></label>
        <label>Price (₹) <input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)}/></label>
        <label>MRP (₹) <input type="number" min="0" step="1" value={mrp} onChange={(e) => setMrp(e.target.value)} placeholder="Leave blank to match price"/></label>
        <label>Stock <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)}/></label>
        <label>Status<select className="select-field" value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "ACTIVE" | "ARCHIVED")}><option value="ACTIVE">Active — visible on the storefront</option><option value="DRAFT">Draft — hidden for now</option><option value="ARCHIVED">Archived</option></select></label>
        {(updateState.error || createVariantState.error || updateVariantState.error) && <p className="error">This product could not be saved.</p>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}<ArrowUpRight size={17}/></button>
        </div>
      </form>
    </div>
  );
}

function ProductsView() {
  const { data: categoriesData } = useGetCategoriesQuery();
  const { data: productsData, isLoading } = useGetProductsQuery();
  const { data: typesData } = useGetProductTypesQuery();
  const { data: coloursData } = useGetPearlColoursQuery();
  const { data: polishesData } = useGetPolishesQuery();
  const { data: stonesData } = useGetStonesQuery();
  const [createProduct, createState] = useCreateProductMutation();
  const [createVariant, variantState] = useCreateVariantMutation();
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [pearlType, setPearlType] = useState("");
  const [pearlGrade, setPearlGrade] = useState("");
  const [pearlSizeMm, setPearlSizeMm] = useState("");
  const [pearlLustre, setPearlLustre] = useState("");
  const [setting, setSetting] = useState("");
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [typeId, setTypeId] = useState("");
  const [pearlColourId, setPearlColourId] = useState("");
  const [polishId, setPolishId] = useState("");
  const [stoneId, setStoneId] = useState("");
  const [badge, setBadge] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [stock, setStock] = useState("0");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">("ACTIVE");
  const categories = categoriesData?.data ?? [];
  const types = typesData?.data ?? [];
  const colours = coloursData?.data ?? [];
  const polishes = polishesData?.data ?? [];
  const stones = stonesData?.data ?? [];
  const openModal = () => {
    setCategoryId(categories[0]?.id ?? "");
    setTypeId(""); setPearlColourId("");
    setOpen(true);
  };
  const reset = () => {
    setName(""); setSubtitle(""); setPearlType(""); setPearlGrade(""); setPearlSizeMm(""); setPearlLustre(""); setSetting("");
    setAttributes([]);
    setTypeId(""); setPearlColourId(""); setPolishId(""); setStoneId("");
    setBadge(""); setPrice(""); setMrp(""); setStock("0");
    setStatus("ACTIVE"); setOpen(false);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const cleanAttributes = attributes.filter((a) => a.label.trim() && a.value.trim());
      const product = await createProduct({
        categoryId,
        name,
        subtitle: subtitle || undefined,
        pearlType: pearlType || undefined,
        pearlGrade: pearlGrade || undefined,
        pearlSizeMm: pearlSizeMm ? Number(pearlSizeMm) : undefined,
        pearlLustre: pearlLustre || undefined,
        setting: setting || undefined,
        attributes: cleanAttributes.length ? cleanAttributes : undefined,
        typeId: typeId || undefined,
        pearlColourId: pearlColourId || undefined,
        polishId: polishId || undefined,
        stoneId: stoneId || undefined,
        badges: badge ? [badge] : undefined,
        status,
      }).unwrap();
      if (price) {
        await createVariant({
          productId: product.data.id,
          sku: skuFor(name),
          options: { Size: "Standard" },
          price: toPaise(price),
          mrp: mrp ? toPaise(mrp) : toPaise(price),
          onHand: Number(stock) || 0,
        }).unwrap();
      }
      reset();
    } catch { /* standard API error below */ }
  };
  return <>
    <header className="topbar"><div><p className="eyebrow">CATALOGUE / PRODUCTS</p><h1>Products</h1></div><div className="top-actions"><button className="primary" onClick={openModal} disabled={!categories.length}><Plus size={17}/>New product</button></div></header>
    {!categories.length && <div className="empty" style={{ marginTop: 24 }}><Gem size={28}/><h3>Create a category first.</h3><p>Products are always tagged to a category — add one under Catalogue before creating a product.</p></div>}
    <section className="collection-heading" style={{ marginTop: 32 }}><div><p className="eyebrow">ALL PRODUCTS</p><h2>{productsData?.data.length ?? 0} products</h2></div></section>
    {isLoading ? <div className="loading">Loading products…</div> : (
      productsData?.data.length ? (
        <table className="product-table">
          <thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Type</th><th>Grade</th><th>Size</th><th>Price</th><th>Stock</th><th>Badge</th><th>Status</th><th></th></tr></thead>
          <tbody>{productsData.data.map((product) => <ProductRow key={product.id} product={product} onEdit={setEditing}/>)}</tbody>
        </table>
      ) : <div className="empty"><Gem size={28}/><h3>No products yet.</h3><p>Create your first product and tag it to a category.</p></div>
    )}
    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
      <p className="eyebrow">NEW PRODUCT</p><h2>Add a piece.</h2>
      <label>Category<select className="select-field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Product name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dew Drop Pendant" required autoFocus/></label>
      <label>Subtitle <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Single pearl, 925 silver"/></label>
      <label>Type <select className="select-field" value={typeId} onChange={(e) => setTypeId(e.target.value)}><option value="">—</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Pearl colour <select className="select-field" value={pearlColourId} onChange={(e) => setPearlColourId(e.target.value)}><option value="">—</option>{colours.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Polish <select className="select-field" value={polishId} onChange={(e) => setPolishId(e.target.value)}><option value="">—</option>{polishes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Stone <select className="select-field" value={stoneId} onChange={(e) => setStoneId(e.target.value)}><option value="">—</option>{stones.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Pearl type <input value={pearlType} onChange={(e) => setPearlType(e.target.value)} placeholder="Freshwater"/></label>
      <label>Pearl grade <input value={pearlGrade} onChange={(e) => setPearlGrade(e.target.value)} placeholder="AA"/></label>
      <label>Pearl size (mm) <input type="number" min="0" step="0.1" value={pearlSizeMm} onChange={(e) => setPearlSizeMm(e.target.value)} placeholder="7"/></label>
      <label>Lustre <input value={pearlLustre} onChange={(e) => setPearlLustre(e.target.value)} placeholder="High"/></label>
      <label>Metal / setting <input value={setting} onChange={(e) => setSetting(e.target.value)} placeholder="925 Silver"/></label>
      <AttributesEditor attributes={attributes} onChange={setAttributes} />
      <label>Badge <input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Everyday"/></label>
      <label>Price (₹) <input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1990"/></label>
      <label>MRP (₹) <input type="number" min="0" step="1" value={mrp} onChange={(e) => setMrp(e.target.value)} placeholder="Leave blank to match price"/></label>
      <label>Stock <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)}/></label>
      <label>Status<select className="select-field" value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "ACTIVE")}><option value="ACTIVE">Active — visible on the storefront</option><option value="DRAFT">Draft — hidden for now</option></select></label>
      {!price && <p style={{ fontSize: ".78rem", color: "#8a765f" }}>No price set — this product won't be sellable until you add one.</p>}
      {(createState.error || variantState.error) && <p className="error">This product could not be saved.</p>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary" disabled={createState.isLoading || variantState.isLoading}>{createState.isLoading || variantState.isLoading ? "Creating…" : "Create product"}<ArrowUpRight size={17}/></button></div>
    </form></div>}
    {editing && <EditProductModal product={editing} categories={categories} types={types} colours={colours} polishes={polishes} stones={stones} onClose={() => setEditing(null)} />}
  </>;
}

function Dashboard() {
  const dispatch = useAppDispatch(); const auth = useAppSelector((state) => state.auth); const [logout] = useLogoutMutation();
  const [view, setView] = useState<View>("catalogue");
  const signOut = async () => { if (auth.refreshToken) { try { await logout({ refreshToken: auth.refreshToken }).unwrap(); } catch { /* local sign-out still succeeds */ } } dispatch(clearSession()); };
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="wordmark"><Gem size={22}/><span>ÉCLAT</span></div>
      <nav>{nav.map(({ label, icon: Icon, view: itemView }) => (
        <button key={label} className={itemView === view ? "nav-item active" : "nav-item"} onClick={() => itemView && setView(itemView)} disabled={!itemView} title={!itemView ? "Coming soon" : undefined}>
          <Icon size={18}/>{label}
        </button>
      ))}</nav>
      <div className="sidebar-bottom"><button className="nav-item"><Settings size={18}/>Settings</button><button className="admin-card" onClick={signOut}><span className="avatar">{auth.admin?.email.slice(0, 1).toUpperCase()}</span><span><b>{auth.admin?.email.split("@")[0]}</b><small>{auth.admin?.role?.toLowerCase()}</small></span><LogOut size={16}/></button></div>
    </aside>
    <main className="content">{view === "homepage" ? <HomepageBuilderView/> : view === "catalogue" ? <CatalogueView/> : <ProductsView/>}</main>
  </div>;
}

export default function App() {
  const dispatch = useAppDispatch(); const auth = useAppSelector((state) => state.auth); const [refresh, refreshState] = useRefreshMutation();
  useEffect(() => { if (auth.accessToken || !auth.refreshToken) return; refresh({ refreshToken: auth.refreshToken }).unwrap().then(({ data }) => dispatch(setSession({ ...auth, ...data }))).catch(() => dispatch(clearSession())); }, [auth, dispatch, refresh]);
  if (!auth.accessToken) return refreshState.isLoading ? <div className="splash">ÉCLAT</div> : <Login/>;
  return <Dashboard/>;
}
