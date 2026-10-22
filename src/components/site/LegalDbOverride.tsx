"use client";

import { useQuery } from "@tanstack/react-query";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";

export function LegalMarkdown({ body }: { body: string }) {
  const html = DOMPurify.sanitize(marked.parse(body, { gfm: true, breaks: false }) as string);
  return <div className="min-w-0 max-w-full" dangerouslySetInnerHTML={{ __html: html }} />;
}

interface Props {
  slug: string;
  fallback: ReactNode;
}

/**
 * Renders an admin-edited legal document from the database if one exists,
 * otherwise falls back to the bundled JSX/markdown content.
 */
export function LegalDbOverride({ slug, fallback }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["public-legal", slug],
    queryFn: async () => {
      try {
        const { data: row, error } = await supabase
          .from("legal_documents")
          .select("slug, title, body_md, effective_date, updated_at")
          .eq("slug", slug)
          .maybeSingle();
        if (error) return null;
        return row;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  if (isLoading) return <>{fallback}</>;
  if (!data || !data.body_md) return <>{fallback}</>;

  return (
    <>
      {data.effective_date && (
        <p className="mb-4 text-sm text-muted-foreground">
          Effective Date:{" "}
          {new Date(data.effective_date).toLocaleDateString("en-CA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
      <LegalMarkdown body={data.body_md} />
    </>
  );
}
