import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getLegalDoc,
  saveLegalDoc,
  deleteLegalDoc,
  rewriteLegalDoc,
  LEGAL_DOC_META,
  LEGAL_DOC_SLUGS,
  type LegalDocSlug,
} from "@/lib/legal-admin.functions";
import { LEGAL_DEFAULT_MARKDOWN } from "@/lib/legal-defaults";
import { ArrowLeft, Sparkles, Save, Trash2, ExternalLink, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/legal/$slug")({
  head: () => ({ meta: [{"title": "Edit legal document | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals edit legal document area for authorized users."}, {"property": "og:title", "content": "Edit legal document | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals edit legal document area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: LegalEdit,
});

function LegalEdit() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (!LEGAL_DOC_SLUGS.includes(slug as LegalDocSlug)) {
    return (
      <AdminLayout>
        <p>Unknown document. <Link to="/admin/legal" className="underline">Back</Link></p>
      </AdminLayout>
    );
  }
  const meta = LEGAL_DOC_META[slug as LegalDocSlug];

  const getFn = useServerFn(getLegalDoc);
  const saveFn = useServerFn(saveLegalDoc);
  const delFn = useServerFn(deleteLegalDoc);
  const aiFn = useServerFn(rewriteLegalDoc);

  const { data: row, isLoading } = useQuery({
    queryKey: ["legal-doc", slug],
    queryFn: () => getFn({ data: { slug } }),
  });

  const [title, setTitle] = useState(meta.title);
  const [body, setBody] = useState("");
  const [effective, setEffective] = useState<string>(new Date().toISOString().slice(0, 10));
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const defaultMarkdown = LEGAL_DEFAULT_MARKDOWN[slug as LegalDocSlug] ?? "";

  useEffect(() => {
    if (row) {
      setTitle(row.title || meta.title);
      setBody(row.body_md || defaultMarkdown);
      setEffective(row.effective_date || new Date().toISOString().slice(0, 10));
    } else if (row === null) {
      // No DB override yet — prefill editor with the current public default
      // so admins can see and edit what's live.
      setTitle(meta.title);
      setBody(defaultMarkdown);
    }
  }, [row, meta.title, defaultMarkdown]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { slug, title, body_md: body, effective_date: effective } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["legal-doc", slug] });
      qc.invalidateQueries({ queryKey: ["legal-docs-admin"] });
      qc.invalidateQueries({ queryKey: ["public-legal", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => delFn({ data: { slug } }),
    onSuccess: () => {
      toast.success("Reverted to default content");
      navigate({ to: "/admin/legal" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: () => aiFn({ data: { slug, title, currentBody: body, prompt } }),
    onSuccess: (res) => {
      setBody(res.markdown);
      setMode("preview");
      toast.success("AI draft ready — review then Save to publish");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/legal"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <Badge variant={row ? "secondary" : "outline"}>{row ? "Custom" : "Default"}</Badge>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <a href={meta.publicPath} target="_blank" rel="noreferrer">
            View public page <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>

      <h1 className="text-2xl font-bold">{meta.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">{meta.description}</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Editor */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="eff">Effective date</Label>
                <Input id="eff" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Document (Markdown)</Label>
                <div className="flex gap-1 rounded-md border border-border p-0.5">
                  <button
                    onClick={() => setMode("edit")}
                    className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${mode === "edit" ? "bg-[var(--electric)] text-white" : "text-muted-foreground"}`}
                  ><Pencil className="h-3 w-3" /> Edit</button>
                  <button
                    onClick={() => setMode("preview")}
                    className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${mode === "preview" ? "bg-[var(--electric)] text-white" : "text-muted-foreground"}`}
                  ><Eye className="h-3 w-3" /> Preview</button>
                </div>
              </div>
              {mode === "edit" ? (
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={28}
                  placeholder="# Title&#10;&#10;Write the document in Markdown, or use the AI panel on the right to generate a draft."
                  className="font-mono text-sm"
                />
              ) : (
                <div
                  className="prose prose-slate max-w-none rounded-md border border-border bg-background p-4 min-h-[400px] [&_h1]:font-display [&_h1]:text-2xl [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-3"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(body || "_Empty — generate or write content first._") as string) }}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <Button onClick={() => save.mutate()} disabled={save.isPending || !body.trim()} variant="hero">
                <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save & publish"}
              </Button>
              {row && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { if (confirm("Revert to built-in default content?")) remove.mutate(); }}
                >
                  <Trash2 className="h-4 w-4" /> Revert to default
                </Button>
              )}
            </div>
          </div>

          {/* AI panel */}
          <div className="rounded-xl border border-[var(--electric)]/30 bg-card p-5 space-y-4 h-fit lg:sticky lg:top-20">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-[var(--electric)]/10 p-2 text-[var(--electric)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold">AI Rewrite</p>
                <p className="text-xs text-muted-foreground">Modify, enhance, or rewrite the document.</p>
              </div>
            </div>

            <div>
              <Label htmlFor="prompt">Your instructions</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                placeholder={`Examples:\n\n• Rewrite in plainer language at a grade 9 reading level.\n• Add a section about how data is shared with third-party lenders.\n• Update for 2026 — emphasize PIPEDA + CASL compliance.\n• Generate a complete first draft for this document.`}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Uses Lovable AI (Gemini 2.5 Pro). Output replaces the document body — review before saving.
              </p>
            </div>

            <Button
              onClick={() => generate.mutate()}
              disabled={generate.isPending || prompt.trim().length < 3}
              className="w-full"
              variant="hero"
            >
              <Sparkles className="h-4 w-4" /> {generate.isPending ? "Generating…" : "Generate with AI"}
            </Button>

            <div className="rounded-md bg-soft p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Tip:</strong> the AI knows the brand facts
              (Merk Digital Ltd., BC/AB service area, no SIN collection). You don't need to repeat them.
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
