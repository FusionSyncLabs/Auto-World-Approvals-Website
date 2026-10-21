import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { listLegalDocs, LEGAL_DOC_META, LEGAL_DOC_SLUGS } from "@/lib/legal-admin.functions";
import { FileText, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/legal/")({
  head: () => ({ meta: [{"title": "Legal Documents | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals legal documents area for authorized users."}, {"property": "og:title", "content": "Legal Documents | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals legal documents area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: LegalIndex,
});

function LegalIndex() {
  const listFn = useServerFn(listLegalDocs);
  const { data = [] } = useQuery({
    queryKey: ["legal-docs-admin"],
    queryFn: () => listFn(),
  });
  const bySlug = new Map(data.map((d) => [d.slug, d]));

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Legal Documents</h1>
        <p className="text-sm text-muted-foreground">
          Edit, regenerate, or enhance any legal document with an AI prompt. Saved versions are
          published on the public site immediately.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {LEGAL_DOC_SLUGS.map((slug) => {
          const meta = LEGAL_DOC_META[slug];
          const row = bySlug.get(slug);
          return (
            <Link
              key={slug}
              to="/admin/legal/$slug"
              params={{ slug }}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-[var(--electric)]/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-[var(--electric)]/10 p-2 text-[var(--electric)]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">{meta.title}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                </div>
                {row ? (
                  <Badge variant="secondary">Custom</Badge>
                ) : (
                  <Badge variant="outline">Default</Badge>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {row?.updated_at
                    ? `Updated ${new Date(row.updated_at).toLocaleDateString()}`
                    : "Using built-in default content"}
                </span>
                <span className="inline-flex items-center gap-1 text-[var(--electric)] opacity-0 transition-opacity group-hover:opacity-100">
                  Edit <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </AdminLayout>
  );
}
