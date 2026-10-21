import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getBlogPost,
  saveBlogPost,
  deleteBlogPost,
  BLOG_CATEGORY_OPTIONS,
} from "@/lib/blog.functions";
import { enqueueJob } from "@/lib/jobs.functions";
import { useMyJobs } from "@/hooks/use-jobs";
import { ArrowLeft, Loader2, Save, Sparkles, ImageIcon, Trash2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/blog/$id")({
  head: () => ({ meta: [{"title": "Edit article | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals edit article area for authorized users."}, {"property": "og:title", "content": "Edit article | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals edit article area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: BlogEditor,
});

type Draft = {
  title: string;
  slug: string;
  excerpt: string;
  body_md: string;
  category: string;
  tags: string;
  cover_image_url: string;
  cover_alt: string;
  seo_title: string;
  seo_description: string;
  status: "draft" | "published";
};

function BlogEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const getFn = useServerFn(getBlogPost);
  const saveFn = useServerFn(saveBlogPost);
  const delFn = useServerFn(deleteBlogPost);
  const enqueue = useServerFn(enqueueJob);

  const { jobs } = useMyJobs({ limit: 15, notify: true });
  const running = jobs.some(
    (j) => j.kind.startsWith("blog_") && (j.status === "queued" || j.status === "running"),
  );
  const doneCount = jobs.filter((j) => j.kind.startsWith("blog_") && j.status === "succeeded").length;

  const post = useQuery({ queryKey: ["admin-blog-post", id], queryFn: () => getFn({ data: { id } }) });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [direction, setDirection] = useState("");
  const [imageDirection, setImageDirection] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = post.data as Record<string, unknown> | null | undefined;
    if (!p) return;
    setDraft({
      title: (p.title as string) ?? "",
      slug: (p.slug as string) ?? "",
      excerpt: (p.excerpt as string) ?? "",
      body_md: (p.body_md as string) ?? "",
      category: (p.category as string) ?? "",
      tags: ((p.tags as string[]) ?? []).join(", "),
      cover_image_url: (p.cover_image_url as string) ?? "",
      cover_alt: (p.cover_alt as string) ?? "",
      seo_title: (p.seo_title as string) ?? "",
      seo_description: (p.seo_description as string) ?? "",
      status: ((p.status as string) === "published" ? "published" : "draft") as Draft["status"],
    });
  }, [post.data]);

  // Pull fresh content when a regeneration job finishes.
  useEffect(() => {
    if (doneCount) post.refetch().then(() => setDraft(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveFn({
        data: {
          id,
          title: draft.title,
          slug: draft.slug,
          excerpt: draft.excerpt || null,
          body_md: draft.body_md,
          category: draft.category || null,
          tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10),
          cover_image_url: draft.cover_image_url || null,
          cover_alt: draft.cover_alt || null,
          seo_title: draft.seo_title || null,
          seo_description: draft.seo_description || null,
          status: draft.status,
        },
      });
      toast.success("Saved");
      post.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async (kind: "blog_rewrite" | "blog_image") => {
    try {
      await enqueue({
        data: {
          kind,
          label: kind === "blog_image" ? `Blog cover: ${draft?.title ?? ""}`.slice(0, 60) : `Blog rewrite: ${draft?.title ?? ""}`.slice(0, 60),
          input: {
            id,
            direction: (kind === "blog_image" ? imageDirection : direction).trim() || undefined,
          },
        },
      });
      toast.success("Regeneration started — this page updates when it's done.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    }
  };

  if (!draft) {
    return (
      <AdminLayout>
        <p className="text-sm text-muted-foreground">Loading article…</p>
      </AdminLayout>
    );
  }

  const previewHtml = DOMPurify.sanitize(marked.parse(draft.body_md, { gfm: true }) as string);

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All articles
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {running && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> AI working…
            </span>
          )}
          <Badge variant={draft.status === "published" ? "default" : "outline"}>
            {draft.status === "published" ? "Published" : "Draft"}
          </Badge>
          {draft.status === "published" && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/blog/${draft.slug}`} target="_blank" rel="noreferrer">
                View <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Title</Label>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">URL slug</Label>
                <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    {BLOG_CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Excerpt</Label>
                <Textarea rows={2} value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Tags (comma separated)</Label>
                <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <Tabs defaultValue="write">
              <TabsList>
                <TabsTrigger value="write">Write</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="write">
                <Textarea
                  rows={26}
                  className="font-mono text-xs"
                  value={draft.body_md}
                  onChange={(e) => setDraft({ ...draft, body_md: e.target.value })}
                />
              </TabsContent>
              <TabsContent value="preview">
                <div
                  className="prose prose-slate max-w-none text-sm [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-2 font-bold">SEO</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">SEO title ({draft.seo_title.length}/60)</Label>
                <Input value={draft.seo_title} onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Meta description ({draft.seo_description.length}/155)</Label>
                <Input value={draft.seo_description} onChange={(e) => setDraft({ ...draft, seo_description: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 font-bold">Cover photo</h3>
            {draft.cover_image_url ? (
              <img src={draft.cover_image_url} alt={draft.cover_alt} className="mb-3 w-full rounded-lg object-cover" />
            ) : (
              <div className="mb-3 flex h-36 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                No cover yet
              </div>
            )}
            <Label className="text-xs">Alt text</Label>
            <Input
              className="mb-3"
              value={draft.cover_alt}
              onChange={(e) => setDraft({ ...draft, cover_alt: e.target.value })}
            />
            <Label className="text-xs">Direction for a new photo (optional)</Label>
            <Textarea
              rows={2}
              value={imageDirection}
              onChange={(e) => setImageDirection(e.target.value)}
              placeholder="e.g. winter highway in the Rockies, dusk, family SUV"
            />
            <Button className="mt-2 w-full" variant="outline" onClick={() => regenerate("blog_image")} disabled={running}>
              <ImageIcon className="mr-2 h-4 w-4" /> Regenerate photo
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 font-bold">Rewrite with AI</h3>
            <Textarea
              rows={4}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="Optional direction: make it shorter, add a section on GST/PST, target first-time buyers…"
            />
            <Button className="mt-2 w-full" onClick={() => regenerate("blog_rewrite")} disabled={running}>
              <Sparkles className="mr-2 h-4 w-4" /> Rewrite article
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">Unsaved edits are replaced when the rewrite finishes.</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 font-bold">Status</h3>
            <Select
              value={draft.status}
              onValueChange={(v) => setDraft({ ...draft, status: v as Draft["status"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              className="mt-3 w-full text-destructive"
              onClick={async () => {
                if (!confirm("Delete this article?")) return;
                await delFn({ data: { id } });
                toast.success("Deleted");
                navigate({ to: "/admin/blog" });
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete article
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
