import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, Monitor, RefreshCw, Search, Smartphone, Tablet, X } from "lucide-react";
import { useAppSelector } from "./app/hooks";
import { adminBaseUrl, cleanParams, useCancelShipmentMutation, useGetOrderQuery, useGetOrderSummaryQuery, useGetOrdersQuery, useGetShipmentLabelMutation, useGetShippingConfigQuery, useLazyGetCouriersQuery, useShipOrderMutation } from "./lib/adminApi";
import type { DeviceType, OrderDetail, OrderFilters, OrderRow, OrderStatus, OrderSummary, PaymentLabel, ShipmentStatus } from "./lib/adminApi";

/* ----------------------------------------------------------------- helpers */

const inr = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
const inrExact = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
const num = (n: number) => new Intl.NumberFormat("en-IN").format(n);

// Everything is shown in India time, whatever the admin's own machine is set to.
const when = (iso: string, withTime = true) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
const istYmd = (d: Date) => new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const daysAgo = (n: number) => istYmd(new Date(Date.now() - n * 86_400_000));

const STATUS_LABEL: Record<OrderStatus, string> = { PENDING_PAYMENT: "Awaiting payment", CONFIRMED: "Confirmed", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled" };
const PAYMENT_LABEL: Record<PaymentLabel, string> = { paid: "Paid", cod: "Pay on delivery", pending: "Pending", failed: "Failed", refunded: "Refunded", refund_pending: "Refunding", unpaid: "Not paid" };
const SHIPMENT_LABEL: Record<ShipmentStatus, string> = { CREATED: "Prepared", AWB_ASSIGNED: "Courier booked", PICKUP_SCHEDULED: "Pickup scheduled", IN_TRANSIT: "In transit", OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered", RTO: "Returning to us", CANCELLED: "Cancelled" };
const errMessage = (e: unknown, fallback: string) => (e as { data?: { message?: string } })?.data?.message ?? fallback;
const DEVICE_LABEL: Record<DeviceType, string> = { mobile: "Mobile", desktop: "Desktop", tablet: "Tablet", unknown: "Unknown" };

function DeviceIcon({ type, size = 15 }: { type: DeviceType; size?: number }) {
  if (type === "mobile") return <Smartphone size={size} />;
  if (type === "tablet") return <Tablet size={size} />;
  if (type === "desktop") return <Monitor size={size} />;
  return <span style={{ width: size, display: "inline-block", textAlign: "center", color: "#b0a79b" }}>?</span>;
}

/* -------------------------------------------------------------- date range */

type Preset = "today" | "7d" | "30d" | "month" | "custom";
const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

function rangeFor(preset: Preset, custom: { from: string; to: string }) {
  const today = daysAgo(0);
  if (preset === "today") return { from: today, to: today };
  if (preset === "7d") return { from: daysAgo(6), to: today };
  if (preset === "30d") return { from: daysAgo(29), to: today };
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: custom.from || undefined, to: custom.to || undefined };
}

/* ---------------------------------------------------------------- dashboard */

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="delta flat">new</span>;
  if (value === 0) return <span className="delta flat">no change</span>;
  const up = value > 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value)}% <i>vs previous</i>
    </span>
  );
}

function Kpi({ label, value, sub, delta, onClick, tone }: { label: string; value: string; sub?: string; delta?: number | null; onClick?: () => void; tone?: "warn" | "bad" }) {
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <b className={`kpi-value ${tone ?? ""}`}>{value}</b>
      <span className="kpi-sub">{delta !== undefined ? <Delta value={delta} /> : sub}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="kpi clickable" onClick={onClick} title="Show these orders">
      {body}
    </button>
  ) : (
    <div className="kpi">{body}</div>
  );
}

function TrendChart({ trend }: { trend: OrderSummary["trend"] }) {
  const max = Math.max(1, ...trend.points.map((p) => p.revenue));
  const first = trend.points[0]?.bucket;
  const last = trend.points.at(-1)?.bucket;
  return (
    <div className="card chart-card">
      <div className="card-head">
        <b>Revenue</b>
        <span>per {trend.unit}</span>
      </div>
      <div className="bars" role="img" aria-label="Revenue per day">
        {trend.points.map((p) => (
          <div key={p.bucket} className="bar-col" title={`${when(`${p.bucket}T12:00:00+05:30`, false)} — ${inr(p.revenue)} · ${p.orders} order${p.orders === 1 ? "" : "s"}`}>
            <div className="bar" style={{ height: `${Math.max(p.revenue ? 4 : 1, (p.revenue / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="bar-axis">
        <span>{first ? when(`${first}T12:00:00+05:30`, false) : ""}</span>
        <span>{last ? when(`${last}T12:00:00+05:30`, false) : ""}</span>
      </div>
    </div>
  );
}

function Mix({ summary }: { summary: OrderSummary }) {
  const { online, cod, successfulOrders } = summary.current;
  const total = Math.max(1, online.orders + cod.orders);
  const devTotal = Math.max(1, summary.devices.reduce((n, d) => n + d.orders, 0));
  return (
    <div className="card mix-card">
      <div className="card-head">
        <b>Payment mix</b>
        <span>{num(successfulOrders)} successful</span>
      </div>
      <div className="split">
        <i style={{ width: `${(online.orders / total) * 100}%` }} className="seg online" />
        <i style={{ width: `${(cod.orders / total) * 100}%` }} className="seg cod" />
      </div>
      <div className="legend">
        <span><em className="dot online" />Online · {num(online.orders)} · {inr(online.revenue)}</span>
        <span><em className="dot cod" />COD · {num(cod.orders)} · {inr(cod.revenue)}</span>
      </div>
      <div className="card-head" style={{ marginTop: 18 }}>
        <b>Devices</b>
        <span>all orders</span>
      </div>
      <div className="device-list">
        {summary.devices.length === 0 && <span className="muted">No orders in this period</span>}
        {summary.devices.map((d) => (
          <div key={d.device} className="device-row">
            <DeviceIcon type={d.device} />
            <span>{DEVICE_LABEL[d.device]}</span>
            <div className="meter"><i style={{ width: `${(d.orders / devTotal) * 100}%` }} /></div>
            <b>{Math.round((d.orders / devTotal) * 100)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- shipping */

function ShippingSection({ order }: { order: OrderDetail }) {
  const { data: cfgData } = useGetShippingConfigQuery();
  const [ship, shipState] = useShipOrderMutation();
  const [cancel, cancelState] = useCancelShipmentMutation();
  const [getLabel, labelState] = useGetShipmentLabelMutation();
  const [loadCouriers, couriers] = useLazyGetCouriersQuery();
  const [picking, setPicking] = useState(false);
  const [courierId, setCourierId] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState("");
  const cfg = cfgData?.data;
  const sh = order.shipmentDetail;
  const busy = shipState.isLoading || cancelState.isLoading;

  const run = async (id?: number) => {
    setError(""); setNote(null);
    try {
      const r = await ship({ number: order.number, courierId: id }).unwrap();
      setNote(r.data.note);
    } catch (e) {
      setError(errMessage(e, "Couldn't create the shipment."));
    }
  };
  const openPicker = () => { setPicking(true); loadCouriers(order.number); };
  const doCancel = async () => {
    if (!window.confirm("Cancel this shipment at the courier? The order goes back to \u201cready to ship\u201d.")) return;
    setError("");
    try { await cancel(order.number).unwrap(); } catch (e) { setError(errMessage(e, "Couldn't cancel the shipment.")); }
  };
  const openLabel = async () => {
    setError("");
    try { window.open((await getLabel(order.number).unwrap()).data.url, "_blank", "noopener"); } catch (e) { setError(errMessage(e, "Couldn't get the label.")); }
  };

  const mode = !cfg ? null : cfg.mode === "off" ? "Shipping is switched off (SHIPROCKET_MODE in the admin backend's .env)." : cfg.mode === "mock" ? "Test mode — nothing real is booked." : cfg.maxStage === "pickup" ? "Live — full shipping." : `Live — held back: stops after ${cfg.maxStage === "create" ? "creating the order (no courier booked)" : "booking the courier (no pickup)"} (SHIPROCKET_MAX_STAGE=${cfg.maxStage}).`;
  const enabled = cfg && cfg.mode !== "off";
  const complete = sh?.steps.pickup;

  return (
    <section>
      <h3>Shipping</h3>
      {mode && <p className={`ship-mode ${cfg?.mode ?? ""}`}>{mode}</p>}

      {!sh && order.status === "CONFIRMED" && enabled && (
        <>
          <div className="ship-actions">
            <button type="button" className="primary" disabled={busy} onClick={() => run(courierId ?? undefined)}>{busy ? "Working…" : courierId ? "Ship with selected courier" : "Ship this order"}</button>
            {!picking && <button type="button" className="secondary" disabled={busy} onClick={openPicker}>Choose courier…</button>}
          </div>
          {picking && (
            <div className="courier-list">
              {couriers.isFetching && <span className="muted">Getting quotes…</span>}
              {couriers.isError && <span className="error">Couldn't load courier quotes — you can still ship with “auto”.</span>}
              <label className="courier-row"><input type="radio" name="courier" checked={courierId === null} onChange={() => setCourierId(null)} /><span><b>Auto</b> — {cfg?.strategy === "auto" ? "the platform's recommended courier" : `${cfg?.strategy} quote`}</span></label>
              {couriers.data?.data.options.map((c) => (
                <label key={c.id} className="courier-row">
                  <input type="radio" name="courier" checked={courierId === c.id} onChange={() => setCourierId(c.id)} />
                  <span><b>{c.name}</b>{c.rate !== null && ` · ₹${c.rate}`}{c.etaDays !== null && ` · ~${c.etaDays} day${c.etaDays === 1 ? "" : "s"}`}{c.rating ? ` · ★ ${c.rating}` : ""}</span>
                </label>
              ))}
              {couriers.data && couriers.data.data.options.length === 0 && <span className="muted">No courier quotes for this pincode.</span>}
            </div>
          )}
        </>
      )}
      {!sh && order.status !== "CONFIRMED" && <p className="muted">{order.status === "PENDING_PAYMENT" ? "Ships once the order is paid." : order.status === "CANCELLED" ? "Cancelled order — nothing to ship." : "No shipment record."}</p>}
      {!sh && order.cancelledShipments > 0 && <p className="muted">{order.cancelledShipments} earlier shipment{order.cancelledShipments === 1 ? " was" : "s were"} cancelled.</p>}

      {sh && (
        <>
          <div className="ship-steps">
            <span className={sh.steps.created ? "on" : ""}>Order created</span>
            <span className={sh.steps.courier ? "on" : ""}>Courier booked</span>
            <span className={sh.steps.pickup ? "on" : ""}>Pickup scheduled</span>
          </div>
          <p><b>{SHIPMENT_LABEL[sh.status]}</b>{sh.rawStatus ? <span className="muted"> · courier says “{sh.rawStatus}”</span> : null}</p>
          {sh.awb && (
            <p>
              {sh.courierName} · AWB <b>{sh.awb}</b>
              {sh.trackingUrl && <> · <a href={sh.trackingUrl} target="_blank" rel="noreferrer">Track</a></>}
            </p>
          )}
          {sh.etd && <p className="muted">Expected delivery {when(sh.etd, false)}</p>}
          {sh.lastError && <p className="error">Last attempt failed: {sh.lastError}</p>}
          <div className="ship-actions">
            {!complete && sh.status !== "CANCELLED" && sh.status !== "DELIVERED" && enabled && sh.status !== "IN_TRANSIT" && sh.status !== "OUT_FOR_DELIVERY" && (
              <button type="button" className="primary" disabled={busy} onClick={() => run()}>{busy ? "Working…" : "Continue shipping"}</button>
            )}
            {sh.awb && <button type="button" className="secondary" disabled={labelState.isLoading} onClick={openLabel}>{labelState.isLoading ? "…" : "Print label"}</button>}
            {sh.status !== "DELIVERED" && enabled && <button type="button" className="link-button danger" disabled={busy} onClick={doCancel}>Cancel shipment</button>}
          </div>
          {sh.events.length > 0 && (
            <ol className="timeline">
              {sh.events.map((e, i) => (
                <li key={i}><b>{e.activity || e.status}{e.location ? ` — ${e.location}` : ""}</b><span>{when(e.at)}</span></li>
              ))}
            </ol>
          )}
        </>
      )}
      {note && <p className="ship-note">{note}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

/* -------------------------------------------------------------- order detail */

function OrderDrawer({ number, onClose }: { number: string; onClose: () => void }) {
  const { data, isLoading, isError } = useGetOrderQuery(number);
  const o = data?.data;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <p className="eyebrow">ORDER</p>
            <h2>#{number}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        {isLoading && <div className="loading">Loading order…</div>}
        {isError && <p className="error">Couldn't load this order.</p>}
        {o && (
          <div className="drawer-body">
            <div className="pill-row">
              <span className={`pill s-${o.status}`}>{STATUS_LABEL[o.status]}</span>
              <span className={`pill p-${o.paymentStatus}`}>{PAYMENT_LABEL[o.paymentStatus]}</span>
              <span className="muted">{when(o.createdAt)} (IST)</span>
            </div>

            <section>
              <h3>Customer</h3>
              <p><b>{o.customerName ?? "—"}</b></p>
              <p>{o.phone} · {o.email}</p>
              <p className="muted">Customer since {when(o.customer.since, false)}</p>
            </section>

            <section>
              <h3>Delivery address</h3>
              <p>
                {o.shippingAddress.name}<br />
                {o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ""}<br />
                {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.pincode}
              </p>
              <p className="muted">{o.shippingMethod === "express" ? "Express" : "Standard"} shipping{o.giftNote ? ` · Gift note: “${o.giftNote}”` : ""}</p>
            </section>

            <section>
              <h3>Items</h3>
              <table className="mini-table">
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.sku}>
                      <td><b>{i.name}</b><br /><span className="muted">{i.optionsLabel} · {i.sku}</span></td>
                      <td className="r">{i.quantity} × {inr(i.unitPrice)}</td>
                      <td className="r"><b>{inr(i.lineTotal)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="totals">
                <div><dt>Subtotal</dt><dd>{inrExact(o.subtotal)}</dd></div>
                <div><dt>Shipping</dt><dd>{o.shippingFee ? inrExact(o.shippingFee) : "Free"}</dd></div>
                {o.codFee > 0 && <div><dt>COD fee</dt><dd>{inrExact(o.codFee)}</dd></div>}
                <div className="grand"><dt>Total</dt><dd>{inrExact(o.total)}</dd></div>
              </dl>
            </section>

            <section>
              <h3>Payment</h3>
              {o.paymentMethod === "COD" && <p>Cash on delivery — collected when the parcel arrives.</p>}
              {o.payments.map((p) => (
                <div key={p.providerOrderId} className="pay-attempt">
                  <div><b>{p.status}</b>{p.method ? ` · ${p.method}` : ""} · {inrExact(p.amount)}</div>
                  <div className="muted">{p.provider} {p.providerPaymentId ?? p.providerOrderId} · {when(p.createdAt)}</div>
                  {p.failureReason && <div className="error">{p.failureReason}</div>}
                  {p.refundedAmount > 0 && <div className="muted">Refunded {inrExact(p.refundedAmount)}</div>}
                </div>
              ))}
              {o.paymentMethod === "ONLINE" && o.payments.length === 0 && <p className="muted">No payment attempt yet.</p>}
            </section>

            <ShippingSection order={o} />

            <section>
              <h3>Placed from</h3>
              <p><DeviceIcon type={o.device.type} /> {DEVICE_LABEL[o.device.type]}{o.device.os ? ` · ${o.device.os}` : ""}{o.device.browser ? ` · ${o.device.browser}` : ""}</p>
              {o.userAgent && <p className="muted ua">{o.userAgent}</p>}
            </section>

            <section>
              <h3>Timeline</h3>
              <ol className="timeline">
                {o.timeline.map((t, i) => (
                  <li key={i}><b>{t.event}</b><span>{when(t.at)}</span></li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

type Filters = { q: string; status: string; paymentStatus: string; method: string; device: string; shipping: string; minTotal: string; maxTotal: string; sort: string };
const NO_FILTERS: Filters = { q: "", status: "", paymentStatus: "", method: "", device: "", shipping: "", minTotal: "", maxTotal: "", sort: "newest" };
const PAGE_SIZE = 20;

export function OrdersView() {
  const token = useAppSelector((s) => s.auth.accessToken);
  const [preset, setPreset] = useState<Preset>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => rangeFor(preset, custom), [preset, custom]);

  // The search box waits for a pause in typing before asking the server.
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => (f.q === search ? f : { ...f, q: search })); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const set = (patch: Partial<Filters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };
  const query: OrderFilters = {
    ...range,
    q: filters.q || undefined,
    status: filters.status || undefined,
    paymentStatus: (filters.paymentStatus || undefined) as OrderFilters["paymentStatus"],
    method: (filters.method || undefined) as OrderFilters["method"],
    device: (filters.device || undefined) as OrderFilters["device"],
    shipping: (filters.shipping || undefined) as OrderFilters["shipping"],
    minTotal: filters.minTotal ? Number(filters.minTotal) : undefined,
    maxTotal: filters.maxTotal ? Number(filters.maxTotal) : undefined,
    sort: filters.sort as OrderFilters["sort"],
  };

  const poll = { refetchOnMountOrArgChange: 20, pollingInterval: 60_000 };
  const summaryQ = useGetOrderSummaryQuery(range, poll);
  const listQ = useGetOrdersQuery({ ...query, page, limit: PAGE_SIZE }, poll);
  const summary = summaryQ.data?.data;
  const list = listQ.data?.data;
  const c = summary?.current;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${adminBaseUrl}/orders/export?${new URLSearchParams(cleanParams({ ...query, page: undefined, limit: undefined }) as Record<string, string>)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `orders-${daysAgo(0)}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Couldn't export the orders. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">SALES</p>
          <h1>Orders</h1>
        </div>
        <div className="top-actions">
          <button type="button" className="secondary icon-text" onClick={() => { summaryQ.refetch(); listQ.refetch(); }} title="Refresh">
            <RefreshCw size={15} className={summaryQ.isFetching || listQ.isFetching ? "spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      <div className="range-bar">
        <div className="segmented">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={preset === p.id ? "on" : ""} onClick={() => { setPreset(p.id); setPage(1); }}>{p.label}</button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="custom-range">
            <input type="date" value={custom.from} max={custom.to || daysAgo(0)} onChange={(e) => { setCustom((r) => ({ ...r, from: e.target.value })); setPage(1); }} aria-label="From date" />
            <span>to</span>
            <input type="date" value={custom.to} min={custom.from} max={daysAgo(0)} onChange={(e) => { setCustom((r) => ({ ...r, to: e.target.value })); setPage(1); }} aria-label="To date" />
          </div>
        )}
        {summary && <span className="muted">{when(`${summary.range.from}T12:00:00+05:30`, false)} – {when(`${summary.range.to}T12:00:00+05:30`, false)} · India time</span>}
      </div>

      <section className="kpis">
        <Kpi label="Total orders" value={c ? num(c.totalOrders) : "—"} delta={summary?.change.totalOrders} />
        <Kpi label="Revenue" value={c ? inr(c.revenue) : "—"} delta={summary?.change.revenue} />
        <Kpi label="Avg. order value" value={c ? inr(c.avgOrderValue) : "—"} delta={summary?.change.avgOrderValue} />
        <Kpi label="Successful" value={c ? `${c.successRate}%` : "—"} sub={c ? `${num(c.successfulOrders)} of ${num(c.totalOrders)} orders` : ""} />
        <Kpi label="Awaiting payment" value={c ? num(c.pendingPayment) : "—"} sub="Show these orders" tone={c && c.pendingPayment ? "warn" : undefined} onClick={() => set({ status: "PENDING_PAYMENT", paymentStatus: "" })} />
        <Kpi label="Failed payments" value={c ? num(c.failedPayments) : "—"} sub="Show these orders" tone={c && c.failedPayments ? "bad" : undefined} onClick={() => set({ paymentStatus: "failed", status: "" })} />
        <Kpi label="Ready to ship" value={summary ? num(summary.readyToShip) : "—"} sub="Paid, no courier yet · all time" tone={summary && summary.readyToShip ? "warn" : undefined} onClick={() => { setPreset("30d"); set({ shipping: "to_ship", status: "", paymentStatus: "" }); }} />
      </section>

      {summary && (
        <section className="dash-row">
          <TrendChart trend={summary.trend} />
          <Mix summary={summary} />
        </section>
      )}

      <section className="filters">
        <label className="search-box">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order #, customer, phone or email" />
        </label>
        <select value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Order status">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={filters.paymentStatus} onChange={(e) => set({ paymentStatus: e.target.value })} aria-label="Payment status">
          <option value="">Any payment</option>
          <option value="paid">Paid (success)</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="cod">Pay on delivery</option>
          <option value="refunded">Refunded</option>
          <option value="unpaid">Cancelled unpaid</option>
        </select>
        <select value={filters.method} onChange={(e) => set({ method: e.target.value })} aria-label="Payment method">
          <option value="">Online + COD</option>
          <option value="online">Online</option>
          <option value="cod">COD</option>
        </select>
        <select value={filters.device} onChange={(e) => set({ device: e.target.value })} aria-label="Device">
          <option value="">Any device</option>
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
          <option value="tablet">Tablet</option>
          <option value="unknown">Unknown</option>
        </select>
        <select value={filters.shipping} onChange={(e) => set({ shipping: e.target.value })} aria-label="Shipping">
          <option value="">Any shipping</option>
          <option value="to_ship">Ready to ship</option>
          <option value="booked">Courier booked</option>
          <option value="in_transit">In transit</option>
          <option value="delivered">Delivered</option>
        </select>
        <div className="amount-range">
          <input type="number" min="0" placeholder="Min ₹" value={filters.minTotal} onChange={(e) => set({ minTotal: e.target.value })} aria-label="Minimum total" />
          <span>–</span>
          <input type="number" min="0" placeholder="Max ₹" value={filters.maxTotal} onChange={(e) => set({ maxTotal: e.target.value })} aria-label="Maximum total" />
        </div>
        <select value={filters.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total_desc">Highest total</option>
          <option value="total_asc">Lowest total</option>
        </select>
        {filtersActive && <button type="button" className="link-button" onClick={() => { setFilters(NO_FILTERS); setSearch(""); setPage(1); }}>Clear filters</button>}
        <button type="button" className="secondary icon-text push" onClick={exportCsv} disabled={exporting || !list?.total}>
          <Download size={15} /> {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </section>

      {listQ.isError ? (
        <div className="empty"><h3>Couldn't load orders.</h3><p>Check the connection and press Refresh.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="product-table orders-table">
            <thead>
              <tr><th>Order</th><th>Placed</th><th>Customer</th><th>Items</th><th className="r">Total</th><th>Payment</th><th>Status</th><th>Device</th><th>Ship to</th></tr>
            </thead>
            <tbody>
              {(list?.items ?? []).map((o: OrderRow) => (
                <tr key={o.number} className="row-link" onClick={() => setOpen(o.number)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(o.number)}>
                  <td><b>#{o.number}</b></td>
                  <td className="nowrap">{when(o.createdAt)}</td>
                  <td><b>{o.customerName ?? "—"}</b><div className="muted">{o.phone}</div></td>
                  <td>{o.firstItem}{o.moreItems > 0 && <span className="muted"> +{o.moreItems} more</span>}<div className="muted">{o.itemsCount} item{o.itemsCount === 1 ? "" : "s"}</div></td>
                  <td className="r"><b>{inr(o.total)}</b></td>
                  <td><span className={`pill p-${o.paymentStatus}`}>{PAYMENT_LABEL[o.paymentStatus]}</span><div className="muted">{o.paymentMethod === "COD" ? "COD" : "Online"}</div></td>
                  <td>
                    <span className={`pill s-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    <div className="muted">{o.shipment ? `${SHIPMENT_LABEL[o.shipment.status]}${o.shipment.courierName ? ` · ${o.shipment.courierName}` : ""}` : o.status === "CONFIRMED" ? "Ready to ship" : ""}</div>
                  </td>
                  <td className="nowrap"><span className="device"><DeviceIcon type={o.device.type} /> {DEVICE_LABEL[o.device.type]}</span><div className="muted">{[o.device.os, o.device.browser].filter(Boolean).join(" · ") || ""}</div></td>
                  <td>{o.city ?? "—"}<div className="muted">{o.state}</div></td>
                </tr>
              ))}
              {listQ.isLoading && <tr><td colSpan={9} className="loading">Loading orders…</td></tr>}
              {!listQ.isLoading && list?.items.length === 0 && (
                <tr><td colSpan={9} className="loading">No orders match these filters{filtersActive ? "." : " in this period."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {list && list.total > 0 && (
        <footer className="pager">
          <span className="muted">Showing {(list.page - 1) * list.limit + 1}–{Math.min(list.page * list.limit, list.total)} of {num(list.total)}</span>
          <div>
            <button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span className="muted">Page {list.page} of {list.pages}</span>
            <button type="button" className="secondary" disabled={page >= list.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </footer>
      )}

      {open && <OrderDrawer number={open} onClose={() => setOpen(null)} />}
    </>
  );
}
