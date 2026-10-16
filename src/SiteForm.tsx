import { createContext, useContext, useState } from "react";
import { ArrowDown, ArrowUp, Copy, ImagePlus, Plus, Trash2, Upload, X } from "lucide-react";
import { usePresignSiteImageMutation } from "./lib/adminApi";
import type { Json } from "./lib/adminApi";
import { compressImage, uploadToS3 } from "./lib/imageUpload";
import { COLLECTIONS } from "./lib/siteSchema";
import type { Field, Option } from "./lib/siteSchema";

// Photos on the site are addresses like /products/… (bundled with the storefront) or full https:// links.
// The admin shows previews by prefixing bundled ones with the storefront's address.
export const STOREFRONT_URL: string = (import.meta.env.VITE_STOREFRONT_URL as string | undefined) ?? "http://localhost:5173";
const resolve = (url: string) => (url?.startsWith("/") ? `${STOREFRONT_URL}${url}` : url);

type Ctx = { categories: Option[] };
const FormCtx = createContext<Ctx>({ categories: [] });
export const FormProvider = FormCtx.Provider;

/* --------------------------------------------------------------- path helpers */
const getAt = (obj: Json, path: string): Json => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setAt(obj: Json, path: string, value: Json): Json {
  const [head, ...rest] = path.split(".");
  const next = rest.length ? setAt(obj?.[head] ?? {}, rest.join("."), value) : value;
  const copy = Array.isArray(obj) ? [...obj] : { ...(obj ?? {}) };
  if (next === undefined) delete copy[head as never];
  else copy[head as never] = next as never;
  return copy;
}
const move = <T,>(list: T[], i: number, by: -1 | 1) => {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
};

/* -------------------------------------------------------------------- fields */

export function FieldGroup({ fields, value, onChange }: { fields: Field[]; value: Json; onChange: (next: Json) => void }) {
  return (
    <>
      {fields.map((f) => (
        <FieldEditor key={f.key + f.kind} field={f} value={getAt(value, f.key)} onChange={(v) => onChange(setAt(value, f.key, v))} />
      ))}
    </>
  );
}

function Help({ text }: { text?: string }) {
  return text ? <small className="field-help">{text}</small> : null;
}

function FieldEditor({ field, value, onChange }: { field: Field; value: Json; onChange: (v: Json) => void }) {
  const ctx = useContext(FormCtx);

  switch (field.kind) {
    case "text":
    case "textarea": {
      const common = { value: value ?? "", placeholder: field.placeholder, onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange(e.target.value === "" && field.optional ? undefined : e.target.value) };
      return (
        <label className="sf-field">
          {field.label}
          {field.kind === "textarea" ? <textarea rows={field.rows ?? 3} {...common} /> : <input {...common} />}
          <Help text={field.help} />
        </label>
      );
    }
    case "number": {
      const scale = field.scale ?? 1;
      return (
        <label className="sf-field">
          {field.label}
          <input type="number" min={field.min} max={field.max} step="any" value={value === undefined ? "" : value / scale} onChange={(e) => onChange(e.target.value === "" ? (field.optional ? undefined : field.min * scale) : Math.round(Number(e.target.value) * scale))} />
          <Help text={field.help} />
        </label>
      );
    }
    case "select":
      return (
        <label className="sf-field">
          {field.label}
          <select className="select-field" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" && field.optional ? undefined : e.target.value)}>
            {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Help text={field.help} />
        </label>
      );
    case "multiselect": {
      const base = field.optionsFrom === "categories" ? ctx.categories : COLLECTIONS;
      const selected: string[] = value ?? [];
      // Anything already selected stays selectable/visible even if it's not in the known list.
      const label = (v: string) => base.find((o) => o.value === v)?.label ?? v;
      const remaining = base.filter((o) => !selected.includes(o.value));
      return (
        <div className="sf-field">
          <span>{field.label}</span>
          <div className="chip-list">
            {selected.map((v, i) => (
              <span key={v} className="chip">
                {label(v)}
                <button type="button" aria-label="Move earlier" onClick={() => onChange(move(selected, i, -1))}><ArrowUp size={12} /></button>
                <button type="button" aria-label="Move later" onClick={() => onChange(move(selected, i, 1))}><ArrowDown size={12} /></button>
                <button type="button" aria-label="Remove" onClick={() => onChange(selected.filter((x) => x !== v))}><X size={12} /></button>
              </span>
            ))}
            {selected.length === 0 && <span className="muted">None selected</span>}
          </div>
          {remaining.length > 0 && (
            <select className="select-field" value="" onChange={(e) => e.target.value && onChange([...selected, e.target.value])}>
              <option value="">Add…</option>
              {remaining.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          <Help text={field.help} />
        </div>
      );
    }
    case "image":
      return <ImageField field={field} value={value} onChange={onChange} />;
    case "link": {
      const urlKey = field.urlKey ?? "to";
      if (value === undefined) return <div className="sf-field"><span>{field.label}</span><button type="button" className="secondary" onClick={() => onChange({ label: "", [urlKey]: "/" })}><Plus size={14} /> Add</button></div>;
      return (
        <div className="sf-field">
          <span>{field.label}</span>
          <div className="sf-row">
            <input placeholder="Button text" value={value.label ?? ""} onChange={(e) => onChange({ ...value, label: e.target.value })} />
            <input placeholder={urlKey === "to" ? "/collections/new-drops" : "https://…"} value={value[urlKey] ?? ""} onChange={(e) => onChange({ ...value, [urlKey]: e.target.value })} />
            {field.optional && <button type="button" className="icon-button danger" aria-label="Remove" onClick={() => onChange(undefined)}><Trash2 size={14} /></button>}
          </div>
        </div>
      );
    }
    case "product": {
      const v = value as { slug: string; name: string } | undefined;
      return (
        <div className="sf-field">
          <span>{field.label}</span>
          <div className="sf-row">
            <input placeholder="product-slug (from the product's page address)" value={v?.slug ?? ""} onChange={(e) => onChange(e.target.value || v?.name ? { slug: e.target.value, name: v?.name ?? "" } : undefined)} />
            <input placeholder="Name shown on the photo" value={v?.name ?? ""} onChange={(e) => onChange(v?.slug || e.target.value ? { slug: v?.slug ?? "", name: e.target.value } : undefined)} />
          </div>
        </div>
      );
    }
    case "strings": {
      const items: string[] = value ?? [];
      const fixed = field.fixed;
      const list = fixed ? Array.from({ length: fixed }, (_, i) => items[i] ?? "") : items;
      return (
        <div className="sf-field">
          <span>{field.label}</span>
          {list.map((it, i) => (
            <div key={i} className="sf-row">
              <input value={it} placeholder={field.placeholder} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
              {!fixed && (
                <>
                  <button type="button" className="icon-button" aria-label="Move up" onClick={() => onChange(move(list, i, -1))}><ArrowUp size={14} /></button>
                  <button type="button" className="icon-button" aria-label="Move down" onClick={() => onChange(move(list, i, 1))}><ArrowDown size={14} /></button>
                  <button type="button" className="icon-button danger" aria-label="Remove" disabled={list.length <= (field.min ?? 0)} onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
          {!fixed && <button type="button" className="secondary" disabled={list.length >= field.max} onClick={() => onChange([...list, ""])}><Plus size={14} /> Add</button>}
        </div>
      );
    }
    case "list":
      return <ListField field={field} value={value ?? []} onChange={onChange} />;
  }
}

function ListField({ field, value, onChange }: { field: Extract<Field, { kind: "list" }>; value: Json[]; onChange: (v: Json) => void }) {
  const [open, setOpen] = useState<number | null>(value.length <= 3 ? null : null);
  return (
    <div className="sf-field">
      <span>{field.label} <em className="muted">({value.length})</em></span>
      {value.map((item, i) => (
        <div key={i} className="sf-item">
          <div className="sf-item-head">
            <button type="button" className="sf-item-title" onClick={() => setOpen(open === i ? null : i)}>
              <b>{field.itemLabel} {i + 1}</b> <span className="muted">{field.summary?.(item) ?? ""}</span>
            </button>
            <button type="button" className="icon-button" aria-label="Move up" onClick={() => { onChange(move(value, i, -1)); setOpen(null); }}><ArrowUp size={14} /></button>
            <button type="button" className="icon-button" aria-label="Move down" onClick={() => { onChange(move(value, i, 1)); setOpen(null); }}><ArrowDown size={14} /></button>
            <button type="button" className="icon-button" aria-label="Duplicate" disabled={value.length >= field.max} onClick={() => onChange([...value.slice(0, i + 1), JSON.parse(JSON.stringify({ ...item, ...(item.id ? { id: `${item.id}_copy${Math.random().toString(36).slice(2, 5)}` } : {}) })), ...value.slice(i + 1)])}><Copy size={14} /></button>
            <button type="button" className="icon-button danger" aria-label="Remove" disabled={value.length <= (field.min ?? 0)} onClick={() => { onChange(value.filter((_, j) => j !== i)); setOpen(null); }}><Trash2 size={14} /></button>
          </div>
          {open === i && (
            <div className="sf-item-body">
              <FieldGroup fields={field.fields} value={item} onChange={(next) => onChange(value.map((x, j) => (j === i ? next : x)))} />
            </div>
          )}
        </div>
      ))}
      <button type="button" className="secondary" disabled={value.length >= field.max} onClick={() => { onChange([...value, field.make()]); setOpen(value.length); }}><Plus size={14} /> Add {field.itemLabel.toLowerCase()}</button>
    </div>
  );
}

function ImageField({ field, value, onChange }: { field: Extract<Field, { kind: "image" }>; value: Json; onChange: (v: Json) => void }) {
  const [presign] = usePresignSiteImageMutation();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  if (value === undefined) {
    return <div className="sf-field"><span>{field.label}</span><button type="button" className="secondary" onClick={() => onChange({ url: "/", alt: "" })}><ImagePlus size={14} /> Add photo</button></div>;
  }

  const upload = async (file?: File) => {
    if (!file) return;
    setError(""); setProgress(0);
    try {
      const { blob, contentType } = await compressImage(file);
      const { data } = await presign({ contentType }).unwrap();
      await uploadToS3(data.uploadUrl, blob, contentType, setProgress);
      onChange({ ...value, url: data.publicUrl });
    } catch {
      setError("Upload didn't work (image storage may not be set up yet). You can paste a photo address instead.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="sf-field">
      <span>{field.label}</span>
      <div className="sf-image">
        <div className="sf-thumb">{value.url && value.url !== "/" ? <img src={resolve(value.url)} alt="" onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")} /> : <ImagePlus size={20} />}</div>
        <div className="sf-image-fields">
          <input placeholder="Photo address — /products/… or https://…" value={value.url ?? ""} onChange={(e) => onChange({ ...value, url: e.target.value })} />
          <input placeholder="Describe the photo (for screen readers and search)" value={value.alt ?? ""} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
          <div className="sf-row">
            <input placeholder='Keep in frame, e.g. 62% 55%' value={value.focal ?? ""} onChange={(e) => onChange({ ...value, focal: e.target.value || undefined })} />
            <label className="secondary sf-upload"><Upload size={14} /> {progress !== null ? `${progress}%` : "Upload"}<input type="file" accept="image/*" hidden disabled={progress !== null} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {field.optional && <button type="button" className="icon-button danger" aria-label="Remove photo" onClick={() => onChange(undefined)}><Trash2 size={14} /></button>}
          </div>
          {error && <small className="error">{error}</small>}
        </div>
      </div>
      <Help text={field.help} />
    </div>
  );
}
