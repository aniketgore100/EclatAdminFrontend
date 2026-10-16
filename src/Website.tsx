import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, ExternalLink, History, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  useCreateSitePreviewMutation,
  useDiscardSiteMutation,
  useGetCategoriesQuery,
  useGetSiteQuery,
  useGetSiteRevisionsQuery,
  usePublishSiteMutation,
  useRestoreSiteRevisionMutation,
  useSaveSiteDraftMutation,
} from "./lib/adminApi";
import type { Json, SiteDraft } from "./lib/adminApi";
import { CHROME_FIELDS, SECTION_TYPES } from "./lib/siteSchema";
import { FieldGroup, FormProvider, STOREFRONT_URL } from "./SiteForm";

const errMessage = (e: unknown, fallback: string) => {
  const d = (e as { data?: { message?: string; details?: { issues?: { path: string; message: string }[] } } })?.data;
  const first = d?.details?.issues?.[0];
  return first ? `${first.path ? `${first.path.replace(/\./g, " › ")}: ` : ""}${first.message}` : d?.message ?? fallback;
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "never");
const newId = (type: string) => `${type.replace(/[^a-z]/g, "")}_${Math.random().toString(36).slice(2, 6)}`;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------------------------------------------------------- one section */

function SectionEditor({ section, onSave, onClose }: { section: Json; onSave: (s: Json) => void; onClose: () => void }) {
  const meta = SECTION_TYPES[section.type];
  const [draft, setDraft] = useState<Json>(section);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide-modal" onMouseDown={(e) => e.stopPropagation()}>
        <p className="eyebrow">EDIT SECTION · {meta?.label.toUpperCase()}</p>
        <h2>{draft.name || meta?.label}</h2>
        <p className="muted" style={{ marginTop: -10 }}>{meta?.blurb}</p>
        <label className="sf-field">Name in this list (only you see it)<input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value || undefined })} placeholder={meta?.label} /></label>
        <FieldGroup fields={meta?.fields ?? []} value={draft} onChange={setDraft} />
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" onClick={() => onSave(draft)}>Save section</button>
        </div>
      </div>
    </div>
  );
}

function AddSection({ onPick, onClose }: { onPick: (type: string) => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide-modal" onMouseDown={(e) => e.stopPropagation()}>
        <p className="eyebrow">ADD A SECTION</p>
        <h2>What do you want to add?</h2>
        <div className="type-grid">
          {Object.entries(SECTION_TYPES).map(([type, m]) => (
            <button key={type} type="button" className="type-card" onClick={() => onPick(type)}>
              <b>{m.label}</b>
              <span>{m.blurb}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

function HistoryModal({ onClose, onRestored }: { onClose: () => void; onRestored: () => void }) {
  const { data } = useGetSiteRevisionsQuery();
  const [restore, state] = useRestoreSiteRevisionMutation();
  const [error, setError] = useState("");
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal wide-modal" onMouseDown={(e) => e.stopPropagation()}>
        <p className="eyebrow">PUBLISH HISTORY</p>
        <h2>Earlier versions of the site</h2>
        <p className="muted" style={{ marginTop: -10 }}>Restoring loads that version into your draft. It only goes live when you publish.</p>
        {(data?.data ?? []).map((r) => (
          <div key={r.id} className="rev-row">
            <div><b>{when(r.publishedAt)}</b> {r.isLive && <span className="pill s-CONFIRMED">Live now</span>}<div className="muted">{r.publishedBy ?? "unknown"} · {r.sections} sections{r.note ? ` · “${r.note}”` : ""}</div></div>
            {!r.isLive && (
              <button type="button" className="secondary icon-text" disabled={state.isLoading} onClick={async () => {
                if (!window.confirm("Load this version into your draft? Your current unpublished edits will be replaced.")) return;
                try { await restore(r.id).unwrap(); onRestored(); onClose(); } catch (e) { setError(errMessage(e, "Couldn't restore that version.")); }
              }}><RotateCcw size={14} /> Restore</button>
            )}
          </div>
        ))}
        {data && data.data.length === 0 && <p className="muted">Nothing has been published from the builder yet.</p>}
        {error && <p className="error">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- the page */

export function WebsiteView() {
  const siteQ = useGetSiteQuery();
  const { data: catData } = useGetCategoriesQuery();
  const [save] = useSaveSiteDraftMutation();
  const [publish, publishState] = usePublishSiteMutation();
  const [discard] = useDiscardSiteMutation();
  const [makePreview] = useCreateSitePreviewMutation();
  const site = siteQ.data?.data;

  const [tab, setTab] = useState<"home" | "chrome">("home");
  const [doc, setDoc] = useState<SiteDraft | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [chromeBuf, setChromeBuf] = useState<Json | null>(null);
  const [seoBuf, setSeoBuf] = useState<Json | null>(null);
  const [saving, setSaving] = useState(false);

  // The server copy is the source of truth; local state only runs ahead of it between a click and its reply.
  const version = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (!site) return;
    version.current = site.version;
    setDoc(site.draft);
    setChromeBuf(site.draft.chrome);
    setSeoBuf(site.draft.home.seo);
  }, [site?.version, site?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saves run one at a time, each with the newest version, so quick successive clicks never conflict with themselves.
  const commit = useCallback((next: SiteDraft, okText?: string) => {
    setDoc(next);
    setSaving(true);
    const run = async () => {
      try {
        const r = await save({ version: version.current, draft: next }).unwrap();
        version.current = r.data.version;
        setNotice(okText ? { kind: "ok", text: okText } : null);
        return true;
      } catch (e) {
        setNotice({ kind: "error", text: errMessage(e, "Couldn't save your change.") });
        siteQ.refetch(); // fall back to what the server really has
        return false;
      } finally {
        setSaving(false);
      }
    };
    const p = queue.current.then(run, run);
    queue.current = p;
    return p as Promise<boolean>;
  }, [save, siteQ]);

  const categories = useMemo(() => (catData?.data ?? []).map((c) => ({ value: c.slug, label: c.name })), [catData]);
  const sections: Json[] = doc?.home.sections ?? [];
  const setSections = (next: Json[], okText?: string) => doc && commit({ ...doc, home: { ...doc.home, sections: next } }, okText);
  const move = (i: number, by: -1 | 1) => { const j = i + by; if (j < 0 || j >= sections.length) return; const n = [...sections]; [n[i], n[j]] = [n[j]!, n[i]!]; setSections(n); };

  const doPublish = async () => {
    if (!window.confirm("Publish all changes to the live website?")) return;
    try { await publish().unwrap(); setNotice({ kind: "ok", text: "Published — your changes are live." }); } catch (e) { setNotice({ kind: "error", text: errMessage(e, "Couldn't publish.") }); }
  };
  const doDiscard = async () => {
    if (!window.confirm("Throw away every unpublished change and go back to what's live?")) return;
    try { await discard().unwrap(); setNotice({ kind: "ok", text: "Unpublished changes discarded." }); } catch (e) { setNotice({ kind: "error", text: errMessage(e, "Couldn't discard.") }); }
  };
  const doPreview = async () => {
    if ((chromeBuf && doc && !sameJson(chromeBuf, doc.chrome)) || (seoBuf && doc && !sameJson(seoBuf, doc.home.seo))) {
      if (!window.confirm("You have edits you haven't saved yet — they won't show in the preview. Preview anyway?")) return;
    }
    try { const r = await makePreview().unwrap(); window.open(`${STOREFRONT_URL}/?preview=${r.data.token}`, "_blank", "noopener"); } catch (e) { setNotice({ kind: "error", text: errMessage(e, "Couldn't open the preview.") }); }
  };

  if (siteQ.isLoading || !doc || !site) return <div className="loading">{siteQ.isError ? "Couldn't load the website content." : "Loading the website…"}</div>;
  const editingSection = sections.find((s) => s.id === editing);
  const chromeDirty = chromeBuf && !sameJson(chromeBuf, doc.chrome);
  const seoDirty = seoBuf && !sameJson(seoBuf, doc.home.seo);

  return (
    <FormProvider value={{ categories }}>
      <header className="topbar">
        <div>
          <p className="eyebrow">WEBSITE</p>
          <h1>Website builder</h1>
        </div>
        <div className="top-actions">
          <button type="button" className="secondary icon-text" onClick={() => setHistory(true)}><History size={15} /> History</button>
          <button type="button" className="secondary icon-text" onClick={doPreview}><ExternalLink size={15} /> Preview draft</button>
          {site.hasUnpublishedChanges && <button type="button" className="secondary" onClick={doDiscard}>Discard changes</button>}
          <button type="button" className="primary" disabled={!site.hasUnpublishedChanges || publishState.isLoading || saving} onClick={doPublish}>{publishState.isLoading ? "Publishing…" : "Publish"}</button>
        </div>
      </header>

      <div className={`site-status ${site.hasUnpublishedChanges ? "dirty" : "clean"}`}>
        {site.hasUnpublishedChanges ? <b>Unpublished changes</b> : <b>Live site is up to date</b>}
        <span>Last published {when(site.publishedAt)}{site.publishedBy ? ` by ${site.publishedBy}` : ""} · edits are saved as a draft and only appear on the site after you press Publish.</span>
        {saving && <em>Saving…</em>}
      </div>
      {notice && <p className={notice.kind === "error" ? "error" : "ok-note"} role="status">{notice.text} <button type="button" className="link-button" onClick={() => setNotice(null)}>dismiss</button></p>}

      <div className="segmented" style={{ margin: "18px 0" }}>
        <button type="button" className={tab === "home" ? "on" : ""} onClick={() => setTab("home")}>Homepage</button>
        <button type="button" className={tab === "chrome" ? "on" : ""} onClick={() => setTab("chrome")}>Header, footer &amp; menus</button>
      </div>

      {tab === "home" && (
        <>
          <div className="card seo-card">
            <div className="card-head"><b>Page title &amp; description (search engines)</b>{seoDirty && <button type="button" className="primary" onClick={() => doc && commit({ ...doc, home: { ...doc.home, seo: seoBuf as never } }, "Page title saved to the draft.")}>Save</button>}</div>
            <div className="sf-grid">
              <label className="sf-field">Title<input value={seoBuf?.title ?? ""} onChange={(e) => setSeoBuf({ ...seoBuf, title: e.target.value })} /></label>
              <label className="sf-field">Description<input value={seoBuf?.description ?? ""} onChange={(e) => setSeoBuf({ ...seoBuf, description: e.target.value })} /></label>
            </div>
          </div>

          <div className="collection-heading" style={{ marginTop: 24 }}>
            <div><p className="eyebrow">TOP TO BOTTOM</p><h2>{sections.length} sections</h2></div>
            <button type="button" className="primary icon-text" onClick={() => setAdding(true)}><Plus size={16} /> Add section</button>
          </div>
          <ol className="section-list">
            {sections.map((s, i) => {
              const meta = SECTION_TYPES[s.type];
              return (
                <li key={s.id} className={`section-row ${s.enabled === false ? "off" : ""}`}>
                  <span className="sec-index">{i + 1}</span>
                  <div className="sec-main">
                    <div><b>{s.name || meta?.label || s.type}</b> {s.name && s.name !== meta?.label && <span className="pill type-pill">{meta?.label ?? s.type}</span>} {s.enabled === false && <span className="pill s-CANCELLED">Hidden</span>}</div>
                    <div className="muted">{meta ? meta.summary(s) : ""}</div>
                  </div>
                  <div className="sec-actions">
                    <button type="button" className="icon-button" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                    <button type="button" className="icon-button" title="Move down" disabled={i === sections.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                    <button type="button" className="icon-button" title={s.enabled === false ? "Show on the site" : "Hide from the site"} onClick={() => setSections(sections.map((x, j) => (j === i ? { ...x, enabled: x.enabled === false } : x)))}>{s.enabled === false ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                    <button type="button" className="icon-button" title="Duplicate" onClick={() => setSections([...sections.slice(0, i + 1), { ...JSON.parse(JSON.stringify(s)), id: newId(s.type), name: `${s.name || meta?.label || s.type} (copy)` }, ...sections.slice(i + 1)])}><Copy size={15} /></button>
                    <button type="button" className="secondary icon-text" onClick={() => setEditing(s.id)}><Pencil size={14} /> Edit</button>
                    <button type="button" className="icon-button danger" title="Delete" onClick={() => window.confirm(`Delete “${s.name || meta?.label}” from the page?`) && setSections(sections.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="muted" style={{ marginTop: 14 }}>Products, reviews and customer photos inside these sections are managed in their own places (Products, customer reviews). Here you control each section's wording, photos, links, order and visibility.</p>
        </>
      )}

      {tab === "chrome" && chromeBuf && (
        <>
          <div className="sticky-save">
            <span className="muted">{chromeDirty ? "You have unsaved edits." : "All saved to the draft."}</span>
            <button type="button" className="secondary" disabled={!chromeDirty} onClick={() => setChromeBuf(doc.chrome)}>Undo edits</button>
            <button type="button" className="primary" disabled={!chromeDirty} onClick={() => commit({ ...doc, chrome: chromeBuf as never }, "Header & footer saved to the draft.")}>Save</button>
          </div>
          {CHROME_FIELDS.map((g) => (
            <div key={g.title} className="card" style={{ marginBottom: 12 }}>
              <div className="card-head"><b>{g.title}</b><span>{g.blurb}</span></div>
              <FieldGroup fields={g.fields} value={chromeBuf} onChange={setChromeBuf} />
            </div>
          ))}
        </>
      )}

      {editingSection && (
        <SectionEditor
          key={editingSection.id}
          section={editingSection}
          onClose={() => setEditing(null)}
          onSave={(next) => { setSections(sections.map((s) => (s.id === next.id ? next : s)), "Section saved to the draft."); setEditing(null); }}
        />
      )}
      {adding && (
        <AddSection
          onClose={() => setAdding(false)}
          onPick={(type) => {
            const section = { ...SECTION_TYPES[type]!.make(), id: newId(type), enabled: true };
            setSections([...sections, section]);
            setAdding(false);
            setEditing(section.id);
          }}
        />
      )}
      {history && <HistoryModal onClose={() => setHistory(false)} onRestored={() => setNotice({ kind: "ok", text: "Earlier version loaded into your draft. Publish to make it live." })} />}
    </FormProvider>
  );
}
