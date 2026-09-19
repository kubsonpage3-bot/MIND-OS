// @ts-nocheck
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, RefreshCw, Link2, ShieldAlert } from "lucide-react";
import { djangoFetch } from "@/api/djangoClient";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

/**
 * Calendar feed: a private iCalendar (.ics) subscription URL that Google
 * Calendar / Apple Calendar / Outlook / Thunderbird can subscribe to (events,
 * all-day events, scheduled Dailies with their repeat rule, open Todo
 * deadlines). This replaces a "Connect Google Calendar" panel that only
 * pretended to sync (a 1-second timeout and a localStorage flag).
 */
export default function CalendarSyncPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { profile } = useDjangoAuth();
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["calendar-feed"],
    queryFn: () => djangoFetch("/calendar/feed-info/"),
    enabled: !!profile,
    staleTime: Infinity,
  });

  const rotateMut = useMutation({
    mutationFn: () => djangoFetch("/calendar/feed-info/", { method: "POST" }),
    onSuccess: (fresh) => {
      queryClient.setQueryData(["calendar-feed"], fresh);
      toast({
        title: t("calendar_ui.feed_rotated", "New feed link created"),
        description: t(
          "calendar_ui.feed_rotated_desc",
          "The old link no longer works. Re-subscribe with the new one."
        ),
      });
    },
    onError: () =>
      toast({
        variant: "destructive",
        title: t("calendar_ui.feed_error", "Could not create the feed link"),
      }),
  });

  const url = data?.url || "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      inputRef.current?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rotate = () => {
    if (
      window.confirm(
        t(
          "calendar_ui.feed_rotate_confirm",
          "Create a new link? Calendars using the old link will stop updating."
        )
      )
    ) {
      rotateMut.mutate();
    }
  };

  const googleAddUrl = data?.webcal_url
    ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(data.webcal_url)}`
    : null;

  return (
    <div className="rounded-xl border border-[#2a2640] bg-[#0f0e1a] p-4 space-y-3 font-mono">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-purple-300" />
        <h3 className="text-sm font-bold text-white tracking-wide">
          {t("calendar_ui.feed_title", "Subscribe in your calendar app")}
        </h3>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {t(
          "calendar_ui.feed_desc",
          "Your events, scheduled Dailies (with their weekly repeat) and Todo deadlines, live in Google Calendar, Apple Calendar or Outlook. Read-only: edit here, it updates there."
        )}
      </p>

      {isLoading && (
        <p className="text-[11px] text-muted-foreground">
          {t("calendar_ui.loading_status", "Loading...")}
        </p>
      )}
      {isError && (
        <p className="text-[11px] text-red-400">
          {t("calendar_ui.feed_error", "Could not create the feed link")}
        </p>
      )}

      {url && (
        <>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 text-[11px] font-mono bg-[#18162e] border border-[#2f294a] rounded-md px-2.5 py-1.5 text-slate-200"
              aria-label={t("calendar_ui.feed_url", "Feed URL")}
            />
            <Button onClick={copy} size="sm" variant="outline" className="shrink-0 cursor-pointer">
              {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? t("calendar_ui.copied", "Copied") : t("calendar_ui.copy", "Copy")}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {googleAddUrl && (
              <a
                href={googleAddUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-[11px] font-bold rounded-md border border-[#372f58] bg-[#1d1a36] hover:bg-[#28234a] text-purple-200"
              >
                {t("calendar_ui.add_google", "Add to Google Calendar")}
              </a>
            )}
            {data?.webcal_url && (
              <a
                href={data.webcal_url}
                className="px-3 py-1.5 text-[11px] font-bold rounded-md border border-[#372f58] bg-[#1d1a36] hover:bg-[#28234a] text-purple-200"
              >
                {t("calendar_ui.add_apple", "Add to Apple / Outlook")}
              </a>
            )}
            <Button
              onClick={rotate}
              size="sm"
              variant="ghost"
              disabled={rotateMut.isPending}
              className="text-[11px] text-muted-foreground cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${rotateMut.isPending ? "animate-spin" : ""}`} />
              {t("calendar_ui.feed_rotate", "New link")}
            </Button>
          </div>

          <p className="text-[10px] text-amber-300/80 flex items-start gap-1.5 leading-relaxed">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
            {t(
              "calendar_ui.feed_privacy",
              "Anyone with this link can see your calendar. Don't share it; create a new link if it leaks."
            )}
          </p>
        </>
      )}
    </div>
  );
}
