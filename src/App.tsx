import { FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, Camera, ChevronDown, ChevronUp, Gem, Grid2X2, LogOut, Package, ReceiptText, LayoutTemplate, Pencil, Plus, Trash2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { clearSession, setSession } from "./features/auth/authSlice";
import {
  useConfirmCategoryImageMutation,
  useConfirmProductImageMutation,
  useCreateCategoryMutation,
  useCreateProductMutation,
  useDeleteCategoryMutation,
  useCreateVariantMutation,
  useDeleteProductImageMutation,
  useGetCategoriesQuery,
  useGetProductsQuery,
  useLoginMutation,
  useLogoutMutation,
  usePresignCategoryImageMutation,
  usePresignProductImageMutation,
  useRefreshMutation,
  useRemoveCategoryImageMutation,
  useReorderProductImagesMutation,
  useUpdateCategoryMutation,
  useUpdateProductImageMutation,
  useUpdateProductMutation,
  useUpdateVariantMutation,
} from "./lib/adminApi";
import type { Badge, Category, ImageKind, Product, ProductAttribute, ProductStatus } from "./lib/adminApi";
import { compressImage, uploadToS3 } from "./lib/imageUpload";
import { OrdersView } from "./Orders";
import { WebsiteView } from "./Website";

const METALS = ["silver", "gold"] as const;
type Metal = (typeof METALS)[number];
const BADGES: { value: Badge; label: string }[] = [
  { value: "new", label: "New drop" },
  { value: "bestseller", label: "Bestseller" },
  { value: "limited", label: "Limited" },
];
// The storefront's collections — a product joins one by carrying its slug as a tag.
const COLLECTIONS: { value: string; label: string }[] = [
  { value: "new-drops", label: "New drops" },
  { value: "bestsellers", label: "Bestsellers" },
  { value: "everyday-minimal", label: "Everyday minimal" },
  { value: "night-out", label: "Night out" },
  { value: "stack-season", label: "Stack season" },
  { value: "promise", label: "Promise" },
];

// Prices are stored in paise; the form works in rupees.
const toPaise = (rupees: string) => Math.round(Number(rupees) * 100);
const toRupees = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, "");

function skuFor(name: string, metal: string) {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `EE-${base}-${metal.slice(0, 2).toUpperCase()}`;
}

function Login() {
  const dispatch = useAppDispatch(); const [login, { isLoading, error }] = useLoginMutation();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); try { const result = await login({ email, password }).unwrap(); dispatch(setSession(result.data)); } catch { /* error is displayed below */ } }
  return <main className="login-page"><section className="login-brand"><p className="eyebrow">EST. 2026 · ADMINISTRATION</p><Gem size={42} strokeWidth={1.25}/><h1>Éclat<br/>Atelier</h1><p>Curate the pieces, stories, and moments that make every collection shine.</p><div className="orb orb-one"/><div className="orb orb-two"/></section><section className="login-panel"><form onSubmit={submit} className="login-form"><p className="eyebrow">WELCOME BACK</p><h2>Enter the atelier.</h2><p className="form-note">Sign in to manage your storefront.</p><label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@eclat.com" required autoComplete="email"/></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password"/></label>{error && <p className="error">Unable to sign in. Check your credentials and try again.</p>}<button className="primary wide" disabled={isLoading}>{isLoading ? "Signing in…" : "Sign in"}<ArrowUpRight size={17}/></button></form></section></main>;
}

// Free-form label/value rows for whatever specs apply to this piece (e.g. "Closure": "Lobster clasp").
function AttributesEditor({ attributes, onChange }: { attributes: ProductAttribute[]; onChange: (next: ProductAttribute[]) => void }) {
  const update = (i: number, field: "label" | "value", value: string) => onChange(attributes.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  return (
    <div style={{ margin: "1rem 0" }}>
      <p className="eyebrow" style={{ marginBottom: ".5rem" }}>Specifications</p>
      {attributes.map((a, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={a.label} onChange={(e) => update(i, "label", e.target.value)} placeholder="Label (e.g. Closure)" style={{ flex: 1 }} />
          <input value={a.value} onChange={(e) => update(i, "value", e.target.value)} placeholder="Value (e.g. Lobster clasp)" style={{ flex: 1 }} />
          <button type="button" className="icon-button danger" title="Remove" onClick={() => onChange(attributes.filter((_, idx) => idx !== i))}><Trash2 size={15} /></button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => onChange([...attributes, { label: "", value: "" }])}>+ Add specification</button>
    </div>
  );
}

// Product photos: upload (compress -> presign -> PUT straight to S3 -> confirm), mark each as a
// model or packshot shot, reorder, delete. The first photo is the storefront card image, so it
// should be a model shot; the second is the hover image.
function ImageGallery({ product }: { product: Product }) {
  const [presign] = usePresignProductImageMutation();
  const [confirm] = useConfirmProductImageMutation();
  const [updateImage] = useUpdateProductImageMutation();
  const [deleteImage] = useDeleteProductImageMutation();
  const [reorder] = useReorderProductImagesMutation();
  const [kind, setKind] = useState<ImageKind>("model");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    try {
      for (const file of Array.from(files)) {
        setProgress(0);
        const { blob, contentType } = await compressImage(file);
        const { data } = await presign({ id: product.id, contentType }).unwrap();
        await uploadToS3(data.uploadUrl, blob, contentType, setProgress);
        await confirm({ id: product.id, key: data.key, kind, alt: `${product.name}${kind === "model" ? " worn" : ""}` }).unwrap();
      }
    } catch {
      setError("Upload failed. Check the connection (and S3 settings) and try again.");
    } finally {
      setProgress(null);
    }
  };

  const move = (index: number, by: -1 | 1) => {
    const ids = product.images.map((i) => i.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder({ id: product.id, imageIds: ids });
  };

  const first = product.images[0];
  return (
    <div style={{ margin: "1.2rem 0" }}>
      <p className="eyebrow" style={{ marginBottom: ".5rem" }}>Photos</p>
      <p className="form-note" style={{ margin: "0 0 .8rem", fontSize: ".78rem" }}>
        Aim for 4–6 photos. The first must be a model shot (card image); the second is the hover image — a plain-background packshot works best.
      </p>
      {product.images.length > 0 && first?.kind !== "model" && <p className="error">The first photo should be a model shot.</p>}
      <div className="gallery">
        {product.images.map((image, i) => (
          <div key={image.id} className="gallery-item">
            <img src={image.url} alt={image.alt ?? product.name} />
            <select className="select-field" value={image.kind} onChange={(e) => updateImage({ id: product.id, imageId: image.id, kind: e.target.value as ImageKind })}>
              <option value="model">Model</option>
              <option value="packshot">Packshot</option>
            </select>
            <div className="gallery-actions">
              <button type="button" className="icon-button" title="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={14} /></button>
              <button type="button" className="icon-button" title="Move later" disabled={i === product.images.length - 1} onClick={() => move(i, 1)}><ChevronDown size={14} /></button>
              <button type="button" className="icon-button danger" title="Delete photo" onClick={() => deleteImage({ id: product.id, imageId: image.id })}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <select className="select-field" style={{ width: "auto" }} value={kind} onChange={(e) => setKind(e.target.value as ImageKind)}>
          <option value="model">New photos are: Model</option>
          <option value="packshot">New photos are: Packshot</option>
        </select>
        <label className="secondary upload-button" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <Camera size={15} />{progress !== null ? `Uploading… ${progress}%` : "Add photos"}
          <input type="file" accept="image/*" multiple style={{ display: "none" }} disabled={progress !== null} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

type MetalRow = { enabled: boolean; price: string; mrp: string; stock: string };
const emptyMetals = (): Record<Metal, MetalRow> => ({
  silver: { enabled: false, price: "", mrp: "", stock: "0" },
  gold: { enabled: false, price: "", mrp: "", stock: "0" },
});

function metalsOf(product?: Product): Record<Metal, MetalRow> {
  const rows = emptyMetals();
  for (const v of product?.variants ?? []) {
    const metal = v.options.metal as Metal | undefined;
    if (!metal || !(metal in rows)) continue;
    rows[metal] = { enabled: v.status === "ACTIVE", price: toRupees(v.price), mrp: v.mrp > v.price ? toRupees(v.mrp) : "", stock: String(v.inventory?.onHand ?? 0) };
  }
  return rows;
}

function ProductModal({ productId, categories, defaultCategoryId, onCreated, onClose }: {
  productId: string | null;
  categories: Category[];
  defaultCategoryId: string;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const { data: productsData } = useGetProductsQuery();
  const product = productId ? productsData?.data.find((p) => p.id === productId) : undefined;

  const [createProduct, createState] = useCreateProductMutation();
  const [updateProduct, updateState] = useUpdateProductMutation();
  const [createVariant] = useCreateVariantMutation();
  const [updateVariant] = useUpdateVariantMutation();
  const [failed, setFailed] = useState<string | false>(false);

  const [categoryId, setCategoryId] = useState(product?.categoryId ?? defaultCategoryId);
  const needsCategory = !categoryId;
  const [name, setName] = useState(product?.name ?? "");
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [material, setMaterial] = useState(product?.material ?? "");
  const [care, setCare] = useState(product?.care ?? "");
  const [badges, setBadges] = useState<Badge[]>(product?.badges ?? []);
  const [tags, setTags] = useState<string[]>(product?.tags ?? []);
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 0));
  const [attributes, setAttributes] = useState<ProductAttribute[]>(product?.attributes ?? []);
  const [seoTitle, setSeoTitle] = useState(product?.seoTitle ?? "");
  const [seoMeta, setSeoMeta] = useState(product?.seoMeta ?? "");
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "ACTIVE");
  const [metals, setMetals] = useState<Record<Metal, MetalRow>>(metalsOf(product));
  // Parcel details the courier needs to quote and book a pickup. Set once for the whole product.
  const firstVariant = product?.variants.find((v) => v.weightG || v.dims);
  const [weightG, setWeightG] = useState(firstVariant?.weightG ? String(firstVariant.weightG) : "");
  const [dims, setDims] = useState({ length: String(firstVariant?.dims?.length ?? ""), breadth: String(firstVariant?.dims?.breadth ?? ""), height: String(firstVariant?.dims?.height ?? "") });
  const [saving, setSaving] = useState(false);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const setMetal = (metal: Metal, patch: Partial<MetalRow>) => setMetals((m) => ({ ...m, [metal]: { ...m[metal], ...patch } }));
  const sellable = METALS.some((m) => metals[m].enabled && metals[m].price);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false); setSaving(true);
    try {
      const body = {
        categoryId,
        name,
        subtitle,
        description,
        material,
        care,
        badges,
        tags,
        sortOrder: Number(sortOrder) || 0,
        attributes: attributes.filter((a) => a.label.trim() && a.value.trim()),
        seoTitle,
        seoMeta,
        status,
      };
      const saved = product
        ? (await updateProduct({ id: product.id, ...body }).unwrap()).data
        : (await createProduct(body).unwrap()).data;

      // One variant per metal: create on first enable, archive/unarchive on toggle, update otherwise.
      for (const metal of METALS) {
        const row = metals[metal];
        const existing = saved.variants.find((v) => v.options.metal === metal);
        const price = toPaise(row.price);
        const mrp = row.mrp ? toPaise(row.mrp) : price;
        const onHand = Number(row.stock) || 0;
        const parcel = {
          ...(weightG ? { weightG: Math.round(Number(weightG)) } : {}),
          ...(dims.length && dims.breadth && dims.height ? { dims: { length: Number(dims.length), breadth: Number(dims.breadth), height: Number(dims.height) } } : {}),
        };
        if (existing) {
          await updateVariant({ productId: saved.id, variantId: existing.id, price, mrp, onHand, status: row.enabled ? "ACTIVE" : "ARCHIVED", ...parcel }).unwrap();
        } else if (row.enabled && row.price) {
          await createVariant({ productId: saved.id, sku: skuFor(name, metal), options: { metal }, price, mrp, onHand, ...parcel }).unwrap();
        }
      }
      if (product) onClose(); else onCreated(saved.id); // a new product stays open so photos can be added
    } catch (e) {
      // Show the server's reason when it gave one (e.g. stock below what open orders reserved).
      setFailed((e as { data?: { message?: string } }).data?.message ?? "This product could not be saved. Check the fields (names and SKUs must be unique) and try again.");
    } finally {
      setSaving(false);
    }
  };

  // Variants/images are created after the first save, so the modal re-keys itself on `productId`.
  const busy = saving || createState.isLoading || updateState.isLoading;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal wide-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <p className="eyebrow">{product ? "EDIT PRODUCT" : "NEW PRODUCT"}</p>
        <h2>{product ? "Update this piece." : "Add a piece."}</h2>

        <label>Category<select className="select-field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required><option value="" disabled>Select a category…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Product name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lune Pearl Bracelet" required autoFocus={!product}/></label>
        <label>Subtitle<input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Pavé bolo bracelet with a mother-of-pearl halo"/></label>
        <label>Description<textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}/></label>

        <p className="eyebrow" style={{ marginTop: "1.4rem" }}>Metals, price &amp; stock</p>
        {METALS.map((metal) => (
          <div key={metal} className="metal-row">
            <label className="check"><input type="checkbox" checked={metals[metal].enabled} onChange={(e) => setMetal(metal, { enabled: e.target.checked })}/>{metal === "silver" ? "Silver (rhodium plated)" : "Gold (18k plated)"}</label>
            <input type="number" min="0" step="1" placeholder="Price ₹" disabled={!metals[metal].enabled} value={metals[metal].price} onChange={(e) => setMetal(metal, { price: e.target.value })} required={metals[metal].enabled}/>
            <input type="number" min="0" step="1" placeholder="MRP ₹ (strike-through)" disabled={!metals[metal].enabled} value={metals[metal].mrp} onChange={(e) => setMetal(metal, { mrp: e.target.value })}/>
            <input type="number" min="0" step="1" placeholder="Stock" disabled={!metals[metal].enabled} value={metals[metal].stock} onChange={(e) => setMetal(metal, { stock: e.target.value })}/>
          </div>
        ))}
        {!sellable && <p style={{ fontSize: ".78rem", color: "#8a765f" }}>Enable at least one metal with a price — a product without one isn't shown on the storefront.</p>}

        <p className="eyebrow" style={{ marginTop: "1.4rem" }}>Parcel — used to book the courier</p>
        <div className="parcel-row">
          <label>Weight (g)<input type="number" min="1" step="1" value={weightG} onChange={(e) => setWeightG(e.target.value)} placeholder="150"/></label>
          <label>Length (cm)<input type="number" min="0.1" step="0.1" value={dims.length} onChange={(e) => setDims({ ...dims, length: e.target.value })} placeholder="12"/></label>
          <label>Breadth (cm)<input type="number" min="0.1" step="0.1" value={dims.breadth} onChange={(e) => setDims({ ...dims, breadth: e.target.value })} placeholder="12"/></label>
          <label>Height (cm)<input type="number" min="0.1" step="0.1" value={dims.height} onChange={(e) => setDims({ ...dims, height: e.target.value })} placeholder="6"/></label>
        </div>
        <p className="muted" style={{ marginTop: -4 }}>Packed weight and box size. Left blank, the store defaults are used when shipping.</p>

        <p className="eyebrow" style={{ marginTop: "1.4rem" }}>Badges</p>
        <div className="check-row">{BADGES.map((b) => <label key={b.value} className="check"><input type="checkbox" checked={badges.includes(b.value)} onChange={() => setBadges(toggle(badges, b.value))}/>{b.label}</label>)}</div>

        <p className="eyebrow" style={{ marginTop: "1.4rem" }}>Collections</p>
        <div className="check-row">{COLLECTIONS.map((c) => <label key={c.value} className="check"><input type="checkbox" checked={tags.includes(c.value)} onChange={() => setTags(toggle(tags, c.value))}/>{c.label}</label>)}</div>

        <label>Material<textarea rows={2} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="925 sterling silver, rhodium plated. Freshwater cultured pearls."/></label>
        <label>Care<textarea rows={2} value={care} onChange={(e) => setCare(e.target.value)} placeholder="Put it on last — after perfume and lotion — and wipe with the cloth provided."/></label>
        <AttributesEditor attributes={attributes} onChange={setAttributes} />

        <label>Featured order (lower shows first)<input type="number" step="1" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}/></label>
        <label>SEO title<input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={`${name || "Product"} — Eclat Empire`}/></label>
        <label>SEO description<input value={seoMeta} onChange={(e) => setSeoMeta(e.target.value)}/></label>
        <label>Status<select className="select-field" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}><option value="ACTIVE">Active — visible on the storefront</option><option value="DRAFT">Draft — hidden for now</option><option value="ARCHIVED">Archived</option></select></label>

        {product ? <ImageGallery product={product}/> : <p style={{ fontSize: ".78rem", color: "#8a765f" }}>Save the product first, then add its photos.</p>}

        {failed && <p className="error">{failed}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>{product ? "Close" : "Cancel"}</button>
          <button className="primary" disabled={busy || needsCategory}>{busy ? "Saving…" : product ? "Save changes" : "Create product"}<ArrowUpRight size={17}/></button>
        </div>
      </form>
    </div>
  );
}

function ProductRow({ product, onEdit }: { product: Product; onEdit: (product: Product) => void }) {
  const thumb = product.images[0]?.url;
  const live = product.variants.filter((v) => v.status === "ACTIVE");
  const prices = live.map((v) => v.price);
  const stock = live.reduce((n, v) => n + Math.max(0, (v.inventory?.onHand ?? 0) - (v.inventory?.reserved ?? 0)), 0);
  const metals = live.map((v) => v.options.metal).filter(Boolean).join(", ");
  return <tr>
    <td>{thumb ? <img src={thumb} alt={product.name} className="product-thumb"/> : <span className="product-thumb-placeholder"><Camera size={16}/></span>}</td>
    <td><b>{product.name}</b>{product.subtitle && <div style={{ color: "#8a8178", fontSize: ".8rem" }}>{product.subtitle}</div>}</td>
    <td style={{ textTransform: "capitalize" }}>{metals || "—"}</td>
    <td>{prices.length ? `₹${toRupees(Math.min(...prices))}` : <span style={{ color: "#b33b32" }}>No price</span>}</td>
    <td>{live.length ? stock : "—"}</td>
    <td>{product.images.length}</td>
    <td>{product.badges.join(", ") || "—"}</td>
    <td><span className={`status-pill ${product.status}`}>{product.status}</span></td>
    <td><button type="button" className="icon-button" title="Edit product" onClick={() => onEdit(product)}><Pencil size={15}/></button></td>
  </tr>;
}

function ProductsView() {
  const { data: categoriesData } = useGetCategoriesQuery();
  const { data: productsData, isLoading } = useGetProductsQuery();
  // undefined = closed, null = new product, string = editing that product
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const [filter, setFilter] = useState("");
  const categories = (categoriesData?.data ?? []).filter((c) => c.status !== "ARCHIVED");
  const products = (productsData?.data ?? []).filter((p) => !filter || p.categoryId === filter);
  return <>
    <header className="topbar"><div><p className="eyebrow">CATALOGUE</p><h1>Products</h1></div><div className="top-actions"><button className="primary" onClick={() => setOpen(null)} disabled={!categories.length}><Plus size={17}/>New product</button></div></header>
    {categoriesData && !categories.length && <div className="empty" style={{ marginTop: 24 }}><Gem size={28}/><h3>Create a category first.</h3><p>Every product belongs to a category — add one under Categories.</p></div>}
    <section className="collection-heading" style={{ marginTop: 32 }}><div><p className="eyebrow">ALL PRODUCTS</p><h2>{products.length} products</h2></div>
      <select className="select-field" style={{ width: "auto" }} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></section>
    {isLoading ? <div className="loading">Loading products…</div> : (
      products.length ? (
        <table className="product-table">
          <thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Metals</th><th>From</th><th>Stock</th><th>Photos</th><th>Badge</th><th>Status</th><th></th></tr></thead>
          <tbody>{products.map((product) => <ProductRow key={product.id} product={product} onEdit={(p) => setOpen(p.id)}/>)}</tbody>
        </table>
      ) : <div className="empty"><Gem size={28}/><h3>No products yet.</h3><p>Create your first piece.</p></div>
    )}
    {/* A just-created product opens for photos once the refetched list contains it. */}
    {categories.length > 0 && (open === null || (typeof open === "string" && products.some((p) => p.id === open))) && <ProductModal key={open ?? "new"} productId={open} categories={categories} defaultCategoryId={filter} onCreated={setOpen} onClose={() => setOpen(undefined)}/>}
  </>;
}

// Category tile image: the storefront shows it as a tall (7:8) tile, so a portrait crop works best.
function CategoryModal({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const [createCategory, createState] = useCreateCategoryMutation();
  const [updateCategory, updateState] = useUpdateCategoryMutation();
  const [presign] = usePresignCategoryImageMutation();
  const [confirm] = useConfirmCategoryImageMutation();
  const [removeImage] = useRemoveCategoryImageMutation();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [position, setPosition] = useState(String(category?.position ?? 0));
  const [status, setStatus] = useState<Category["status"]>(category?.status ?? "ACTIVE");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const body = { name, description, position: Number(position) || 0, status, ...(slug.trim() ? { slug: slug.trim() } : {}) };
      if (category) await updateCategory({ id: category.id, ...body }).unwrap();
      else await createCategory(body).unwrap();
      onClose();
    } catch {
      setError("Could not save. The slug must be lowercase letters, numbers and hyphens, and unique.");
    }
  };

  const upload = async (file?: File) => {
    if (!file || !category) return;
    setError(""); setProgress(0);
    try {
      const { blob, contentType } = await compressImage(file);
      const { data } = await presign({ id: category.id, contentType }).unwrap();
      await uploadToS3(data.uploadUrl, blob, contentType, setProgress);
      await confirm({ id: category.id, key: data.key }).unwrap();
    } catch {
      setError("Upload failed. Check the connection (and S3 settings) and try again.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <p className="eyebrow">{category ? "EDIT CATEGORY" : "NEW CATEGORY"}</p>
        <h2>{category ? "Update this category." : "Add a category."}</h2>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bracelets" required autoFocus={!category}/></label>
        <label>URL slug<input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={name ? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : "bracelets"}/></label>
        <label>Description (shown under the name)<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pearl lines, coils and everyday chains."/></label>
        <label>Display order (lower first)<input type="number" step="1" value={position} onChange={(e) => setPosition(e.target.value)}/></label>
        <label>Status<select className="select-field" value={status} onChange={(e) => setStatus(e.target.value as Category["status"])}><option value="ACTIVE">Active — visible on the storefront</option><option value="DRAFT">Draft — hidden for now</option><option value="ARCHIVED">Archived</option></select></label>
        {category ? (
          <div style={{ margin: "1rem 0" }}>
            <p className="eyebrow" style={{ marginBottom: ".5rem" }}>Tile image</p>
            {category.image && <img src={category.image} alt={category.name} style={{ width: 140, aspectRatio: "7/8", objectFit: "cover", display: "block", marginBottom: 8 }}/>}
            <div style={{ display: "flex", gap: 8 }}>
              <label className="secondary" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <Camera size={15}/>{progress !== null ? `Uploading… ${progress}%` : category.image ? "Replace image" : "Upload image"}
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={progress !== null} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }}/>
              </label>
              {category.image && <button type="button" className="icon-button danger" title="Remove image" onClick={() => removeImage({ id: category.id })}><Trash2 size={15}/></button>}
            </div>
          </div>
        ) : <p style={{ fontSize: ".78rem", color: "#8a765f" }}>Save the category first, then add its image.</p>}
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Close</button>
          <button className="primary" disabled={createState.isLoading || updateState.isLoading}>{category ? "Save changes" : "Create category"}<ArrowUpRight size={17}/></button>
        </div>
      </form>
    </div>
  );
}

function CategoriesView() {
  const { data, isLoading } = useGetCategoriesQuery();
  const [deleteCategory] = useDeleteCategoryMutation();
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const categories = data?.data ?? [];
  const editing = typeof open === "string" ? categories.find((c) => c.id === open) : undefined;
  const remove = async (c: Category) => {
    if (!window.confirm(`Delete “${c.name}”?`)) return;
    setError("");
    try { await deleteCategory({ id: c.id }).unwrap(); }
    catch (e) { setError((e as { data?: { message?: string } }).data?.message ?? "Could not delete this category."); }
  };
  return <>
    <header className="topbar"><div><p className="eyebrow">CATALOGUE</p><h1>Categories</h1></div><div className="top-actions"><button className="primary" onClick={() => setOpen(null)}><Plus size={17}/>New category</button></div></header>
    {error && <p className="error" style={{ marginTop: 16 }}>{error}</p>}
    <section className="collection-heading" style={{ marginTop: 32 }}><div><p className="eyebrow">ALL CATEGORIES</p><h2>{categories.length} categories</h2></div></section>
    {isLoading ? <div className="loading">Loading categories…</div> : categories.length ? (
      <table className="product-table">
        <thead><tr><th>Image</th><th>Name</th><th>Slug</th><th>Products</th><th>Order</th><th>Status</th><th></th></tr></thead>
        <tbody>{categories.map((c) => <tr key={c.id}>
          <td>{c.image ? <img src={c.image} alt={c.name} className="product-thumb"/> : <span className="product-thumb-placeholder"><Camera size={16}/></span>}</td>
          <td><b>{c.name}</b>{c.description && <div style={{ color: "#8a8178", fontSize: ".8rem" }}>{c.description}</div>}</td>
          <td>{c.slug}</td><td>{c._count?.products ?? 0}</td><td>{c.position}</td>
          <td><span className={`status-pill ${c.status}`}>{c.status}</span></td>
          <td style={{ whiteSpace: "nowrap" }}><button type="button" className="icon-button" title="Edit" onClick={() => setOpen(c.id)}><Pencil size={15}/></button> <button type="button" className="icon-button danger" title="Delete" onClick={() => remove(c)}><Trash2 size={15}/></button></td>
        </tr>)}</tbody>
      </table>
    ) : <div className="empty"><Gem size={28}/><h3>No categories yet.</h3><p>Create your first category.</p></div>}
    {(open === null || editing) && <CategoryModal key={open ?? "new"} category={editing ?? null} onClose={() => setOpen(undefined)}/>}
  </>;
}

function Dashboard() {
  const dispatch = useAppDispatch(); const auth = useAppSelector((state) => state.auth); const [logout] = useLogoutMutation();
  const [view, setView] = useState<"orders" | "categories" | "products" | "website">("orders");
  const signOut = async () => { if (auth.refreshToken) { try { await logout({ refreshToken: auth.refreshToken }).unwrap(); } catch { /* local sign-out still succeeds */ } } dispatch(clearSession()); };
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="wordmark"><Gem size={22}/><span>ÉCLAT</span></div>
      <nav>
        <button className={view === "orders" ? "nav-item active" : "nav-item"} onClick={() => setView("orders")}><ReceiptText size={18}/>Orders</button>
        <button className={view === "website" ? "nav-item active" : "nav-item"} onClick={() => setView("website")}><LayoutTemplate size={18}/>Website</button>
        <button className={view === "categories" ? "nav-item active" : "nav-item"} onClick={() => setView("categories")}><Grid2X2 size={18}/>Categories</button>
        <button className={view === "products" ? "nav-item active" : "nav-item"} onClick={() => setView("products")}><Package size={18}/>Products</button>
      </nav>
      <div className="sidebar-bottom"><button className="admin-card" onClick={signOut}><span className="avatar">{auth.admin?.email.slice(0, 1).toUpperCase()}</span><span><b>{auth.admin?.email.split("@")[0]}</b><small>{auth.admin?.role?.toLowerCase()}</small></span><LogOut size={16}/></button></div>
    </aside>
    <main className="content">{view === "orders" ? <OrdersView/> : view === "website" ? <WebsiteView/> : view === "categories" ? <CategoriesView/> : <ProductsView/>}</main>
  </div>;
}

export default function App() {
  const dispatch = useAppDispatch(); const auth = useAppSelector((state) => state.auth); const [refresh, refreshState] = useRefreshMutation();
  useEffect(() => { if (auth.accessToken || !auth.refreshToken) return; refresh({ refreshToken: auth.refreshToken }).unwrap().then(({ data }) => dispatch(setSession({ ...auth, ...data }))).catch(() => dispatch(clearSession())); }, [auth, dispatch, refresh]);
  if (!auth.accessToken) return refreshState.isLoading ? <div className="splash">ÉCLAT</div> : <Login/>;
  return <Dashboard/>;
}
