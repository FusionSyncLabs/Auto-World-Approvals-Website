import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listContactMessages, setContactMessageRead, deleteContactMessage } from "@/lib/contact.functions";
import { Mail, Trash2, Check, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/messages/")({
  head: () => ({ meta: [{"title": "Messages | Auto World Approvals"}, {"name": "description", "content": "Secure Auto World Approvals messages area for authorized users."}, {"property": "og:title", "content": "Messages | Auto World Approvals"}, {"property": "og:description", "content": "Secure Auto World Approvals messages area for authorized users."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: MessagesPage,
});

function MessagesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listContactMessages);
  const readFn = useServerFn(setContactMessageRead);
  const delFn = useServerFn(deleteContactMessage);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["contact-messages"],
    queryFn: () => listFn(),
  });

  const [expanded, setExpanded] = useState<string | null>(null);

  const mark = useMutation({
    mutationFn: (v: { id: string; isRead: boolean }) => readFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-messages"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Message deleted");
      qc.invalidateQueries({ queryKey: ["contact-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unread = messages.filter((m) => !m.is_read).length;

  return (
    <AdminLayout>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contact Messages</h1>
          <p className="text-sm text-muted-foreground">
            Submissions from the website Contact form. Also emailed to admin@autoworldapprovals.com.
          </p>
        </div>
        <Badge variant={unread ? "default" : "secondary"}>{unread} unread</Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : messages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No messages yet</p>
          <p className="text-sm text-muted-foreground">New submissions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => {
            const open = expanded === m.id;
            return (
              <div
                key={m.id}
                className={`rounded-xl border bg-card transition-colors ${
                  m.is_read ? "border-border" : "border-[var(--electric)]/50 bg-[var(--electric)]/[0.02]"
                }`}
              >
                <button
                  onClick={() => {
                    setExpanded(open ? null : m.id);
                    if (!m.is_read) mark.mutate({ id: m.id, isRead: true });
                  }}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <Mail className={`h-4 w-4 shrink-0 ${m.is_read ? "text-muted-foreground" : "text-[var(--electric)]"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`truncate ${m.is_read ? "font-medium" : "font-bold"}`}>{m.name}</p>
                      <span className="text-xs text-muted-foreground">&lt;{m.email}&gt;</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{m.message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-border p-4 space-y-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button asChild size="sm" variant="default">
                        <a href={`mailto:${m.email}?subject=Re:%20Your%20message%20to%20Auto%20World%20Approvals`}>
                          Reply by email
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mark.mutate({ id: m.id, isRead: !m.is_read })}
                      >
                        <Check className="h-4 w-4" /> Mark as {m.is_read ? "unread" : "read"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("Delete this message?")) remove.mutate(m.id); }}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                      {m.ip_address && (
                        <span className="ml-auto text-xs text-muted-foreground">IP: {m.ip_address}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
