"use client";

// ===============================================================
// src/app/(standalone)/admin/QuoteQuestionsTab.tsx
//
// Task U Step 2: edit the category-specific questions customers are
// asked on "Request a Quote". Questions live in the database
// (quote_questions), grouped into families; each service category
// points at one family (quote_category_families). Changes show up on
// web and in the app straight away, no app update needed.
//
// Options are typed one per line as:   English | Pidgin
// Only super_admin and admin can change anything (enforced by RLS).
// ===============================================================

import { useCallback, useEffect, useState } from "react";
import { adminSupabase, type AdminRole } from "@/lib/adminSupabase";

type Family = { id: string; code: string; name: string };
type Option = { en: string; pcm: string };
type Question = {
  id: string;
  family_id: string;
  position: number;
  question: string;
  question_pidgin: string | null;
  answer_type: "choice" | "text" | "number" | "date";
  options: Option[];
  placeholder: string | null;
  active: boolean;
};
type Category = { id: string; name: string };

function optionsToText(o: Option[]) {
  return (o || []).map((x) => (x.pcm && x.pcm !== x.en ? `${x.en} | ${x.pcm}` : x.en)).join("\n");
}
function textToOptions(t: string): Option[] {
  return t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [en, pcm] = l.split("|").map((p) => p.trim());
      return { en, pcm: pcm || en };
    });
}

const field: React.CSSProperties = {
  width: "100%", padding: "6px 8px", background: "#111", color: "#fff",
  border: "1px solid #333", borderRadius: 6, fontSize: 13, fontFamily: "inherit",
};

export default function QuoteQuestionsTab(_props: { currentRole: AdminRole }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyId, setFamilyId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [optText, setOptText] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const loadBase = useCallback(async () => {
    const [{ data: fams }, { data: cats }, { data: map }] = await Promise.all([
      adminSupabase.from("quote_question_families").select("id, code, name").order("sort_order"),
      adminSupabase.from("categories").select("id, name").eq("kind", "service").order("name"),
      adminSupabase.from("quote_category_families").select("category_id, family_id"),
    ]);
    setFamilies((fams as Family[]) || []);
    setCategories((cats as Category[]) || []);
    const m: Record<string, string> = {};
    ((map as { category_id: string; family_id: string }[]) || []).forEach((r) => { m[r.category_id] = r.family_id; });
    setMapping(m);
    if (fams && fams.length && !familyId) setFamilyId(fams[0].id);
  }, [familyId]);

  const loadQuestions = useCallback(async (fid: string) => {
    if (!fid) return;
    const { data } = await adminSupabase
      .from("quote_questions")
      .select("id, family_id, position, question, question_pidgin, answer_type, options, placeholder, active")
      .eq("family_id", fid)
      .order("position");
    const list = (data as Question[]) || [];
    setQuestions(list);
    const t: Record<string, string> = {};
    list.forEach((q) => { t[q.id] = optionsToText(q.options); });
    setOptText(t);
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadQuestions(familyId); }, [familyId, loadQuestions]);

  function patch(id: string, p: Partial<Question>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...p } : q)));
  }

  async function saveQuestion(q: Question) {
    setBusy(q.id); setMsg("");
    const { error } = await adminSupabase.from("quote_questions").update({
      position: q.position,
      question: q.question.trim(),
      question_pidgin: (q.question_pidgin || "").trim() || null,
      answer_type: q.answer_type,
      options: q.answer_type === "choice" ? textToOptions(optText[q.id] || "") : [],
      placeholder: (q.placeholder || "").trim() || null,
      active: q.active,
    }).eq("id", q.id);
    setBusy(null);
    setMsg(error ? `Could not save: ${error.message}` : "Saved.");
    if (!error) loadQuestions(familyId);
  }

  async function addQuestion() {
    setBusy("new"); setMsg("");
    const next = (questions.reduce((m, q) => Math.max(m, q.position), 0) || 0) + 1;
    const { error } = await adminSupabase.from("quote_questions").insert({
      family_id: familyId, position: next, question: "New question", answer_type: "text", options: [], active: false,
    });
    setBusy(null);
    setMsg(error ? `Could not add: ${error.message}` : "Added as hidden. Edit it, then tick Show to customers and Save.");
    if (!error) loadQuestions(familyId);
  }

  async function deleteQuestion(q: Question) {
    if (!window.confirm(`Delete "${q.question}" permanently? Old quote requests keep their saved answers.`)) return;
    setBusy(q.id);
    const { error } = await adminSupabase.from("quote_questions").delete().eq("id", q.id);
    setBusy(null);
    setMsg(error ? `Could not delete: ${error.message}` : "Deleted.");
    if (!error) loadQuestions(familyId);
  }

  async function setCategoryFamily(categoryId: string, fid: string) {
    setMsg("");
    const res = fid
      ? await adminSupabase.from("quote_category_families").upsert({ category_id: categoryId, family_id: fid })
      : await adminSupabase.from("quote_category_families").delete().eq("category_id", categoryId);
    if (res.error) { setMsg(`Could not update: ${res.error.message}`); return; }
    setMapping((m) => { const n = { ...m }; if (fid) n[categoryId] = fid; else delete n[categoryId]; return n; });
    setMsg("Category updated.");
  }

  return (
    <div>
      <h1 className="adm-section-heading">Quote Questions</h1>
      <p style={{ color: "#aaa", fontSize: 13, marginBottom: 16 }}>
        Extra questions customers see on &ldquo;Request a Quote&rdquo;, grouped by type of service. Changes go live on the website and the app immediately.
        For choice questions, type one option per line as <code>English | Pidgin</code>.
      </p>
      {msg && <p style={{ color: "#e6c200", fontSize: 13 }}>{msg}</p>}

      <label style={{ fontSize: 13, color: "#ccc" }}>Question family</label>
      <select style={{ ...field, maxWidth: 420, marginBottom: 16 }} value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
        {families.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
      </select>

      {questions.map((q) => (
        <div key={q.id} style={{ border: "1px solid #2a2a2a", borderRadius: 10, padding: 12, marginBottom: 12, background: q.active ? "#141414" : "#0e0e0e", opacity: q.active ? 1 : 0.75 }}>
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: "#999" }}>Order</label>
              <input style={field} type="number" value={q.position} onChange={(e) => patch(q.id, { position: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#999" }}>Question (English)</label>
              <input style={field} value={q.question} onChange={(e) => patch(q.id, { question: e.target.value })} />
            </div>
          </div>
          <label style={{ fontSize: 11, color: "#999" }}>Question (Pidgin)</label>
          <input style={{ ...field, marginBottom: 8 }} value={q.question_pidgin || ""} onChange={(e) => patch(q.id, { question_pidgin: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: "#999" }}>Answer type</label>
              <select style={field} value={q.answer_type} onChange={(e) => patch(q.id, { answer_type: e.target.value as Question["answer_type"] })}>
                <option value="choice">Choose one</option>
                <option value="text">Short text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
              </select>
            </div>
            {q.answer_type === "text" && (
              <div>
                <label style={{ fontSize: 11, color: "#999" }}>Example shown in the box (optional)</label>
                <input style={field} value={q.placeholder || ""} onChange={(e) => patch(q.id, { placeholder: e.target.value })} />
              </div>
            )}
          </div>
          {q.answer_type === "choice" && (
            <>
              <label style={{ fontSize: 11, color: "#999" }}>Choices (one per line: English | Pidgin)</label>
              <textarea style={{ ...field, minHeight: 90, marginBottom: 8 }} value={optText[q.id] || ""} onChange={(e) => setOptText({ ...optText, [q.id]: e.target.value })} />
            </>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, color: "#ddd" }}>
              <input type="checkbox" checked={q.active} onChange={(e) => patch(q.id, { active: e.target.checked })} /> Show to customers
            </label>
            <button className="adm-btn adm-approve-btn" disabled={busy === q.id} onClick={() => saveQuestion(q)}>{busy === q.id ? "Saving…" : "Save"}</button>
            <button className="adm-btn adm-reject-btn" disabled={busy === q.id} onClick={() => deleteQuestion(q)}>Delete</button>
          </div>
        </div>
      ))}
      <button className="adm-btn adm-approve-btn" disabled={busy === "new" || !familyId} onClick={addQuestion}>+ Add a question to this family</button>

      <h2 className="adm-section-heading" style={{ marginTop: 32, fontSize: 18 }}>Which family each service category uses</h2>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Service category</th><th>Question family</th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <select style={field} value={mapping[c.id] || ""} onChange={(e) => setCategoryFamily(c.id, e.target.value)}>
                    <option value="">None (no extra questions)</option>
                    {families.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
