"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useSocket } from "../hooks/useSocket";
import {
    Monitor, MonitorOff, Pencil, StepBack, StepForward, Cast,
    Play, FolderPlus, RefreshCw, Settings, Zap, FilePlus, FolderOpen, LogOut, ChevronRight, Globe, Radio, Clock, Video, SkipForward, Megaphone
} from "lucide-react";
import { useRouter } from "next/navigation";
import { BundleMeta, BundleSlideEntry } from "../interfaces/BundleMeta";
import { TransitionConfig } from "../lib/transitions";
import { isSlideScheduledNow } from "../lib/schedule";
import BundleSettingsPanel from "../components/BundleSettingsPanel";
import GlobalSlidePickerModal from "../components/GlobalSlidePickerModal";
import UserManager from "../components/UserManager";
import AdminContextMenu from "../components/AdminContextMenu";
import StreamsPanel from "../components/StreamsPanel";
import FileManagerDialog from "../components/FileManagerDialog";
import AnnouncementDialog from "../components/AnnouncementDialog";
import StudioMonitor from "../components/StudioMonitor";
import LivePanel from "../components/LivePanel";
import SlideInspector, { SlideScheduleDraft } from "../components/SlideInspector";
import SettingsDrawer, { DrawerTab } from "../components/SettingsDrawer";
import DisplayConfigPanel from "../components/DisplayConfigPanel";

interface BundleInfo {
    name: string;
    slides: string[];
}

type SettingsTab = "bundle" | "displays" | "streams" | "users";

interface PendingTake {
    bundle: string;
    slide: string;
}

const LIVE_VIEW_STORAGE_KEY = "admin.liveViewVisible";

const readLiveViewPreference = () => {
    try {
        return localStorage.getItem(LIVE_VIEW_STORAGE_KEY) !== "0";
    } catch {
        return true;
    }
};

const writeLiveViewPreference = (visible: boolean) => {
    try {
        localStorage.setItem(LIVE_VIEW_STORAGE_KEY, visible ? "1" : "0");
    } catch {
        // Storage can be unavailable (private mode); the toggle still works for this session.
    }
};

// Keyboard shortcuts must not fire while the user is typing or has a control focused.
const isTypingTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement && !!target.closest("input, textarea, select, button, [contenteditable='true']");

const EMPTY_SCHEDULE_DRAFT: SlideScheduleDraft = { mode: "range", start: "", end: "", dailyStart: "", dailyEnd: "" };

const DEFAULT_DURATION = 10;

const normalizeSlideFile = (value: string) => (value.endsWith(".json") ? value : `${value}.json`);

// Website slide URLs are used directly as an iframe src. Without a scheme, the
// browser resolves them relative to infoscreen's own origin and the iframe
// silently fails to load the intended site — so default a missing scheme to https.
const normalizeWebsiteUrl = (value: string) => {
    const trimmed = value.trim();
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

function isoToLocalInputValue(iso?: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputValueToIso(value: string): string | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
}

export default function AdminDashboard() {
    const defer = (fn: () => void) => queueMicrotask(fn);
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);
    const [dialog, setDialog] = useState<{ type: 'prompt' | 'confirm', text: string, defaultVal?: string, resolve: (val: any) => void } | null>(null);

    const askPrompt = (text: string, defaultVal = "") => {
        return new Promise<string | null>((resolve) => {
            setDialog({ type: "prompt", text, defaultVal, resolve: (val) => { setDialog(null); resolve(val); } });
        });
    };

    const askConfirm = (text: string) => {
        return new Promise<boolean>((resolve) => {
            setDialog({ type: "confirm", text, resolve: (val) => { setDialog(null); resolve(val); } });
        });
    };
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const { connected, state, showSlide, clearSlide, stopCycle, queueNextSlide, updateBundleMeta, activateBundle, updateDisplayConfig, bundleMetaUpdate, showStream, clearStream, showAnnouncement, showAnnouncementAll, clearAnnouncementAll, socketRef } = useSocket("admin");
    const [bundles, setBundles] = useState<BundleInfo[]>([]);
    const [selectedDisplay, setSelectedDisplay] = useState<string | null>(null);

    const [adminContextMenu, setAdminContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        items: { label: string; onClick: () => void; danger?: boolean }[];
    }>({ visible: false, x: 0, y: 0, items: [] });


    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch("/api/auth");
                const data = await response.json();
                if (!data.authenticated || data.role !== "admin") {
                    router.replace("/");
                    return;
                }
                setCurrentUser(data.username ?? null);
                setAuthChecked(true);
            } catch {
                router.replace("/");
            }
        };

        checkAuth();
        const handlePageShow = () => {
            checkAuth();
        };

        window.addEventListener("pageshow", handlePageShow);
        return () => {
            window.removeEventListener("pageshow", handlePageShow);
        };
    }, [router]);

    const handleLogout = useCallback(async () => {
        await fetch("/api/auth", { method: "DELETE" });
        router.replace("/");
    }, [router]);

    const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
    const [selectedSlide, setSelectedSlide] = useState<string | null>(null);
    const [previewJson, setPreviewJson] = useState<object | null>(null);
    const [liveJson, setLiveJson] = useState<object | null>(null);
    const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
    const [liveViewVisible, setLiveViewVisible] = useState(true);
    const [liveSwapped, setLiveSwapped] = useState(false);
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [pendingTake, setPendingTake] = useState<PendingTake | null>(null);
    const [bundleMeta, setBundleMeta] = useState<BundleMeta>({});
    const [liveBundleMeta, setLiveBundleMeta] = useState<BundleMeta>({});
    const [metaDraft, setMetaDraft] = useState<BundleMeta>({});
    const [slideDurationDraft, setSlideDurationDraft] = useState<string>("");
    const [slideTransitionDraft, setSlideTransitionDraft] = useState<TransitionConfig | null>(null);
    const [slideScheduleDraft, setSlideScheduleDraft] = useState<SlideScheduleDraft>(EMPTY_SCHEDULE_DRAFT);
    const [dragSlide, setDragSlide] = useState<string | null>(null);
    const [dragOverSlide, setDragOverSlide] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [confirmActivateBundle, setConfirmActivateBundle] = useState<string | null>(null);
    const [displayActiveStreams, setDisplayActiveStreams] = useState<Record<string, string>>({});
    const [globalSlidePickerOpen, setGlobalSlidePickerOpen] = useState(false);
    // null = closed; "new" = adding a new video slide; a slide id = replacing that slide's video
    const [videoSlidePicker, setVideoSlidePicker] = useState<string | null>(null);
    const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
    const bundleMetaRef = useRef<BundleMeta>({});
    const liveLoadSeqRef = useRef(0);

    useEffect(() => {
        bundleMetaRef.current = bundleMeta;
    }, [bundleMeta]);

    const effectiveSelectedDisplay = useMemo(() => {
        if (selectedDisplay && state.displayConfigs.some((conf) => conf.id === selectedDisplay)) {
            return selectedDisplay;
        }
        return state.displayConfigs[0]?.id ?? null;
    }, [selectedDisplay, state.displayConfigs]);

    // localStorage is only readable after mount; reading it during render would break hydration.
    useEffect(() => {
        defer(() => setLiveViewVisible(readLiveViewPreference()));
    }, []);

    const toggleLiveView = useCallback(() => {
        setLiveViewVisible((visible) => {
            writeLiveViewPreference(!visible);
            return !visible;
        });
        setLiveSwapped(false);
    }, []);

    const selectedDisplayState = useMemo(
        () => effectiveSelectedDisplay ? state.displayStates?.[effectiveSelectedDisplay] ?? null : null,
        [effectiveSelectedDisplay, state.displayStates]
    );

    const selectedDisplayAnnouncement = useMemo(
        () => effectiveSelectedDisplay ? state.displayAnnouncements?.[effectiveSelectedDisplay] ?? null : null,
        [effectiveSelectedDisplay, state.displayAnnouncements]
    );

    const hasActiveAnnouncement = useMemo(
        () => Object.values(state.displayAnnouncements ?? {}).some(Boolean),
        [state.displayAnnouncements]
    );

    const selectedDisplayConfig = useMemo(
        () => effectiveSelectedDisplay ? state.displayConfigs.find((conf) => conf.id === effectiveSelectedDisplay) ?? null : null,
        [effectiveSelectedDisplay, state.displayConfigs]
    );

    const slides = useMemo(
        () => bundles.find((b) => b.name === selectedBundle)?.slides ?? [],
        [bundles, selectedBundle]
    );
    const selectedDisplayBundle = selectedDisplayState?.bundle ?? selectedBundle;
    const activeBundleSlides = useMemo(
        () => bundles.find((b) => b.name === selectedDisplayBundle)?.slides ?? [],
        [bundles, selectedDisplayBundle]
    );
    const orderedEntries: BundleSlideEntry[] = useMemo(() => (
        bundleMeta.slides ?? []
    ), [bundleMeta.slides]);
    const entryBySlide = useMemo(() => (
        new Map(orderedEntries.map((entry) => [entry.id, entry]))
    ), [orderedEntries]);
    const isEntryEligible = (entry: BundleSlideEntry | undefined) =>
        !entry || (entry.active !== false && isSlideScheduledNow(entry.schedule, new Date()));
    // Slide ids eligible to cycle in (active + within schedule) — used for prev/next navigation
    // so it skips disabled/out-of-schedule slides instead of stepping onto them.
    const eligibleSlides = useMemo(
        () => slides.filter((id) => isEntryEligible(entryBySlide.get(id))),
        [slides, entryBySlide]
    );
    const liveEntryBySlide = useMemo(() => (
        new Map((liveBundleMeta.slides ?? []).map((entry) => [entry.id, entry]))
    ), [liveBundleMeta.slides]);
    const eligibleActiveBundleSlides = useMemo(
        () => activeBundleSlides.filter((id) => isEntryEligible(liveEntryBySlide.get(id))),
        [activeBundleSlides, liveEntryBySlide]
    );
    const selectedEntry = useMemo(() => {
        if (!selectedSlide) return undefined;
        return orderedEntries.find((entry) => entry.id === selectedSlide);
    }, [orderedEntries, selectedSlide]);
    const savedSlideDurationDraft = useMemo(() => (
        typeof selectedEntry?.duration === "number" ? String(selectedEntry.duration) : ""
    ), [selectedEntry]);
    const isSlideDurationDirty = selectedSlide !== null && slideDurationDraft !== savedSlideDurationDraft;
    const savedSlideTransitionDraft = useMemo(() => (
        selectedEntry?.transition ?? null
    ), [selectedEntry]);
    const isSlideTransitionDirty = selectedSlide !== null && (
        (slideTransitionDraft?.type ?? null) !== (savedSlideTransitionDraft?.type ?? null) ||
        (slideTransitionDraft?.duration ?? null) !== (savedSlideTransitionDraft?.duration ?? null)
    );
    const savedSlideScheduleDraft = useMemo(() => {
        const sch = selectedEntry?.schedule;
        if (sch?.mode === "daily") {
            return { mode: "daily" as const, start: "", end: "", dailyStart: sch.dailyStart, dailyEnd: sch.dailyEnd };
        }
        return { mode: "range" as const, start: isoToLocalInputValue(sch?.start), end: isoToLocalInputValue(sch?.end), dailyStart: "", dailyEnd: "" };
    }, [selectedEntry]);
    const isSlideScheduleDirty = selectedSlide !== null &&
        JSON.stringify(slideScheduleDraft) !== JSON.stringify(savedSlideScheduleDraft);

    useEffect(() => {
        defer(() => {
            setSlideDurationDraft(selectedSlide ? savedSlideDurationDraft : "");
            setSlideTransitionDraft(selectedSlide ? savedSlideTransitionDraft : null);
            setSlideScheduleDraft(selectedSlide ? savedSlideScheduleDraft : EMPTY_SCHEDULE_DRAFT);
        });
    }, [selectedSlide, savedSlideDurationDraft, savedSlideTransitionDraft, savedSlideScheduleDraft]);

    const loadBundles = useCallback(async () => {
        const names: string[] = await fetch("/api/bundles").then((r) => r.json()).catch(() => []);
        const data: BundleInfo[] = await Promise.all(
            names.map(async (name) => {
                const s = await fetch(`/api/bundles/${encodeURIComponent(name)}/slides`)
                    .then((r) => r.json()).catch(() => []);
                return { name, slides: Array.isArray(s) ? s : [] };
            })
        );
        setBundles(data);
        if (data.length > 0 && !selectedBundle) setSelectedBundle(data[0].name);
    }, [selectedBundle]);


    useEffect(() => {
        defer(() => { void loadBundles(); });
    }, [loadBundles]);

    // Load bundle metadata when selected bundle changes
    useEffect(() => {
        if (!selectedBundle) {
            defer(() => {
                setBundleMeta({});
                setMetaDraft({});
            });
            return;
        }
        fetch(`/api/bundles/${encodeURIComponent(selectedBundle)}`)
            .then((r) => r.json())
            .then((m) => { setBundleMeta(m ?? {}); setMetaDraft(m ?? {}); })
            .catch(() => { setBundleMeta({}); setMetaDraft({}); });
    }, [selectedBundle]);

    const refreshSelectedBundleMeta = useCallback(async () => {
        if (!selectedBundle) return;
        const fresh: BundleMeta | null = await fetch(`/api/bundles/${encodeURIComponent(selectedBundle)}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
        if (!fresh) return;
        const previous = bundleMetaRef.current;
        bundleMetaRef.current = fresh;
        setBundleMeta(fresh);
        // Only follow the server when the settings draft has no unsaved edits.
        setMetaDraft((draft) => (JSON.stringify(draft) === JSON.stringify(previous) ? fresh : draft));
    }, [selectedBundle]);

    // Bundles and slides may be changed by other admins or in the editor;
    // the server announces it so this view stays current without a reload.
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;
        let debounceTimer: ReturnType<typeof setTimeout> | undefined;
        const onContentChanged = () => {
            // Some actions (e.g. copying a bundle) fire many changes in a row.
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                void loadBundles();
                void refreshSelectedBundleMeta();
            }, 250);
        };
        socket.on("content:changed", onContentChanged);
        return () => {
            clearTimeout(debounceTimer);
            socket.off("content:changed", onContentChanged);
        };
    }, [connected, socketRef, loadBundles, refreshSelectedBundleMeta]);

    const saveMeta = useCallback(async (patch: Partial<BundleMeta>) => {
        if (!selectedBundle) return;
        const updated = { ...bundleMetaRef.current, ...patch };
        // strip undefined keys
        (Object.keys(updated) as (keyof BundleMeta)[]).forEach((k) => {
            if (updated[k] === undefined) delete updated[k];
        });
        bundleMetaRef.current = updated;
        setBundleMeta(updated);
        setMetaDraft(updated);
        await fetch(`/api/bundles/${encodeURIComponent(selectedBundle)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
        });
        updateBundleMeta(selectedBundle, updated);
    }, [selectedBundle, updateBundleMeta]);

    // Every state:sync delivers a fresh display state object, so the live view is keyed
    // on its values — otherwise each server broadcast would refetch the same slide.
    const liveBundle = selectedDisplayState?.bundle ?? null;
    const liveSlide = selectedDisplayState?.slide ?? null;
    const liveSocketJson = selectedDisplayState?.json;
    const liveSocketMeta = selectedDisplayState?.bundleMeta;

    // Fetch live JSON + live bundle metadata whenever the active broadcast slide changes
    useEffect(() => {
        if (!liveBundle || !liveSlide) {
            defer(() => {
                setLiveJson(null);
                setLiveBundleMeta({});
            });
            return;
        }

        const hasSocketJson = liveSocketJson != null;
        const hasSocketMeta = liveSocketMeta != null;

        if (hasSocketJson || hasSocketMeta) {
            defer(() => {
                if (hasSocketMeta) {
                    setLiveBundleMeta(liveSocketMeta as BundleMeta);
                }
                if (hasSocketJson) {
                    setLiveJson(liveSocketJson as object | null);
                }
            });
            if (hasSocketJson && hasSocketMeta) {
                return;
            }
        }

        const seq = ++liveLoadSeqRef.current;
        const metaPromise = hasSocketMeta
            ? Promise.resolve(liveSocketMeta as BundleMeta)
            : fetch(`/api/bundles/${encodeURIComponent(liveBundle)}`)
                .then((r) => r.json()).catch(() => ({}));

        metaPromise.then((meta) => {
            if (liveLoadSeqRef.current !== seq) return;
            const resolvedMeta = (meta ?? {}) as BundleMeta;
            setLiveBundleMeta(resolvedMeta);

            if (hasSocketJson) {
                setLiveJson(liveSocketJson as object | null);
                return;
            }
            // Website/video slides have no fabric JSON on disk — fetching it always 400s.
            const entryType = resolvedMeta.slides?.find((s) => s.id === liveSlide)?.type;
            if (entryType && entryType !== "fabric") {
                setLiveJson(null);
                return;
            }
            fetch(`/api/bundles/${encodeURIComponent(liveBundle)}/slides/${encodeURIComponent(liveSlide)}`)
                .then((r) => r.json()).catch(() => null)
                .then((json) => {
                    if (liveLoadSeqRef.current !== seq) return;
                    setLiveJson(json);
                });
        });
    }, [liveBundle, liveSlide, liveSocketJson, liveSocketMeta]);

    // Apply live meta updates only to the current live bundle view
    useEffect(() => {
        if (!bundleMetaUpdate) return;
        const active = selectedDisplayState;
        if (!active || active.bundle !== bundleMetaUpdate.bundle) return;
        defer(() => setLiveBundleMeta(bundleMetaUpdate.meta as BundleMeta));
    }, [bundleMetaUpdate, selectedDisplayState]);

    // Load slide JSON for preview whenever selection changes
    useEffect(() => {
        if (!selectedBundle || !selectedSlide) {
            defer(() => {
                setPreviewJson(null);
                setLoadingPreview(false);
            });
            return;
        }
        // Website/video slides have no fabric JSON on disk — fetching it always 400s.
        if (selectedEntry && selectedEntry.type !== "fabric") {
            defer(() => {
                setPreviewJson(null);
                setLoadingPreview(false);
            });
            return;
        }
        defer(() => setLoadingPreview(true));
        fetch(`/api/bundles/${encodeURIComponent(selectedBundle)}/slides/${encodeURIComponent(selectedSlide)}`)
            .then((r) => r.json())
            .then((j) => setPreviewJson(j))
            .catch(() => setPreviewJson(null))
            .finally(() => setLoadingPreview(false));
    }, [selectedBundle, selectedSlide, selectedEntry]);

    // The bundle's default duration is the base the server cycles with; reuse
    // metadata already loaded for the preview or live bundle before fetching.
    const resolveBaseDuration = useCallback(async (bundle: string) => {
        const knownMeta = bundle === selectedBundle ? bundleMeta
            : bundle === selectedDisplayState?.bundle ? liveBundleMeta
                : null;
        const meta: BundleMeta = knownMeta ?? await fetch(`/api/bundles/${encodeURIComponent(bundle)}`)
            .then((r) => r.json())
            .catch(() => ({}));
        const duration = meta.defaultDuration;
        return typeof duration === "number" && Number.isFinite(duration) ? duration : DEFAULT_DURATION;
    }, [selectedBundle, bundleMeta, selectedDisplayState?.bundle, liveBundleMeta]);

    // Puts a slide on the selected display; the server keeps cycling its bundle from there.
    const pushSlideToDisplay = useCallback(async (bundle: string, slideId: string) => {
        if (!effectiveSelectedDisplay) return;
        const duration = await resolveBaseDuration(bundle);
        showSlide(effectiveSelectedDisplay, { bundle, slide: slideId, duration });
    }, [effectiveSelectedDisplay, resolveBaseDuration, showSlide]);

    // Remembers what was last on air so "Resume cycle" can bring it back after a blackout.
    const [lastLive, setLastLive] = useState<(PendingTake & { display: string }) | null>(null);
    useEffect(() => {
        if (!selectedDisplayState || !effectiveSelectedDisplay) return;
        const { bundle, slide } = selectedDisplayState;
        defer(() => setLastLive({ display: effectiveSelectedDisplay, bundle, slide }));
    }, [selectedDisplayState, effectiveSelectedDisplay]);
    const resumeTarget: PendingTake | null = selectedDisplayState
        ?? (lastLive?.display === effectiveSelectedDisplay ? lastLive : null);

    const handleTake = useCallback(() => {
        if (!selectedBundle || !selectedSlide || !connected) return;
        const liveBundle = selectedDisplayState?.bundle;
        if (liveBundle && liveBundle !== selectedBundle) {
            setPendingTake({ bundle: selectedBundle, slide: selectedSlide });
            return;
        }
        void pushSlideToDisplay(selectedBundle, selectedSlide);
    }, [connected, pushSlideToDisplay, selectedBundle, selectedDisplayState?.bundle, selectedSlide]);

    const confirmPendingTake = () => {
        if (pendingTake) void pushSlideToDisplay(pendingTake.bundle, pendingTake.slide);
        setPendingTake(null);
    };

    const selectedDisplayIsCycling = effectiveSelectedDisplay ? state.displayCycling?.[effectiveSelectedDisplay] ?? false : false;

    const handleToggleLiveCycle = () => {
        if (!effectiveSelectedDisplay) return;
        if (selectedDisplayIsCycling) {
            stopCycle(effectiveSelectedDisplay);
            return;
        }
        // Re-showing a slide restarts the server's cycle from that slide.
        if (resumeTarget) void pushSlideToDisplay(resumeTarget.bundle, resumeTarget.slide);
    };

    const handleClearSlide = async () => {
        if (!effectiveSelectedDisplay) return;
        if (!await askConfirm(`Blackout ${selectedDisplayConfig?.name ?? "the selected display"}?`)) return;
        clearSlide(effectiveSelectedDisplay);
    };

    const handleNewBundle = async () => {
        const name = (await askPrompt("New bundle name:"))?.trim().replace(/[^a-zA-Z0-9_\- ]/g, "-");
        if (!name) return;
        await fetch("/api/bundles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        await loadBundles();
        setSelectedBundle(name);
    };

    const handleDeleteBundle = async (name: string) => {
        if (!await askConfirm(`Are you sure you want to delete bundle '${name}'? This cannot be undone.`)) return;
        await fetch(`/api/bundles/${encodeURIComponent(name)}`, { method: "DELETE" });
        if (selectedBundle === name) {
            setSelectedBundle(null);
            setSelectedSlide(null);
        }
        await loadBundles();
    };

    const handleDuplicateBundle = async (name: string) => {
        const newName = (await askPrompt("Duplicate bundle as:", `${name}-copy`))?.trim().replace(/[^a-zA-Z0-9_\- ]/g, "-");
        if (!newName) return;

        await fetch("/api/bundles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName }),
        });

        // copy slides over via the duplicates api locally (read bundle then recreate for each)
        // Actually, it's easier to duplicate slides one by one
        const slideMeta = await fetch(`/api/bundles/${encodeURIComponent(name)}/slides`).then(r => r.json());
        if (Array.isArray(slideMeta)) {
            for (const slide of slideMeta) {
                const res = await fetch(`/api/bundles/${encodeURIComponent(name)}/slides/${encodeURIComponent(slide)}`);
                if (res.ok) {
                    const body = await res.text();
                    await fetch(`/api/bundles/${encodeURIComponent(newName)}/slides/${encodeURIComponent(slide)}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body,
                    });
                }
            }
        }
        // copy bundle.json metadata as well
        const metaRes = await fetch(`/api/bundles/${encodeURIComponent(name)}`);
        if (metaRes.ok) {
            const metaBody = await metaRes.json();
            await fetch(`/api/bundles/${encodeURIComponent(newName)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(metaBody),
            });
        }

        await loadBundles();
        setSelectedBundle(newName);
    };

    const handleRenameBundle = async (name: string) => {
        const newName = (await askPrompt("Rename bundle to:", name))?.trim().replace(/[^a-zA-Z0-9_\- ]/g, "-");
        if (!newName || newName === name) return;

        const res = await fetch(`/api/bundles/${encodeURIComponent(name)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "rename", newName }),
        });

        if (res.ok) {
            if (selectedBundle === name) {
                setSelectedBundle(newName);
            }
            await loadBundles();
        } else {
            alert("Failed to rename bundle");
        }
    };

    const handleAssignGlobalSlide = useCallback(async (slide: string) => {
        setGlobalSlidePickerOpen(false);
        if (!selectedBundle) return;

        const existingIds = new Set((bundleMeta?.slides || []).map((entry) => entry.id));
        if (existingIds.has(slide)) {
            setSelectedSlide(slide);
            return;
        }

        const nextSlides = [
            ...(bundleMeta?.slides || []),
            {
                id: slide,
                type: "fabric" as const,
                data: `${slide}.json`,
                title: slide,
                active: true,
            },
        ];

        saveMeta({ slides: nextSlides });
        setSelectedSlide(slide);
    }, [bundleMeta?.slides, selectedBundle, saveMeta]);

    const handleDeleteSlide = async (bundle: string, name: string) => {
        if (!await askConfirm(`Are you sure you want to delete slide '${name}'?`)) return;
        await fetch(`/api/bundles/${encodeURIComponent(bundle)}/slides/${encodeURIComponent(name)}`, {
            method: "DELETE",
        });
        if (selectedSlide === name) setSelectedSlide(null);
        await loadBundles();
    };

    const handleDuplicateSlide = async (bundle: string, name: string) => {
        const newName = (await askPrompt("Duplicate slide as:", `${name}-copy`))?.trim().replace(/[^a-zA-Z0-9_\- ]/g, "-");
        if (!newName) return;
        const res = await fetch(`/api/bundles/${encodeURIComponent(bundle)}/slides/${encodeURIComponent(name)}`);
        if (!res.ok) return;
        const body = await res.text();
        // The slide endpoint also registers the new entry in the bundle meta.
        await fetch(`/api/bundles/${encodeURIComponent(bundle)}/slides/${encodeURIComponent(newName)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
        });

        await loadBundles();
        setSelectedSlide(newName);
    };

    const handleRenameSlide = async (bundle: string, name: string) => {
        const entry = bundleMeta.slides?.find(s => s.id === name);
        const isWeb = entry?.type === "website";

        let newName;
        if (isWeb) {
            const res = await askPrompt("Edit Website URL:", entry?.data);
            if (res === null) return;
            newName = res.trim() ? normalizeWebsiteUrl(res) : "";
        } else {
            const res = await askPrompt("Rename slide file to:", name);
            if (res === null) return;
            newName = (res || name).replace(/\.json$/, "").trim().replace(/[^a-zA-Z0-9_\- ]/g, "-");
        }

        if (!newName || newName === (isWeb ? entry?.data : name)) return;


        const res = await fetch(`/api/bundles/${encodeURIComponent(bundle)}/slides/${encodeURIComponent(name)}/rename`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newName }),
        });

        if (res.ok) {
            await loadBundles();
        } else {
            alert("Failed to edit slide data");
        }
    };

    const handleVideoSlideSelected = async (filename: string, _url: string, duration?: number) => {
        if (!selectedBundle) return;
        const target = videoSlidePicker;
        setVideoSlidePicker(null);
        if (!target) return;

        if (target === "new") {
            const nextSlides: BundleSlideEntry[] = [...(bundleMeta?.slides || []), {
                id: Date.now().toString(),
                type: "video" as const,
                data: filename,
                videoDuration: duration,
                duration: duration !== undefined ? Math.round(duration) : undefined,
                title: filename,
                active: true,
            }];
            await saveMeta({ slides: nextSlides });
            await loadBundles();
            setSelectedSlide(nextSlides[nextSlides.length - 1].id);
            return;
        }

        const nextSlides = (bundleMeta.slides || []).map((entry) => {
            if (entry.id !== target) return entry;
            const keepDuration = entry.videoDuration !== undefined && entry.duration === Math.round(entry.videoDuration);
            return {
                ...entry,
                data: filename,
                videoDuration: duration,
                duration: !keepDuration ? entry.duration : (duration !== undefined ? Math.round(duration) : entry.duration),
            };
        });
        saveMeta({ slides: nextSlides });
    };

    const stepIndex = (list: string[], current: string | null | undefined, dir: 1 | -1) => {
        const cur = current ? list.indexOf(current) : -1;
        return (cur + dir + list.length) % list.length;
    };

    // Browses the preview only; never touches what is on air.
    const stepPreview = (dir: 1 | -1) => {
        if (!eligibleSlides.length) return;
        setSelectedSlide(eligibleSlides[stepIndex(eligibleSlides, selectedSlide, dir)]);
    };

    const stepLive = (dir: 1 | -1) => {
        if (!selectedDisplayState || !eligibleActiveBundleSlides.length) return;
        const next = eligibleActiveBundleSlides[stepIndex(eligibleActiveBundleSlides, selectedDisplayState.slide, dir)];
        void pushSlideToDisplay(selectedDisplayState.bundle, next);
    };

    const isActive = (bundle: string, slide: string) =>
        selectedDisplayState?.bundle === bundle && selectedDisplayState?.slide === slide;

    const setLocalSlideOrder = useCallback((order: string[]) => {
        if (!selectedBundle) return;
        setBundles((prev) => prev.map((bundle) => (
            bundle.name === selectedBundle
                ? { ...bundle, slides: order }
                : bundle
        )));
    }, [selectedBundle]);

    const buildSlideEntries = useCallback((order: string[]) => {
        const normalized = new Map(orderedEntries.map((entry) => [entry.id, entry]));
        return order.map((name) => normalized.get(name) ?? { id: name, type: "fabric" as const, data: `${name}.json`, active: true });
    }, [orderedEntries]);

    const moveSlide = useCallback((fromSlide: string, toSlide: string) => {
        if (!selectedBundle || fromSlide === toSlide) return;
        const fromIndex = slides.indexOf(fromSlide);
        const toIndex = slides.indexOf(toSlide);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

        const nextOrder = [...slides];
        const [moved] = nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, moved);

        setLocalSlideOrder(nextOrder);
        saveMeta({ slides: buildSlideEntries(nextOrder) });
    }, [buildSlideEntries, saveMeta, selectedBundle, setLocalSlideOrder, slides]);

    const handleSaveSlideDuration = useCallback(() => {
        if (!selectedSlide) return;
        const nextDuration = slideDurationDraft.trim() === ""
            ? undefined
            : Number(slideDurationDraft);
        if (nextDuration !== undefined && (!Number.isFinite(nextDuration) || nextDuration < 0)) return;

        const normalized = new Map(orderedEntries.map((entry) => [entry.id, entry]));
        const nextSlides = slides.map((name) => {
            const entry = normalized.get(name) ?? { id: name, type: "fabric" as const, data: `${name}.json`, active: true };
            if (name !== selectedSlide) return entry;
            if (nextDuration === undefined) {
                const rest = { ...entry };
                delete rest.duration;
                return rest;
            }
            return { ...entry, duration: nextDuration };
        });

        saveMeta({ slides: nextSlides });
    }, [orderedEntries, saveMeta, selectedSlide, slideDurationDraft, slides]);

    const handleSaveSlideTransition = useCallback(() => {
        if (!selectedSlide) return;

        const normalized = new Map(orderedEntries.map((entry) => [entry.id, entry]));
        const nextSlides = slides.map((name) => {
            const entry = normalized.get(name) ?? { id: name, type: "fabric" as const, data: `${name}.json`, active: true };
            if (name !== selectedSlide) return entry;
            if (!slideTransitionDraft) {
                const rest = { ...entry };
                delete rest.transition;
                return rest;
            }
            return { ...entry, transition: slideTransitionDraft };
        });

        saveMeta({ slides: nextSlides });
    }, [orderedEntries, saveMeta, selectedSlide, slideTransitionDraft, slides]);

    const handleSaveSlideSchedule = useCallback(() => {
        if (!selectedSlide) return;

        let schedule: BundleSlideEntry["schedule"];
        if (slideScheduleDraft.mode === "daily") {
            if (slideScheduleDraft.dailyStart && slideScheduleDraft.dailyEnd) {
                schedule = { mode: "daily", dailyStart: slideScheduleDraft.dailyStart, dailyEnd: slideScheduleDraft.dailyEnd };
            }
        } else {
            const start = localInputValueToIso(slideScheduleDraft.start);
            const end = localInputValueToIso(slideScheduleDraft.end);
            if (start || end) {
                schedule = { mode: "range", ...(start ? { start } : {}), ...(end ? { end } : {}) };
            }
        }

        const normalized = new Map(orderedEntries.map((entry) => [entry.id, entry]));
        const nextSlides = slides.map((name) => {
            const entry = normalized.get(name) ?? { id: name, type: "fabric" as const, data: `${name}.json`, active: true };
            if (name !== selectedSlide) return entry;
            if (!schedule) {
                const rest = { ...entry };
                delete rest.schedule;
                return rest;
            }
            return { ...entry, schedule };
        });

        saveMeta({ slides: nextSlides });
    }, [orderedEntries, saveMeta, selectedSlide, slideScheduleDraft, slides]);

    // Shortcut: L shows or hides the live view. Taking a slide live deliberately has no
    // keyboard shortcut, so a stray key press can't change what is on screen.
    // Skipped while a dialog or the settings drawer is open.
    const shortcutsBlocked = !!dialog || settingsTab !== null || announcementDialogOpen || pendingTake !== null;
    useEffect(() => {
        if (shortcutsBlocked) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
            if (e.key === "l" || e.key === "L") toggleLiveView();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [shortcutsBlocked, toggleLiveView]);

    // A focused button also fires on Enter/Space with click detail 0; only real pointer clicks may go live.
    const onPointerClickOnly = (action: () => void) => (e: React.MouseEvent) => {
        if (e.detail === 0) return;
        action();
    };

    const closeSettings = useCallback(() => setSettingsTab(null), []);

    if (!authChecked) {
        return null;
    }

    const titleOf = (entry: BundleSlideEntry | undefined, id: string) => entry?.title || id;
    const previewEntry = selectedSlide ? entryBySlide.get(selectedSlide) : undefined;
    const liveEntry = selectedDisplayState
        ? liveBundleMeta.slides?.find((s) => s.id === selectedDisplayState.slide)
        : undefined;
    const liveSlideTitle = selectedDisplayState ? titleOf(liveEntry, selectedDisplayState.slide) : null;
    const displayName = selectedDisplayConfig?.name ?? "Display";
    const previewIsLive = !!selectedBundle && !!selectedSlide && isActive(selectedBundle, selectedSlide);
    const previewPosition = selectedSlide ? eligibleSlides.indexOf(selectedSlide) : -1;
    const showLiveInMain = liveViewVisible && liveSwapped;

    const inspectorSummary = (() => {
        if (!previewEntry) return selectedSlide ? "" : "Select a slide";
        const parts = [
            typeof previewEntry.duration === "number" ? `${previewEntry.duration} s` : "bundle duration",
            previewEntry.transition ? previewEntry.transition.type : "bundle transition",
        ];
        if (previewEntry.schedule) parts.push("scheduled");
        return parts.join(" · ");
    })();

    const previewMonitor = (
        <StudioMonitor
            key="preview"
            variant="preview"
            json={previewJson}
            bundleMeta={bundleMeta}
            activeEntry={previewEntry ?? null}
            overlay={loadingPreview ? "Loading…" : !selectedSlide ? "Select a slide to preview" : null}
        />
    );

    const liveMonitor = (
        <StudioMonitor
            key="live"
            variant="live"
            json={liveJson}
            bundleMeta={liveBundleMeta}
            activeEntry={liveEntry ?? null}
            overlay={selectedDisplayState ? null : "Blackout"}
            announcement={selectedDisplayAnnouncement}
        />
    );

    const settingsTabs: DrawerTab<SettingsTab>[] = [
        {
            id: "bundle",
            label: <><Settings size={11} /> Bundle settings</>,
            disabled: !selectedBundle,
            content: (
                <BundleSettingsPanel
                    selectedBundle={selectedBundle}
                    bundleMeta={bundleMeta}
                    metaDraft={metaDraft}
                    setMetaDraft={setMetaDraft}
                    saveMeta={saveMeta}
                />
            ),
        },
        {
            id: "displays",
            label: "Displays",
            content: (
                <DisplayConfigPanel
                    configs={state.displayConfigs}
                    onSave={updateDisplayConfig}
                    onClose={closeSettings}
                />
            ),
        },
        {
            id: "streams",
            label: <><Radio size={11} />{state.streams?.length > 0 && <span className="admin-live-dot" />} Streams</>,
            content: (
                <div className="admin-display-config-panel">
                    <div className="admin-display-config-header">
                        <strong>Live Streams</strong>
                        <a href="/send" target="_blank" className="admin-nav-btn" style={{ textDecoration: "none" }}>
                            <Radio size={12} /> Open /send
                        </a>
                    </div>
                    <StreamsPanel
                        streams={state.streams ?? []}
                        socketRef={socketRef}
                        displayConfigs={state.displayConfigs}
                        selectedDisplay={effectiveSelectedDisplay}
                        displayActiveStreams={displayActiveStreams}
                        onShowStream={(streamId, displayId) => {
                            showStream(streamId, displayId);
                            setDisplayActiveStreams((prev) => ({ ...prev, [displayId]: streamId }));
                        }}
                        onClearStream={(displayId) => {
                            clearStream(displayId);
                            setDisplayActiveStreams((prev) => {
                                const next = { ...prev };
                                delete next[displayId];
                                return next;
                            });
                        }}
                    />
                </div>
            ),
        },
        { id: "users", label: "Users", content: <UserManager /> },
    ];

    return (
        <>
            <div className="admin-layout">

                {/* ── Header ─────────────────────────────── */}
                <header className="admin-header">
                    <div className="admin-header-brand">
                        <span className="admin-brand-text">Infoscreen<em>4</em></span>
                        <span className="admin-brand-sub">Admin</span>
                    </div>

                    <div className="admin-header-status">
                        <span className={`admin-ws-pill ${connected ? "ok" : "off"}`}>
                            <span className="admin-ws-dot" />
                            {connected ? "Connected" : "Disconnected"}
                        </span>
                        <span className="admin-display-pill">
                            {state.connectedDisplays > 0
                                ? <><Monitor size={13} />&nbsp;{state.connectedDisplays} client{state.connectedDisplays !== 1 ? "s" : ""}</>
                                : <><MonitorOff size={13} />&nbsp;No clients</>}
                        </span>
                        {selectedDisplayConfig && (
                            <span className="admin-now-pill">
                                {selectedDisplayState && <Play size={11} />}
                                <span>{selectedDisplayConfig.name}</span>
                                {selectedDisplayState && (
                                    <>
                                        <ChevronRight size={11} className="admin-now-sep" />
                                        <span>{selectedDisplayState.bundle}</span>
                                        <ChevronRight size={11} className="admin-now-sep" />
                                        <strong>{liveSlideTitle}</strong>
                                    </>
                                )}
                            </span>
                        )}
                    </div>

                    <nav className="admin-header-nav">
                        {state.displayConfigs.length > 0 && (
                            <div className="admin-display-picker">
                                <label htmlFor="admin-display-select">Controlling</label>
                                <select
                                    id="admin-display-select"
                                    className="admin-display-select"
                                    value={effectiveSelectedDisplay ?? ""}
                                    onChange={(e) => setSelectedDisplay(e.target.value)}
                                    title="The display that TAKE and the live controls act on"
                                >
                                    {state.displayConfigs.map((conf) => (
                                        <option key={conf.id} value={conf.id}>{conf.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button
                            className={`admin-nav-btn${liveViewVisible ? " active" : ""}`}
                            onClick={toggleLiveView}
                            title={liveViewVisible ? "Hide the live view (L)" : "Show the live view (L)"}
                            aria-pressed={liveViewVisible}
                        >
                            <Cast size={13} /> Live
                        </button>
                        <button className="admin-nav-btn" onClick={loadBundles} title="Reload bundles">
                            <RefreshCw size={13} />
                        </button>
                        <button
                            className={`admin-nav-btn ${hasActiveAnnouncement ? "announce-active" : ""}`}
                            onClick={() => setAnnouncementDialogOpen(true)}
                            title={hasActiveAnnouncement ? "Lower-third announcement (active)" : "Lower-third announcement"}
                        >
                            <Megaphone size={13} />
                        </button>
                        <button
                            className={`admin-nav-btn${settingsTab ? " active" : ""}`}
                            onClick={() => setSettingsTab(selectedBundle ? "bundle" : "displays")}
                            title="Bundle, display, stream and user settings"
                        >
                            <Settings size={13} /> Settings
                        </button>

                        <button
                            className="admin-nav-btn"
                            type="button"
                            onClick={handleLogout}
                            title={currentUser ? `Signed in as ${currentUser}` : undefined}
                        >
                            <LogOut size={13} /> Logout
                        </button>
                    </nav>
                </header>


                {/* ── Main 3-column area ─────────────────── */}
                <main className="admin-main">
                    {dialog && (
                        <div className="slide-picker-overlay" onClick={() => dialog.resolve(null)}>
                            <div className="slide-picker-modal" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
                                <div className="slide-picker-header">
                                    <span>{dialog.type === 'prompt' ? 'Input' : 'Confirm'}</span>
                                    <button className="toolbar-btn toolbar-btn-icon" onClick={() => dialog.resolve(null)} title="Cancel">?</button>
                                </div>
                                <div className="slide-picker-body">
                                    <span className="toolbar-label" style={{ marginBottom: 10, display: "block" }}>{dialog.text}</span>
                                    {dialog.type === 'prompt' && (
                                        <input
                                            type="text"
                                            defaultValue={dialog.defaultVal}
                                            style={{ width: "100%", padding: "6px", marginBottom: "10px", background: "#3a3a3a", color: "white", border: "1px solid #555" }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') dialog.resolve(e.currentTarget.value);
                                                if (e.key === 'Escape') dialog.resolve(null);
                                            }}
                                            autoFocus
                                            ref={(el) => { if (el) el.select(); }}
                                        />
                                    )}
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                        <button className="toolbar-btn" onClick={() => dialog.resolve(null)}>Cancel</button>
                                        <button className="toolbar-btn" style={{ background: "#0078D4" }} onClick={(e) => {
                                            if (dialog.type === 'prompt') {
                                                const input = e.currentTarget.parentElement?.parentElement?.querySelector('input');
                                                dialog.resolve(input?.value ?? null);
                                            } else {
                                                dialog.resolve(true);
                                            }
                                        }}>OK</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {globalSlidePickerOpen && (
                        <GlobalSlidePickerModal
                            onSelect={handleAssignGlobalSlide}
                            onClose={() => setGlobalSlidePickerOpen(false)}
                        />
                    )}

                    {videoSlidePicker !== null && (
                        <FileManagerDialog
                            basePath="/api/files/videos"
                            probeVideoDuration
                            onSelect={handleVideoSlideSelected}
                            onClose={() => setVideoSlidePicker(null)}
                        />
                    )}

                    {announcementDialogOpen && (
                        <AnnouncementDialog
                            selectedDisplayName={selectedDisplayConfig?.name}
                            initialLine1={selectedDisplayAnnouncement?.line1}
                            initialLine2={selectedDisplayAnnouncement?.line2}
                            initialColor={selectedDisplayAnnouncement?.color}
                            onShow={(line1, line2, color) => {
                                if (!effectiveSelectedDisplay) return;
                                showAnnouncement(effectiveSelectedDisplay, line1, line2, color);
                            }}
                            onShowAll={(line1, line2, color) => showAnnouncementAll(line1, line2, color)}
                            onClearAll={() => clearAnnouncementAll()}
                            onClose={() => setAnnouncementDialogOpen(false)}
                        />
                    )}

                    <AdminContextMenu
                        visible={adminContextMenu.visible}
                        x={adminContextMenu.x}
                        y={adminContextMenu.y}
                        items={adminContextMenu.items}
                        onClose={() => setAdminContextMenu((prev) => ({ ...prev, visible: false }))}
                    />

                    {/* Column 1 – Bundles */}
                    <aside className="admin-col admin-col-bundles">
                        <div className="admin-col-header">
                            <span>Bundles</span>
                            <button className="admin-icon-btn" onClick={handleNewBundle} title="New bundle">
                                <FolderPlus size={14} />
                            </button>
                        </div>
                        <ul className="admin-list">
                            {bundles.length === 0 && <li className="admin-list-empty">No bundles</li>}
                            {bundles.map((b) => (
                                <li
                                    key={b.name}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setAdminContextMenu({
                                            visible: true,
                                            x: e.clientX,
                                            y: e.clientY,
                                            items: [
                                                { label: "Rename Bundle", onClick: () => handleRenameBundle(b.name) },
                                                { label: "Duplicate Bundle", onClick: () => handleDuplicateBundle(b.name) },
                                                { label: "Delete Bundle", danger: true, onClick: () => handleDeleteBundle(b.name) },
                                            ]
                                        });
                                    }}
                                >
                                    <div className={`admin-list-item ${selectedBundle === b.name ? "selected" : ""}`}>
                                        <button
                                            className="admin-list-item-name-btn"
                                            onClick={() => { setSelectedBundle(b.name); setSelectedSlide(null); }}
                                        >
                                            <span className="">{b.name}</span>
                                        </button>
                                        <span className="admin-list-item-count">{b.slides.length}</span>
                                        <button
                                            className={`admin-bundle-active-btn${selectedDisplayState?.bundle === b.name ? " on" : ""}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (!effectiveSelectedDisplay) return;
                                                setConfirmActivateBundle(b.name);
                                            }}
                                            title={selectedDisplayState?.bundle === b.name ? "Active bundle" : "Set as active bundle"}
                                        >
                                            <Zap size={11} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </aside>

                    {/* Column 2 – Slides */}
                    <aside className="admin-col admin-col-slides">
                        <div className="admin-col-header">
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span>Slides</span>

                            </div>
                            <div style={{ display: "flex", alignItems: "end", gap: 6 }}>
                                <button
                                    className="admin-icon-btn"
                                    onClick={() => {
                                        if (!selectedBundle) return;
                                        router.push(`/admin/editor?bundle=${encodeURIComponent(selectedBundle)}`);
                                    }}
                                    title={selectedBundle ? "Create new slide" : "Select a bundle first"}
                                    disabled={!selectedBundle}
                                >
                                    <FilePlus size={14} />
                                </button>
                                <button
                                    className="admin-icon-btn"
                                    onClick={() => setGlobalSlidePickerOpen(true)}
                                    title={selectedBundle ? "Assign existing global slide" : "Select a bundle first"}
                                    disabled={!selectedBundle}
                                >
                                    <FolderOpen size={14} />
                                </button>
                                <button
                                    className="admin-icon-btn"
                                    onClick={async () => {
                                        if (!selectedBundle) return;
                                        const url = await askPrompt("Website URL (e.g. https://example.com):");
                                        if (!url) return;
                                        const titleStr = await askPrompt("Slide title (optional):");
                                        const title = titleStr ? titleStr.trim() : "";
                                        const nextSlides = [...(bundleMeta?.slides || []), {
                                            id: Date.now().toString(),
                                            type: "website" as const,
                                            data: normalizeWebsiteUrl(url),
                                            title: title || undefined,
                                            active: true
                                        }];
                                        await saveMeta({ slides: nextSlides as BundleSlideEntry[] });
                                        await loadBundles();
                                        setSelectedSlide(nextSlides[nextSlides.length - 1].id);
                                    }}
                                    title={selectedBundle ? "Add website slide" : "Select a bundle first"}
                                    disabled={!selectedBundle}
                                >
                                    <Globe size={14} />
                                </button>
                                <button
                                    className="admin-icon-btn"
                                    onClick={() => setVideoSlidePicker("new")}
                                    title={selectedBundle ? "Add video slide" : "Select a bundle first"}
                                    disabled={!selectedBundle}
                                >
                                    <Video size={14} />
                                </button>
                            </div>
                        </div>
                        <ul className="admin-list">
                            {!selectedBundle && <li className="admin-list-empty">Select a bundle</li>}
                            {selectedBundle && slides.length === 0 && <li className="admin-list-empty">No slides</li>}
                            {slides.map((slide) => {
                                const existingEntry = entryBySlide.get(slide);
                                const isEnabled = existingEntry?.active !== false;
                                const isDragging = dragSlide === slide;
                                const isDragOver = dragOverSlide === slide && dragSlide !== slide;
                                return (
                                    <li
                                        key={slide}
                                        draggable={true}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setAdminContextMenu({
                                                visible: true,
                                                x: e.clientX,
                                                y: e.clientY,
                                                items: [
                                                    ...(effectiveSelectedDisplay ? [
                                                        state.displayQueuedNext?.[effectiveSelectedDisplay] === slide
                                                            ? { label: "Cancel Queued Next", onClick: () => queueNextSlide(effectiveSelectedDisplay, null) }
                                                            : { label: "Queue Next", onClick: () => queueNextSlide(effectiveSelectedDisplay, slide) }
                                                    ] : []),
                                                    {
                                                        label: "Edit Title", onClick: async () => {
                                                            const newTitle = await askPrompt("Slide Title:", existingEntry?.title || slide);
                                                            if (newTitle !== null) {
                                                                const normalized = new Map(orderedEntries.map((e) => [e.id, e]));
                                                                const next = slides.map(id => id === slide ? { ...(normalized.get(id) ?? { id, type: "fabric" as const, data: id + ".json" }), title: newTitle } : (normalized.get(id) ?? { id, type: "fabric" as const, data: id + ".json" }));
                                                                saveMeta({ slides: next });
                                                            }
                                                        }
                                                    },
                                                    existingEntry?.type === "video"
                                                        ? { label: "Replace Video", onClick: () => setVideoSlidePicker(slide) }
                                                        : { label: existingEntry?.type === "website" ? "Edit URL" : "Rename File", onClick: () => handleRenameSlide(selectedBundle!, slide) },
                                                    { label: "Duplicate Slide", onClick: () => handleDuplicateSlide(selectedBundle!, slide) },
                                                    { label: "Delete Slide", danger: true, onClick: () => handleDeleteSlide(selectedBundle!, slide) }
                                                ]
                                            });
                                        }}
                                        onDragStart={(e) => {
                                            setDragSlide(slide);
                                            setDragOverSlide(slide);
                                            e.dataTransfer.effectAllowed = "move";
                                            e.dataTransfer.setData("text/plain", slide);
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            if (dragOverSlide !== slide) setDragOverSlide(slide);
                                            e.dataTransfer.dropEffect = "move";
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const source = dragSlide ?? e.dataTransfer.getData("text/plain");
                                            if (source) moveSlide(source, slide);
                                            setDragSlide(null);
                                            setDragOverSlide(null);
                                        }}
                                        onDragEnd={() => {
                                            setDragSlide(null);
                                            setDragOverSlide(null);
                                        }}
                                    >
                                        <div className={`admin-list-item admin-list-item-draggable ${selectedSlide === slide ? "selected" : ""} ${isActive(selectedBundle!, slide) ? "playing" : ""} ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""}`} title="Drag to reorder">
                                            <span className="admin-list-item-name" onClick={() => setSelectedSlide(slide)} style={{ cursor: "pointer" }}>{existingEntry?.title || slide}</span>
                                            {isActive(selectedBundle!, slide) && (
                                                <span className="admin-live-tag" title={`On air on ${displayName}`}>Live</span>
                                            )}
                                            {existingEntry?.schedule && (
                                                <span className="admin-label" title="This slide has a scheduled cycling window">
                                                    <Clock size={12} />
                                                </span>
                                            )}
                                            {effectiveSelectedDisplay && state.displayQueuedNext?.[effectiveSelectedDisplay] === slide && (
                                                <span className="admin-label" title="Queued to play next">
                                                    <SkipForward size={12} />
                                                </span>
                                            )}
                                            <button
                                                className={`admin-slide-toggle${isEnabled ? " on" : ""}`}
                                                title={isEnabled ? "Remove from cycle" : "Add to cycle"}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const normalized = new Map(orderedEntries.map((entry) => [entry.id, entry]));
                                                    const next = slides.map((name) => {
                                                        const entry = normalized.get(name) ?? { id: name, type: "fabric" as const, data: `${name}.json`, active: true };
                                                        if (name !== slide) return entry;
                                                        return { ...entry, active: !isEnabled };
                                                    });
                                                    saveMeta({ slides: next });
                                                }}
                                            >{isEnabled ? "✓" : "–"}</button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </aside>

                    {/* Column 3 – Studio: preview with a live picture-in-picture */}
                    <section className="admin-col admin-col-studio">
                        <div className="admin-col-header">
                            <span className="admin-studio-title">
                                {showLiveInMain ? "Live" : "Preview"}
                                <span className="admin-studio-crumb">
                                    {showLiveInMain
                                        ? `— ${displayName}`
                                        : selectedBundle ? `— ${selectedBundle}${selectedSlide ? ` › ${titleOf(previewEntry, selectedSlide)}` : ""}` : ""}
                                </span>
                            </span>
                        </div>

                        <div className="admin-studio-body">
                            <div className="admin-monitors">
                                <div className="admin-monitor-main">
                                    {showLiveInMain ? liveMonitor : previewMonitor}
                                </div>
                                {liveViewVisible && (
                                    <LivePanel
                                        displayName={displayName}
                                        liveBundle={selectedDisplayState?.bundle ?? null}
                                        liveSlideTitle={liveSlideTitle}
                                        slideDuration={selectedDisplayState?.duration ?? null}
                                        cycling={selectedDisplayIsCycling}
                                        connected={connected}
                                        canStep={!!selectedDisplayState && eligibleActiveBundleSlides.length > 1}
                                        canResume={resumeTarget !== null}
                                        onSwap={() => setLiveSwapped((swapped) => !swapped)}
                                        onPrev={() => stepLive(-1)}
                                        onNext={() => stepLive(1)}
                                        onTogglePause={handleToggleLiveCycle}
                                        onBlackout={handleClearSlide}
                                    >
                                        {showLiveInMain ? previewMonitor : liveMonitor}
                                    </LivePanel>
                                )}
                            </div>

                            <div className="admin-preview-bar">
                                <button className="admin-nav-btn" onClick={() => stepPreview(-1)} disabled={eligibleSlides.length < 2} title="Previous slide in preview">
                                    <StepBack size={13} />
                                </button>
                                <button className="admin-nav-btn" onClick={() => stepPreview(1)} disabled={eligibleSlides.length < 2} title="Next slide in preview">
                                    <StepForward size={13} />
                                </button>
                                {previewPosition >= 0 && (
                                    <span className="admin-label">
                                        {previewPosition + 1} / {eligibleSlides.length} in <strong>{selectedBundle}</strong>
                                    </span>
                                )}
                                {selectedBundle && selectedSlide && (
                                    previewEntry?.type === "website" ? (
                                        <button className="admin-nav-btn" onClick={() => handleRenameSlide(selectedBundle, selectedSlide)}>
                                            <Pencil size={13} /> Edit URL
                                        </button>
                                    ) : previewEntry?.type === "video" ? (
                                        <button className="admin-nav-btn" onClick={() => setVideoSlidePicker(selectedSlide)}>
                                            <Video size={13} /> Replace Video
                                        </button>
                                    ) : (
                                        <Link
                                            href={`/admin/editor?bundle=${encodeURIComponent(selectedBundle)}&slide=${encodeURIComponent(selectedSlide)}`}
                                            className="admin-nav-btn"
                                        >
                                            <Pencil size={13} /> Edit slide
                                        </Link>
                                    )
                                )}

                                <span className="admin-preview-bar-spacer" />

                                {pendingTake ? (
                                    <div className="admin-take-confirm">
                                        <span>
                                            {displayName} is cycling <strong>{selectedDisplayState?.bundle}</strong>.
                                            Switch it to <strong>{pendingTake.bundle}</strong>?
                                        </span>
                                        <button className="admin-nav-btn" onClick={() => setPendingTake(null)}>Cancel</button>
                                        <button className="admin-nav-btn active" onClick={onPointerClickOnly(confirmPendingTake)}>Switch and take</button>
                                    </div>
                                ) : (
                                    <button
                                        className="admin-take-btn"
                                        onClick={onPointerClickOnly(handleTake)}
                                        disabled={!connected || !effectiveSelectedDisplay || !selectedSlide || previewIsLive}
                                        title={previewIsLive ? "This slide is already live" : `Send the previewed slide to ${displayName}`}
                                    >
                                        <Cast size={17} /> Take ⇨ Live
                                    </button>
                                )}
                            </div>

                            <SlideInspector
                                open={inspectorOpen}
                                onToggle={() => setInspectorOpen((open) => !open)}
                                hasSlide={!!selectedSlide}
                                summary={inspectorSummary}
                                durationDraft={slideDurationDraft}
                                setDurationDraft={setSlideDurationDraft}
                                durationDirty={isSlideDurationDirty}
                                onSaveDuration={handleSaveSlideDuration}
                                transitionDraft={slideTransitionDraft}
                                setTransitionDraft={setSlideTransitionDraft}
                                transitionDirty={isSlideTransitionDirty}
                                onSaveTransition={handleSaveSlideTransition}
                                scheduleDraft={slideScheduleDraft}
                                setScheduleDraft={setSlideScheduleDraft}
                                scheduleDirty={isSlideScheduleDirty}
                                onSaveSchedule={handleSaveSlideSchedule}
                            />
                        </div>
                    </section>

                    {settingsTab && (
                        <SettingsDrawer
                            tabs={settingsTabs}
                            activeTab={settingsTab}
                            onTabChange={setSettingsTab}
                            onClose={closeSettings}
                        />
                    )}
                </main>

                {confirmActivateBundle !== null && (
                    <div className="slide-picker-overlay" onClick={() => setConfirmActivateBundle(null)} style={{ zIndex: 10000 }}>
                        <div className="slide-picker-modal" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
                            <div className="slide-picker-header">
                                <span>Confirm Active Bundle</span>
                                <button className="toolbar-btn toolbar-btn-icon" onClick={() => setConfirmActivateBundle(null)} title="Close">✕</button>
                            </div>
                            <div className="slide-picker-body" style={{ padding: '20px 10px', textAlign: 'center' }}>
                                <p style={{ marginBottom: '20px', fontSize: '15px' }}>
                                    Are you sure you want to set &quot;<strong>{confirmActivateBundle}</strong>&quot; as the active bundle?
                                </p>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                    <button
                                        className="toolbar-btn"
                                        onClick={() => setConfirmActivateBundle(null)}
                                        style={{ padding: '8px 16px' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="toolbar-btn toolbar-btn-primary"
                                        style={{ padding: '8px 16px', background: '#36f', color: '#fff', border: '1px solid #25e' }}
                                        onClick={() => {
                                            if (effectiveSelectedDisplay) activateBundle(confirmActivateBundle, effectiveSelectedDisplay);
                                            setConfirmActivateBundle(null);
                                        }}
                                    >
                                        Set Active Bundle
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}
