import { FormEvent, useState } from "react";
import { useEffect } from "react";
import { Archive, ArrowUpRight, Camera, Gem, Grid2X2, LayoutDashboard, LogOut, Package, Plus, Search, Settings, Sparkles, Trash2, Users } from "lucide-react";
import { useAppDispatch, useAppSelector } from "./app/hooks";
import { clearSession, setSession } from "./features/auth/authSlice";
import {
  useConfirmCategoryImageMutation,
  useConfirmProductImageMutation,
  useCreateCategoryMutation,
  useCreateProductMutation,
  useDeleteCategoryMutation,
  useGetCategoriesQuery,
  useGetProductsQuery,
  useLoginMutation,
  useLogoutMutation,
  usePresignCategoryImageMutation,
  usePresignProductImageMutation,
  useRefreshMutation,
} from "./lib/adminApi";
import type { Category } from "./lib/adminApi";
import { compressImage, uploadToS3 } from "./lib/imageUpload";

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
  const upload = async (id: string, file: File, type: "image" | "banner" = "image") => {
    setIsUploading(true); setProgress(0);
    try {
      const { blob, contentType } = await compressImage(file);
      const { data } = await presign({ id, contentType, type }).unwrap();
      await uploadToS3(data.uploadUrl, blob, contentType, setProgress);
      await confirm({ id, key: data.key, type }).unwrap();
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

type View = "catalogue" | "products";
const nav: { label: string; icon: typeof LayoutDashboard; view?: View }[] = [
  { label: "Overview", icon: LayoutDashboard },
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

function CategoryCard({ category, onDelete }: { category: Category; onDelete: (category: Category) => void }) {
  const { upload, progress, isUploading } = useCategoryImageUpload();
  const onImage = async (file?: File) => { if (file) await upload(category.id, file, "image"); };
  return <article className="category-card"><div className="category-media">{category.image ? <img src={category.image} alt={category.name}/> : <div className="media-placeholder"><Gem size={27}/></div>}<label className="image-action"><Camera size={15}/><input type="file" accept="image/*" onChange={(e) => onImage(e.target.files?.[0])}/></label>{isUploading && <span className="uploading">Uploading… {progress}%</span>}</div><div className="category-copy"><div><p className="category-index">COLLECTION · {String(category.position + 1).padStart(2, "0")}</p><h3>{category.name}</h3></div><p>{category.description || "A considered collection, ready for your next edit."}</p><div className="category-foot"><span>/{category.slug}</span><button type="button" className="icon-button danger" title="Delete collection" onClick={() => onDelete(category)}><Trash2 size={15}/></button></div></div></article>;
}

function CatalogueView() {
  const { data, isLoading } = useGetCategoriesQuery();
  const [createCategory, createState] = useCreateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await createCategory({ name, description: description || undefined }).unwrap(); setName(""); setDescription(""); setOpen(false); } catch { /* standard API error below */ } };
  const onDelete = async (category: Category) => {
    if (!window.confirm(`Delete "${category.name}"? This can't be undone.`)) return;
    try { await deleteCategory({ id: category.id }).unwrap(); }
    catch { window.alert("Couldn't delete this collection — it may still have products in it. Move or delete those first."); }
  };
  return <>
    <header className="topbar"><div><p className="eyebrow">CATALOGUE / COLLECTIONS</p><h1>The collection edit</h1></div><div className="top-actions"><button className="icon-button"><Search size={19}/></button><button className="primary" onClick={() => setOpen(true)}><Plus size={17}/>New collection</button></div></header>
    <section className="hero"><div><p className="eyebrow">THE CURATOR'S DESK</p><h2>Give every piece<br/><em>a place to belong.</em></h2><p>Build collections that turn a catalogue into a point of view.</p></div><Sparkles className="hero-sparkle" size={46} strokeWidth={1}/></section>
    <section className="collection-heading"><div><p className="eyebrow">LIVE COLLECTIONS</p><h2>{data?.data.length ?? 0} collections</h2></div><span>Drag to arrange the storefront order</span></section>
    {isLoading ? <div className="loading">Loading your collection…</div> : <section className="category-grid">{data?.data.map((category) => <CategoryCard key={category.id} category={category} onDelete={onDelete}/>)}{!data?.data.length && <div className="empty"><Gem size={28}/><h3>Your first collection starts here.</h3><p>Create a category, then add its imagery and products.</p><button className="primary" onClick={() => setOpen(true)}><Plus size={17}/>Create collection</button></div>}</section>}
    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}><p className="eyebrow">NEW COLLECTION</p><h2>Name the story.</h2><label>Collection name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pearl essentials" required autoFocus/></label><label>Short description <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="An elegant line about this collection." rows={3}/></label>{createState.error && <p className="error">This collection could not be saved. The name may already be in use.</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary" disabled={createState.isLoading}>{createState.isLoading ? "Creating…" : "Create collection"}<ArrowUpRight size={17}/></button></div></form></div>}
  </>;
}

function ProductRow({ product }: { product: { id: string; name: string; subtitle?: string | null; status: string; pearlGrade?: string | null; category?: { name: string }; images?: { url: string }[] } }) {
  const { upload, progress, isUploading } = useProductImageUpload();
  const onImage = async (file?: File) => { if (file) await upload(product.id, file); };
  const thumb = product.images?.[0]?.url;
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
    <td>{product.pearlGrade ?? "—"}</td>
    <td><span className={`status-pill ${product.status}`}>{product.status}</span></td>
  </tr>;
}

function ProductsView() {
  const { data: categoriesData } = useGetCategoriesQuery();
  const { data: productsData, isLoading } = useGetProductsQuery();
  const [createProduct, createState] = useCreateProductMutation();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [pearlGrade, setPearlGrade] = useState("");
  const [setting, setSetting] = useState("");
  const categories = categoriesData?.data ?? [];
  const openModal = () => { setCategoryId(categories[0]?.id ?? ""); setOpen(true); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createProduct({ categoryId, name, subtitle: subtitle || undefined, pearlGrade: pearlGrade || undefined, setting: setting || undefined }).unwrap();
      setName(""); setSubtitle(""); setPearlGrade(""); setSetting(""); setOpen(false);
    } catch { /* standard API error below */ }
  };
  return <>
    <header className="topbar"><div><p className="eyebrow">CATALOGUE / PRODUCTS</p><h1>Products</h1></div><div className="top-actions"><button className="primary" onClick={openModal} disabled={!categories.length}><Plus size={17}/>New product</button></div></header>
    {!categories.length && <div className="empty" style={{ marginTop: 24 }}><Gem size={28}/><h3>Create a collection first.</h3><p>Products are always tagged to a collection — add one under Catalogue before creating a product.</p></div>}
    <section className="collection-heading" style={{ marginTop: 32 }}><div><p className="eyebrow">ALL PRODUCTS</p><h2>{productsData?.data.length ?? 0} products</h2></div></section>
    {isLoading ? <div className="loading">Loading products…</div> : (
      productsData?.data.length ? (
        <table className="product-table">
          <thead><tr><th>Image</th><th>Name</th><th>Collection</th><th>Grade</th><th>Status</th></tr></thead>
          <tbody>{productsData.data.map((product) => <ProductRow key={product.id} product={product}/>)}</tbody>
        </table>
      ) : <div className="empty"><Gem size={28}/><h3>No products yet.</h3><p>Create your first product and tag it to a collection.</p></div>
    )}
    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
      <p className="eyebrow">NEW PRODUCT</p><h2>Add a piece.</h2>
      <label>Collection<select className="select-field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Product name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dew Drop Pendant" required autoFocus/></label>
      <label>Subtitle <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Single pearl, 925 silver"/></label>
      <label>Pearl grade <input value={pearlGrade} onChange={(e) => setPearlGrade(e.target.value)} placeholder="AA"/></label>
      <label>Setting / metal <input value={setting} onChange={(e) => setSetting(e.target.value)} placeholder="925 Silver"/></label>
      {createState.error && <p className="error">This product could not be saved.</p>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary" disabled={createState.isLoading}>{createState.isLoading ? "Creating…" : "Create product"}<ArrowUpRight size={17}/></button></div>
    </form></div>}
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
    <main className="content">{view === "catalogue" ? <CatalogueView/> : <ProductsView/>}</main>
  </div>;
}

export default function App() {
  const dispatch = useAppDispatch(); const auth = useAppSelector((state) => state.auth); const [refresh, refreshState] = useRefreshMutation();
  useEffect(() => { if (auth.accessToken || !auth.refreshToken) return; refresh({ refreshToken: auth.refreshToken }).unwrap().then(({ data }) => dispatch(setSession({ ...auth, ...data }))).catch(() => dispatch(clearSession())); }, [auth, dispatch, refresh]);
  if (!auth.accessToken) return refreshState.isLoading ? <div className="splash">ÉCLAT</div> : <Login/>;
  return <Dashboard/>;
}
