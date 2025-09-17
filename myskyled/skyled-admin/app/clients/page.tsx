"use client";
import { useEffect, useMemo, useState } from "react";
// Sort utility available to the whole module (createdAt desc)
function sortByCreatedAtDesc<T extends { createdAt?: any }>(arr: T[]): T[] {
  return arr.sort((a, b) => {
    const as = a.createdAt?.seconds ?? 0;
    const bs = b.createdAt?.seconds ?? 0;
    return bs - as;
  });
}
// Helper to embed logo as Data URL for about:blank rendering
async function getLogoDataUrl(preferred?: string): Promise<string | null> {
  const candidates = [
    preferred || "",
    process.env.NEXT_PUBLIC_LOGO_PATH || "",
    "/Users/daimaximila/myskyled/skyled-admin/app/clients/logo-skyled.png",
    "/logo-skyled.png",
    "/logo.png",
    "/skyled-logo.png",
  ].filter(Boolean as any);

  for (const p of candidates) {
    try {
      const res = await fetch(p);
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result));
        r.readAsDataURL(blob);
      });
      return dataUrl;
    } catch (_) {}
  }
  return null;
}
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import {
  ref as sref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { useRouter } from "next/navigation";
import TableShell from "@/components/TableShell";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  limit,
  getDocs,
  updateDoc,
  doc,
  runTransaction,
  deleteDoc,
} from "firebase/firestore";

// Gera número de invoice sequencial diário: INV-YYYYMMDD-####
async function getNextInvoiceNumber(): Promise<string> {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const d = new Date();
  const key = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const ctrRef = doc(db, "counters", "invoices");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ctrRef);
    const data = snap.exists() ? (snap.data() as any) : {};
    const byDay = data.byDay || {};
    const cur = Number(byDay[key] || 0) + 1;
    byDay[key] = cur;
    tx.set(ctrRef, { byDay }, { merge: true });
    return cur as number;
  });
  return `INV-${key}-${String(seq).padStart(4, "0")}`;
}

// Apaga estimate: subcoleção, HTML do Storage e documento raiz
async function deleteEstimateDeep(estId: string) {
  try {
    const lines = await getDocs(
      collection(doc(db, "estimates", estId), "estimateLines")
    );
    await Promise.all(lines.docs.map((d) => deleteDoc(d.ref)));
  } catch {}
  try {
    await deleteObject(sref(storage, `estimates/${estId}.html`));
  } catch {}
  await deleteDoc(doc(db, "estimates", estId));
}

interface ClientRow {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string; // <-- address field
  createdAt?: Timestamp;
}

interface EstimateItem {
  name: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

interface ClientNote {
  id: string;
  clientId: string;
  note: string;
  createdAt?: Timestamp;
  createdByUid?: string;
  createdByEmail?: string | null;
}

export default function ClientsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // modal + form state (novo cliente)
  const [openClient, setOpenClient] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [submittingClient, setSubmittingClient] = useState(false);
  const [errorClient, setErrorClient] = useState<string | null>(null);

  // orçamento modal
  const [openQuote, setOpenQuote] = useState(false);
  const [quoteClient, setQuoteClient] = useState<ClientRow | null>(null);
  const [qTitle, setQTitle] = useState("SKYLED Estimate");
  const [qNotes, setQNotes] = useState(
    "This estimate is valid for 7 days. Payment terms to be agreed."
  );
  const [qCurrency, setQCurrency] = useState<"USD" | "BRL">("USD");
  const [qTaxPct, setQTaxPct] = useState<number>(0);
  const [qDiscountPct, setQDiscountPct] = useState<number>(0);
  const [qItems, setQItems] = useState<EstimateItem[]>([
    { name: "Installation Service", qty: 1, unit: "unit", unitPrice: 0 },
  ]);
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [errorQuote, setErrorQuote] = useState<string | null>(null);
  const [showDiscountLine, setShowDiscountLine] = useState(true);
  const [showUnitPrices, setShowUnitPrices] = useState(true);

  const [rows, setRows] = useState<ClientRow[]>([]);
  const [openClientDetail, setOpenClientDetail] = useState(false);
  const [detailClient, setDetailClient] = useState<ClientRow | null>(null);
  const [clientEstimates, setClientEstimates] = useState<any[]>([]);

  // --- Client Notes state ---
  const [clientNotesList, setClientNotesList] = useState<ClientNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [openInvoice, setOpenInvoice] = useState(false);
  const [serviceDate, setServiceDate] = useState("");

  useEffect(() => {
    let off: (() => void) | null = null;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setLoading(false);
        router.push("/auth/login");
        return;
      }
      setUser(u);
      const qCol = query(
        collection(db, "clients"),
        orderBy("createdAt", "desc")
      );
      off = onSnapshot(qCol, (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      });
      setLoading(false);
    });
    return () => {
      off?.();
      unsub();
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // ---- Novo Cliente ----
  const resetClientForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setErrorClient(null);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorClient(null);
    if (!name.trim()) {
      setErrorClient("Informe o nome do cliente.");
      return;
    }
    setSubmittingClient(true);
    try {
      await addDoc(collection(db, "clients"), {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        createdAt: serverTimestamp(),
        createdByUid: user?.uid,
      });
      resetClientForm();
      setOpenClient(false);
    } catch (err: any) {
      console.error(err);
      setErrorClient(err?.message || "Erro ao salvar cliente.");
    } finally {
      setSubmittingClient(false);
    }
  };

  // ---- Orçamento (Estimate) ----
  const totals = useMemo(() => {
    const items = qItems.reduce(
      (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
      0
    );
    const discount = (items * (Number(qDiscountPct) || 0)) / 100;
    const base = Math.max(items - discount, 0);
    const taxes = (base * (Number(qTaxPct) || 0)) / 100;
    const grand = base + taxes;
    return { items, discount, taxes, grand };
  }, [qItems, qTaxPct, qDiscountPct]);

  const addItem = () =>
    setQItems((prev) => [
      ...prev,
      { name: "", qty: 1, unit: "unit", unitPrice: 0 },
    ]);
  const removeItem = (idx: number) =>
    setQItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<EstimateItem>) =>
    setQItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );

  const openQuoteFor = (client: ClientRow) => {
    setQuoteClient(client);
    setOpenQuote(true);
  };

  const openClientDetailFor = async (client: ClientRow) => {
    setDetailClient(client);
    // Load latest 10 estimates for this client
    const qEst = query(
      collection(db, "estimates"),
      where("clientId", "==", client.id),
      limit(20)
    );
    const snap = await getDocs(qEst);
    const list = sortByCreatedAtDesc(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    );
    setClientEstimates(list);
    // Load notes for this client (no orderBy to avoid composite index; sort locally)
    const qNotes = query(
      collection(db, "clientNotes"),
      where("clientId", "==", client.id),
      limit(50)
    );
    const snapNotes = await getDocs(qNotes);
    const notes = sortByCreatedAtDesc(
      snapNotes.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as ClientNote[]
    );
    setClientNotesList(notes);
    setNewNoteText("");
    setNotesError(null);
    setOpenClientDetail(true);
  };

  const handleAddNote = async () => {
    if (!detailClient) return;
    const text = newNoteText.trim();
    if (!text) return;
    setSavingNote(true);
    setNotesError(null);
    try {
      const ref = await addDoc(collection(db, "clientNotes"), {
        clientId: detailClient.id,
        note: text,
        createdAt: serverTimestamp(),
        createdByUid: user?.uid,
        createdByEmail: user?.email ?? null,
      });
      // optimistic add (createdAt will be undefined until server writes back)
      setClientNotesList((prev) => [
        {
          id: ref.id,
          clientId: detailClient.id,
          note: text,
          createdByUid: user?.uid,
          createdByEmail: user?.email ?? null,
        },
        ...prev,
      ]);
      setNewNoteText("");
    } catch (err: any) {
      console.error(err);
      setNotesError(err?.message || "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  };

  // Handle declining an estimate with optimistic UI update and rollback on failure
  const handleDeclineEstimate = async (estId: string) => {
    // Optimistic remove from UI
    setClientEstimates((prev) => prev.filter((x) => x.id !== estId));
    try {
      await deleteEstimateDeep(estId);
    } catch (err: any) {
      console.error("Failed to delete estimate:", err);
      alert(
        "You do not have permission to delete this estimate, or it no longer exists."
      );
      // rollback
      await openClientDetailFor(detailClient!);
    }
  };

  const formatMoney = (v: number) =>
    v.toLocaleString(undefined, { style: "currency", currency: qCurrency });

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorQuote(null);
    if (!quoteClient) {
      setErrorQuote("Cliente inválido.");
      return;
    }
    if (
      !qItems.length ||
      qItems.some((it) => !it.name.trim() || (Number(it.qty) || 0) <= 0)
    ) {
      setErrorQuote(
        "Preencha ao menos um item válido (nome e quantidade > 0)."
      );
      return;
    }
    setSubmittingQuote(true);
    try {
      // 1) salvar estimate
      const estRef = await addDoc(collection(db, "estimates"), {
        clientId: quoteClient.id,
        status: "enviada",
        title: qTitle.trim() || "Orçamento SKYLED",
        notes: qNotes.trim() || undefined,
        currency: qCurrency,
        taxesPct: Number(qTaxPct) || 0,
        discountPct: Number(qDiscountPct) || 0,
        totals: {
          items: totals.items,
          taxes: totals.taxes,
          grand: totals.grand,
        },
        createdAt: serverTimestamp(),
        createdByUid: user?.uid,
      });
      // 2) salvar linhas
      const estLinesCol = collection(estRef, "estimateLines");
      for (const it of qItems) {
        await addDoc(estLinesCol, {
          kind: "item",
          name: it.name.trim(),
          qty: Number(it.qty) || 0,
          unit: it.unit || "un",
          unitPrice: Number(it.unitPrice) || 0,
          subtotal: (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
        });
      }
      // 3) abrir janela imprimível (PDF via print)
      const logoData =
        (await getLogoDataUrl(
          "/Users/daimaximila/myskyled/skyled-admin/app/clients/logo-skyled.png"
        )) || "";
      const html = renderEstimateHTML({
        logo: logoData,
        company: process.env.NEXT_PUBLIC_COMPANY_NAME || "SKYLED",
        client: quoteClient,
        title: qTitle,
        currency: qCurrency,
        items: qItems,
        taxesPct: Number(qTaxPct) || 0,
        discountPct: Number(qDiscountPct) || 0,
        totals,
        notes: qNotes,
        showUnitPrices,
        showDiscountLine,
      });
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 300);
      }
      // fecha modal e libera botão imediatamente; upload ocorrerá em background
      setOpenQuote(false);
      setSubmittingQuote(false);

      (async () => {
        try {
          const fileRef = sref(storage, `estimates/${estRef.id}.html`);
          await uploadString(fileRef, html, "raw", {
            contentType: "text/html; charset=utf-8",
          } as any);
          const url = await getDownloadURL(fileRef);
          await updateDoc(estRef, { htmlUrl: url });
        } catch (e) {
          console.warn("Estimate HTML upload failed (non-blocking)", e);
        }
      })();

      return;
    } catch (err: any) {
      console.error(err);
      setErrorQuote(err?.message || "Erro ao gerar orçamento.");
    } finally {
      setSubmittingQuote(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Clients</h1>
      <p className="text-sm opacity-70">Welcome, {user?.email}</p>
      <div className="flex gap-2">
        <button className="btn" onClick={handleLogout}>
          Logout
        </button>
        <button className="btn" onClick={() => setOpenClient(true)}>
          Add Client
        </button>
      </div>

      <TableShell headers={["Name", "Phone", "Email", "Actions"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="py-4 opacity-70">
              No clients registered.
            </td>
          </tr>
        )}
        {rows.map((c) => (
          <tr key={c.id}>
            <td>
              <button className="link" onClick={() => openClientDetailFor(c)}>
                {c.name}
              </button>
            </td>
            <td>{c.phone || "-"}</td>
            <td>{c.email || "-"}</td>
            <td>
              <button className="btn" onClick={() => openQuoteFor(c)}>
                Generate Estimate
              </button>
            </td>
          </tr>
        ))}
      </TableShell>

      {/* Modal: New Client */}
      {openClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-md p-4 bg-[#0f1020] border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">New Client</h2>
              <button className="btn" onClick={() => setOpenClient(false)}>
                Close
              </button>
            </div>
            <form className="space-y-3" onSubmit={handleCreateClient}>
              <label className="block">
                <span className="text-sm opacity-80">Name*</span>
                <input
                  className="input mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Company X"
                />
              </label>
              <label className="block">
                <span className="text-sm opacity-80">Phone</span>
                <input
                  className="input mt-1"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(407) 000-0000"
                />
              </label>
              <label className="block">
                <span className="text-sm opacity-80">E-mail</span>
                <input
                  className="input mt-1"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                />
              </label>
              <label className="block">
                <span className="text-sm opacity-80">Address</span>
                <input
                  className="input mt-1"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, State, ZIP"
                />
              </label>
              {errorClient && (
                <p className="text-red-400 text-sm">
                  {errorClient === "Informe o nome do cliente."
                    ? "Please enter client name."
                    : errorClient}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  className="btn"
                  type="button"
                  onClick={() => setOpenClient(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn"
                  type="submit"
                  disabled={submittingClient}
                >
                  {submittingClient ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Generate Estimate */}
      {openQuote && quoteClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-3xl rounded-md p-4 bg-[#0f1020] border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">
                Generate Estimate — {quoteClient.name}
              </h2>
              <button className="btn" onClick={() => setOpenQuote(false)}>
                Close
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleCreateQuote}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-white"
                      checked={showUnitPrices}
                      onChange={(e) => setShowUnitPrices(e.target.checked)}
                    />
                    Show unit prices on PDF
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-white"
                      checked={showDiscountLine}
                      onChange={(e) => setShowDiscountLine(e.target.checked)}
                    />
                    Show discount line on PDF
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm opacity-80">Title</span>
                  <input
                    className="input mt-1"
                    value={qTitle}
                    onChange={(e) => setQTitle(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-sm opacity-80">Currency</span>
                  <select
                    className="input mt-1"
                    value={qCurrency}
                    onChange={(e) => setQCurrency(e.target.value as any)}
                  >
                    <option value="USD">USD</option>
                    <option value="BRL">BRL</option>
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm opacity-80">Items</span>
                  <button type="button" className="btn" onClick={addItem}>
                    Add item
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="table text-sm">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th style={{ width: 90 }}>Qty</th>
                        <th style={{ width: 120 }}>Unit</th>
                        {showUnitPrices && (
                          <th style={{ width: 160 }}>Unit Price</th>
                        )}
                        <th style={{ width: 80 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {qItems.map((it, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              className="input"
                              value={it.name}
                              onChange={(e) =>
                                updateItem(idx, { name: e.target.value })
                              }
                              placeholder="e.g., LED Panel P3.9"
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              inputMode="decimal"
                              value={it.qty}
                              onChange={(e) =>
                                updateItem(idx, { qty: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="input"
                              value={it.unit}
                              onChange={(e) =>
                                updateItem(idx, { unit: e.target.value })
                              }
                              placeholder="unit"
                            />
                          </td>
                          {showUnitPrices && (
                            <td>
                              <input
                                className="input"
                                inputMode="decimal"
                                value={it.unitPrice}
                                onChange={(e) =>
                                  updateItem(idx, {
                                    unitPrice: Number(e.target.value),
                                  })
                                }
                              />
                            </td>
                          )}
                          <td>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => removeItem(idx)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm opacity-80">Taxes (%)</span>
                  <input
                    className="input mt-1"
                    inputMode="decimal"
                    value={qTaxPct}
                    onChange={(e) => setQTaxPct(Number(e.target.value))}
                  />
                </label>
                <label className="block">
                  <span className="text-sm opacity-80">Discount (%)</span>
                  <input
                    className="input mt-1"
                    inputMode="decimal"
                    value={qDiscountPct}
                    onChange={(e) => setQDiscountPct(Number(e.target.value))}
                  />
                </label>
                <div className="card">
                  <div className="text-sm">
                    Subtotal: {formatMoney(totals.items)}
                  </div>
                  <div className="text-sm">
                    Discount: {formatMoney(totals.discount)}
                  </div>
                  <div className="text-sm">
                    Taxes: {formatMoney(totals.taxes)}
                  </div>
                  <div className="text-base font-semibold mt-1">
                    Total: {formatMoney(totals.grand)}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="text-sm opacity-80">Notes</span>
                <textarea
                  className="input mt-1"
                  value={qNotes}
                  onChange={(e) => setQNotes(e.target.value)}
                  rows={3}
                />
              </label>

              {errorQuote && (
                <p className="text-red-400 text-sm">{errorQuote}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpenQuote(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn"
                  type="submit"
                  disabled={submittingQuote}
                >
                  {submittingQuote ? "Generating..." : "Save & Generate PDF"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Client Detail Modal */}
      {openClientDetail && detailClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50">
          <div className="flex flex-col w-full h-full bg-[#0f1020] border-t border-white/10">
            {/* Top bar */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <button
                  className="btn"
                  onClick={() => setOpenClientDetail(false)}
                >
                  Back
                </button>
                <h2 className="text-lg font-semibold">{detailClient.name}</h2>
              </div>
              <button
                className="btn"
                onClick={() => setOpenClientDetail(false)}
              >
                Close
              </button>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-auto">
              {/* Notes column */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm opacity-80">Notes</h3>
                <div className="card p-0">
                  <textarea
                    className="input w-full h-28 rounded-none"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Write a note about this client..."
                  />
                  <div className="flex items-center justify-between p-3 border-t border-white/10">
                    <div className="text-xs opacity-70">
                      Notes are shared among users.
                    </div>
                    <div className="flex gap-2">
                      {notesError && (
                        <span className="text-red-400 text-xs">
                          {notesError}
                        </span>
                      )}
                      <button
                        className="btn"
                        onClick={handleAddNote}
                        disabled={savingNote || !newNoteText.trim()}
                      >
                        {savingNote ? "Saving..." : "Add note"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
                  {clientNotesList.length === 0 && (
                    <div className="text-sm opacity-60">No notes yet.</div>
                  )}
                  {clientNotesList.map((n) => (
                    <div key={n.id} className="card text-sm">
                      <div>{n.note}</div>
                      <div className="text-xs opacity-60 mt-1">
                        {n.createdByEmail ? n.createdByEmail + " • " : ""}
                        {n.createdAt?.toDate
                          ? n.createdAt.toDate().toLocaleString()
                          : "just now"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estimates column */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm opacity-80">Estimates</h3>
                <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                  {clientEstimates.length === 0 && (
                    <div className="text-sm opacity-60">No estimates yet.</div>
                  )}
                  {clientEstimates.map((e) => (
                    <div
                      key={e.id}
                      className="card flex items-center justify-between"
                    >
                      <div className="text-sm">
                        <div className="font-medium">
                          {e.title || "Estimate"}
                        </div>
                        <div className="opacity-70">
                          Status: {e.status || "sent"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn"
                          onClick={async () => {
                            if (e.htmlUrl) {
                              window.open(e.htmlUrl as string, "_blank");
                              return;
                            }
                            try {
                              // fallback: rebuild estimate preview from stored lines
                              const linesSnap = await getDocs(
                                collection(
                                  doc(db, "estimates", e.id),
                                  "estimateLines"
                                )
                              );
                              const items = linesSnap.docs.map((d) => {
                                const it = d.data() as any;
                                return {
                                  name: it.name ?? "",
                                  qty: Number(it.qty ?? 0),
                                  unit: it.unit ?? "unit",
                                  unitPrice: Number(it.unitPrice ?? 0),
                                };
                              });
                              const itemsTotal = items.reduce(
                                (s, it) =>
                                  s +
                                  Number(it.qty || 0) *
                                    Number(it.unitPrice || 0),
                                0
                              );
                              const discountPct = Number(e.discountPct ?? 0);
                              const taxesPct = Number(e.taxesPct ?? 0);
                              const discount = (itemsTotal * discountPct) / 100;
                              const base = Math.max(itemsTotal - discount, 0);
                              const taxes = (base * taxesPct) / 100;
                              const grand = base + taxes;
                              const logoData = (await getLogoDataUrl()) || "";
                              const html = renderEstimateHTML({
                                logo: logoData,
                                company:
                                  process.env.NEXT_PUBLIC_COMPANY_NAME ||
                                  "SKYLED",
                                client: detailClient!,
                                title: e.title || "SKYLED Estimate",
                                currency:
                                  (e.currency as "USD" | "BRL") || "USD",
                                items,
                                taxesPct,
                                discountPct,
                                totals: {
                                  items: itemsTotal,
                                  discount,
                                  taxes,
                                  grand,
                                },
                                notes: e.notes || "",
                                showUnitPrices: true,
                                showDiscountLine: true,
                              });
                              const w = window.open("", "_blank");
                              if (w) {
                                w.document.write(html);
                                w.document.close();
                                w.focus();
                                setTimeout(() => w.print(), 300);
                              }
                            } catch (err) {
                              console.error(err);
                              alert("Could not open estimate preview.");
                            }
                          }}
                        >
                          Open
                        </button>
                        <button
                          className="btn"
                          onClick={async () => {
                            await updateDoc(doc(db, "estimates", e.id), {
                              status: "approved",
                            });
                            openClientDetailFor(detailClient);
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="btn"
                          onClick={() => handleDeclineEstimate(e.id)}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {clientEstimates.some((e) => e.status === "approved") && (
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn"
                      onClick={() => setOpenInvoice(true)}
                    >
                      Generate Invoice
                    </button>
                    <button
                      className="btn"
                      onClick={() => handleGenerateContract(detailClient)}
                    >
                      Generate Contract
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {openInvoice && detailClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-xl rounded-md p-4 bg-[#0f1020] border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">
                Generate Invoice — {detailClient.name}
              </h2>
              <button className="btn" onClick={() => setOpenInvoice(false)}>
                Close
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm opacity-80">Service date</span>
                <input
                  className="input mt-1"
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                />
              </label>
              <div className="text-xs opacity-70">
                (Photos upload can be added here and stored under{" "}
                <code>/invoices/{"{invoiceId}"}/photos</code> in Firebase
                Storage.)
              </div>
              <div className="flex gap-2">
                <button
                  className="btn"
                  onClick={async () => {
                    // 1) Último estimate aprovado do cliente
                    const qEst = query(
                      collection(db, "estimates"),
                      where("clientId", "==", detailClient.id),
                      where("status", "==", "approved"),
                      limit(20)
                    );
                    const snap = await getDocs(qEst);
                    if (snap.empty) {
                      alert("No approved estimate found.");
                      return;
                    }
                    const list = sortByCreatedAtDesc(
                      snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
                    );
                    const est = list[0];
                    const invoiceNumber = await getNextInvoiceNumber();

                    let html = "";
                    // 2) Tenta reaproveitar HTML salvo no Storage
                    if (est.htmlUrl) {
                      try {
                        const res = await fetch(est.htmlUrl as string);
                        if (res.ok) html = await res.text();
                      } catch (e) {
                        console.warn(
                          "Failed to fetch htmlUrl, will rebuild",
                          e
                        );
                      }
                    }

                    if (html) {
                      // Ajusta visualmente para Invoice e adiciona data de serviço
                      html = html.replace(/SKYLED Estimate/g, "SKYLED Invoice");
                      if (serviceDate) {
                        html = html.replace(
                          "</table>",
                          '</table>\n<p style="margin-top:12px">Service date: ' +
                            serviceDate +
                            "</p>"
                        );
                      }
                    } else {
                      // 3) Sem HTML salvo: reconstruir a partir das linhas
                      const linesSnap = await getDocs(
                        collection(
                          doc(db, "estimates", est.id),
                          "estimateLines"
                        )
                      );
                      const items = linesSnap.docs.map((d) => {
                        const it = d.data() as any;
                        return {
                          name: it.name ?? "",
                          qty: Number(it.qty ?? 0),
                          unit: it.unit ?? "unit",
                          unitPrice: Number(it.unitPrice ?? 0),
                        };
                      });

                      // Recalcular totais
                      const itemsTotal = items.reduce(
                        (s, it) =>
                          s + Number(it.qty || 0) * Number(it.unitPrice || 0),
                        0
                      );
                      const discountPct = Number(est.discountPct ?? 0);
                      const taxesPct = Number(est.taxesPct ?? 0);
                      const discount = (itemsTotal * discountPct) / 100;
                      const base = Math.max(itemsTotal - discount, 0);
                      const taxes = (base * taxesPct) / 100;
                      const grand = base + taxes;

                      const logoData = (await getLogoDataUrl()) || "";
                      html = renderEstimateHTML({
                        logo: logoData,
                        company:
                          process.env.NEXT_PUBLIC_COMPANY_NAME || "SKYLED",
                        client: detailClient,
                        title: "SKYLED Invoice",
                        currency: (est.currency as "USD" | "BRL") || "USD",
                        items,
                        taxesPct,
                        discountPct,
                        totals: { items: itemsTotal, discount, taxes, grand },
                        notes: `Service date: ${serviceDate || "TBD"}`,
                        showUnitPrices: true,
                        showDiscountLine: true,
                      });
                    }

                    try {
                      const invRef = await addDoc(collection(db, "invoices"), {
                        clientId: detailClient.id,
                        estimateId: est.id,
                        invoiceNumber,
                        serviceDate: serviceDate || null,
                        createdAt: serverTimestamp(),
                        createdByUid: user?.uid,
                      });
                      try {
                        const fileRef = sref(
                          storage,
                          `invoices/${invRef.id}.html`
                        );
                        await uploadString(fileRef, html, "raw", {
                          contentType: "text/html; charset=utf-8",
                        } as any);
                        const url = await getDownloadURL(fileRef);
                        await updateDoc(invRef, { htmlUrl: url });
                      } catch (e) {
                        console.warn("invoice html upload failed", e);
                      }
                      // adiciona número ao título exibido no PDF
                      html = html.replace(
                        /<h1>([^<]+)<\/h1>/,
                        `<h1>$1 — ${invoiceNumber}</h1>`
                      );
                    } catch (e) {
                      console.warn("failed to save invoice", e);
                    }

                    const w = window.open("", "_blank");
                    if (w) {
                      w.document.write(html);
                      w.document.close();
                      w.focus();
                      setTimeout(() => w.print(), 300);
                    }
                    setOpenInvoice(false);
                  }}
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function handleGenerateContract(client: ClientRow) {
  const logoData = (await getLogoDataUrl()) || "";
  const title = "Service Agreement";
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
  <style>body{font-family:ui-sans-serif,system-ui;-apple-system,Segoe UI,Roboto,Helvetica,Arial;padding:24px;color:#111} h1{margin:0 0 8px} .muted{color:#555;font-size:12px}</style></head>
  <body>
    ${
      logoData
        ? `<div style="text-align:right"><img src="${logoData}" style="max-height:96px"/></div>`
        : ``
    }
    <h1>${title}</h1>
    <div class="muted">Provider: SKYLED</div>
    <div class="muted">Client: ${escapeHtml(client.name)}${
    client.email ? ` (${escapeHtml(client.email)})` : ``
  }</div>
    ${
      client.address
        ? `<div class="muted">Address: ${escapeHtml(client.address)}</div>`
        : ``
    }
    <p style="margin-top:16px">This contract covers scope of work, materials, dates, and terms. Fill in specifics below.</p>
    <ol>
      <li>Scope of services and deliverables.</li>
      <li>Materials list and ownership.</li>
      <li>Project timeline and service dates.</li>
      <li>Payment schedule and terms.</li>
      <li>Warranty and support.</li>
      <li>Signatures.</li>
    </ol>
  </body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }
}

function renderEstimateHTML(params: {
  logo: string;
  company: string;
  client: ClientRow;
  title: string;
  currency: "USD" | "BRL";
  items: EstimateItem[];
  taxesPct: number;
  discountPct: number;
  totals: { items: number; discount: number; taxes: number; grand: number };
  notes?: string;
  showUnitPrices: boolean;
  showDiscountLine: boolean;
}) {
  const fmt = (v: number | null | undefined) =>
    Number(v ?? 0).toLocaleString(undefined, {
      style: "currency",
      currency: params.currency,
    });
  const rows = params.items
    .map((it) => {
      const subtotal = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
      return `
    <tr>
      <td>${escapeHtml(it.name)}</td>
      <td style="text-align:right">${it.qty}</td>
      <td>${escapeHtml(it.unit)}</td>
      ${
        params.showUnitPrices
          ? `<td style=\"text-align:right\">${fmt(it.unitPrice)}</td>`
          : ""
      }
      <td style="text-align:right">${fmt(subtotal)}</td>
    </tr>
  `;
    })
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8"/>
      <title>${escapeHtml(params.title)}</title>
      <style>
        body{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding:24px; color:#111 }
        h1{ margin:0 0 8px }
        .muted{ color:#555; font-size:12px }
        table{ width:100%; border-collapse: collapse; margin-top:12px }
        th,td{ border-bottom:1px solid #ddd; padding:8px }
        th{ text-align:left; background:#f6f6f6 }
        .right{ text-align:right }
        .totals{ margin-top:16px; float:right }
        .header{ display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px }
        .header .logo{ max-height:128px; margin-left:16px }
        .header .brand h1{ margin:0 0 6px }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          <h1>${escapeHtml(params.title)}</h1>
          <div class="muted">${escapeHtml(params.company)}</div>
          <div class="muted">Client: ${escapeHtml(params.client.name)}${
    params.client.email ? " (" + escapeHtml(params.client.email) + ")" : ""
  }</div>
          ${
            params.client.address
              ? `<div class="muted">Address: ${escapeHtml(
                  params.client.address
                )}</div>`
              : ""
          }
        </div>
        ${
          params.logo
            ? `<img src="${params.logo}" alt="Company Logo" class="logo"/>`
            : ""
        }
      </div>

      <table>
       <thead>
  <tr>
    <th>Description</th><th class="right">Qty</th><th>Unit</th>${
      params.showUnitPrices ? `<th class=\"right\">Unit Price</th>` : ""
    }<th class="right">Subtotal</th>
  </tr>
</thead>
        <tbody>
          ${rows || '<tr><td colspan="5">No items</td></tr>'}
        </tbody>
      </table>

      ${
        params.notes
          ? `<p style="margin-top:48px">${escapeHtml(params.notes)}</p>`
          : ""
      }

      <div class="totals" style="text-align:right; margin-top:24px; float:none">
        <div>Subtotal: <strong>${fmt(params.totals.items)}</strong></div>
        ${
          params.showDiscountLine
            ? `<div>Discount (${params.discountPct}%): <strong>-${fmt(
                params.totals.discount
              )}</strong></div>`
            : ""
        }
        <div>Taxes (${params.taxesPct}%): <strong>${fmt(
    params.totals.taxes
  )}</strong></div>
        <div>Total: <strong>${fmt(params.totals.grand)}</strong></div>
      </div>
    </body>
  </html>`;
}

function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
