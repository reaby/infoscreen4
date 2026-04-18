"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSocket, DisplayConfig } from "../hooks/useSocket";
import {
    Monitor, MonitorOff, Pencil, StepBack, StepForward,
    Play, Pause, RotateCcw, FolderPlus, RefreshCw, Settings, CircleOff, Zap, FilePlus, User, ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { BundleMeta, BundleSlideEntry } from "../interfaces/BundleMeta";
import BundleSettingsPanel from "../components/BundleSettingsPanel";
import UserManager from "../components/UserManager";
const DisplaySlide = dynamic(() => import("../components/DisplaySlide"), { ssr: false });

interface BundleInfo {
    name: string;
    slides: string[];
}

const DEFAULT_DURATION = 10;

const normalizeSlideFile = (value: string) => (value.endsWith(".json") ? value : `${value}.json`);

export default function AdminDashboard() {
    const defer = (fn: () => void) => queueMicrotask(fn);
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement | null>(null);
    const { connected, state, showSlide, clearSlide, stopCycle, updateBundleMeta, activateBundle, updateDisplayConfig, bundleMetaUpdate } = useSocket("admin");
    const [bundles, setBundles] = useState<BundleInfo[]>([]);
    const [selectedDisplay, setSelectedDisplay] = useState<string | null>(null);
    const [displayDrafts, setDisplayDrafts] = useState<DisplayConfig[]>([]);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch("/api/auth");
                const data = await response.json();
                if (!data.authenticated) {
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

    useEffect(() => {
        if (!userMenuOpen) return;
        const handleClick = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [userMenuOpen]);

    const handleLogout = useCallback(async () => {
        setUserMenuOpen(false);
        await fetch("/api/auth", { method: "DELETE" });
        router.replace("/");
    }, [router]);

    const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
    const [selectedSlide, setSelectedSlide] = useState<string | null>(null);
    const [previewJson, setPreviewJson] = useState<object | null>(null);
    const [liveJson, setLiveJson] = useState<object | null>(null);
    const [previewTab, setPreviewTab] = useState<"preview" | "live" | "settings" | "users" | "displays">("preview");
    const [bundleMeta, setBundleMeta] = useState<BundleMeta>({});
    const [liveBundleMeta, setLiveBundleMeta] = useState<BundleMeta>({});
    const [metaDraft, setMetaDraft] = useState<BundleMeta>({});
    const [slideDurationDraft, setSlideDurationDraft] = useState<string>("");
    const [dragSlide, setDragSlide] = useState<string | null>(null);
    const [dragOverSlide, setDragOverSlide] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
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

    useEffect(() => {
        defer(() => setDisplayDrafts(state.displayConfigs));
    }, [state.displayConfigs]);

    const selectedDisplayState = useMemo(
        () => effectiveSelectedDisplay ? state.displayStates?.[effectiveSelectedDisplay] ?? null : null,
        [effectiveSelectedDisplay, state.displayStates]
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
        (bundleMeta.slides ?? []).map((entry) => ({
            ...entry,
            file: normalizeSlideFile(entry.file),
        }))
    ), [bundleMeta.slides]);
    const entryBySlide = useMemo(() => (
        new Map(orderedEntries.map((entry) => [entry.file.slice(0, -5), entry]))
    ), [orderedEntries]);
    const selectedEntry = useMemo(() => {
        if (!selectedSlide) return undefined;
        return orderedEntries.find((entry) => entry.file.slice(0, -5) === selectedSlide);
    }, [orderedEntries, selectedSlide]);
    const savedSlideDurationDraft = useMemo(() => (
        typeof selectedEntry?.duration === "number" ? String(selectedEntry.duration) : ""
    ), [selectedEntry]);
    const isSlideDurationDirty = selectedSlide !== null && slideDurationDraft !== savedSlideDurationDraft;

    useEffect(() => {
        defer(() => {
            setSlideDurationDraft(selectedSlide ? savedSlideDurationDraft : "");
        });
    }, [selectedSlide, savedSlideDurationDraft]);

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

    // Fetch live JSON + live bundle metadata whenever the active broadcast slide changes
    useEffect(() => {
        const active = selectedDisplayState;
        if (!active) {
            defer(() => {
                setLiveJson(null);
                setLiveBundleMeta({});
            });
            return;
        }

        const hasSocketJson = active.json != null;
        const hasSocketMeta = active.bundleMeta != null;

        if (hasSocketJson || hasSocketMeta) {
            defer(() => {
                if (hasSocketMeta) {
                    setLiveBundleMeta(active.bundleMeta as BundleMeta);
                }
                if (hasSocketJson) {
                    setLiveJson(active.json as object | null);
                }
            });
            if (hasSocketJson && hasSocketMeta) {
                return;
            }
        }

        const seq = ++liveLoadSeqRef.current;
        Promise.all([
            hasSocketMeta
                ? Promise.resolve(active.bundleMeta)
                : fetch(`/api/bundles/${encodeURIComponent(active.bundle)}`)
                    .then((r) => r.json()).catch(() => ({})),
            hasSocketJson
                ? Promise.resolve(active.json)
                : fetch(`/api/bundles/${encodeURIComponent(active.bundle)}/slides/${encodeURIComponent(active.slide)}`)
                    .then((r) => r.json()).catch(() => null),
        ]).then(([meta, json]) => {
            if (liveLoadSeqRef.current !== seq) return;
            setLiveBundleMeta((meta ?? {}) as BundleMeta);
            setLiveJson(json);
        });
    }, [selectedDisplayState]);

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
        defer(() => setLoadingPreview(true));
        fetch(`/api/bundles/${encodeURIComponent(selectedBundle)}/slides/${encodeURIComponent(selectedSlide)}`)
            .then((r) => r.json())
            .then((j) => setPreviewJson(j))
            .catch(() => setPreviewJson(null))
            .finally(() => setLoadingPreview(false));
    }, [selectedBundle, selectedSlide]);

    const handleShowSlide = async () => {
        if (!effectiveSelectedDisplay) return;
        const targetBundle = selectedDisplayState?.bundle ?? selectedBundle;
        if (!targetBundle || activeBundleSlides.length === 0) return;

        const canUsePreviewSelection = selectedBundle === targetBundle
            && !!selectedSlide
            && activeBundleSlides.includes(selectedSlide);

        const slideToShow = canUsePreviewSelection
            ? selectedSlide
            : (selectedDisplayState?.bundle === targetBundle && selectedDisplayState?.slide
                ? selectedDisplayState.slide
                : activeBundleSlides[0]);

        if (selectedBundle === targetBundle && selectedSlide !== slideToShow) {
            setSelectedSlide(slideToShow);
        }

        let baseDuration = DEFAULT_DURATION;
        if (selectedBundle === targetBundle) {
            const fromSelected = bundleMeta.defaultDuration;
            if (typeof fromSelected === "number" && Number.isFinite(fromSelected)) {
                baseDuration = fromSelected;
            }
        } else {
            const remoteMeta: BundleMeta = await fetch(`/api/bundles/${encodeURIComponent(targetBundle)}`)
                .then((r) => r.json())
                .catch(() => ({}));
            const fromRemote = remoteMeta.defaultDuration;
            if (typeof fromRemote === "number" && Number.isFinite(fromRemote)) {
                baseDuration = fromRemote;
            }
        }

        showSlide(effectiveSelectedDisplay, { bundle: targetBundle, slide: slideToShow, duration: baseDuration });
    };

    const handleStopCycle = useCallback(() => {
        if (!effectiveSelectedDisplay) return;
        stopCycle(effectiveSelectedDisplay);
    }, [effectiveSelectedDisplay, stopCycle]);

    const handleClearSlide = useCallback(() => {
        if (!effectiveSelectedDisplay) return;
        clearSlide(effectiveSelectedDisplay);
    }, [effectiveSelectedDisplay, clearSlide]);

    const selectedDisplayIsCycling = effectiveSelectedDisplay ? state.displayCycling?.[effectiveSelectedDisplay] ?? false : false;

    const handleNewBundle = async () => {
        const name = window.prompt("New bundle name:")?.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
        if (!name) return;
        await fetch("/api/bundles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        await loadBundles();
        setSelectedBundle(name);
    };

    const navigate = (dir: 1 | -1) => {
        if (!slides.length) return;
        const cur = selectedSlide ? slides.indexOf(selectedSlide) : -1;
        const next = (cur + dir + slides.length) % slides.length;
        setSelectedSlide(slides[next]);
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
        const normalized = new Map(orderedEntries.map((entry) => [entry.file.slice(0, -5), entry]));
        return order.map((name) => normalized.get(name) ?? { file: `${name}.json`, active: true });
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

        const normalized = new Map(orderedEntries.map((entry) => [entry.file.slice(0, -5), entry]));
        const nextSlides = slides.map((name) => {
            const entry = normalized.get(name) ?? { file: `${name}.json`, active: true };
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

    if (!authChecked) {
        return null;
    }

    const previewHeaderTitle =
        previewTab === "preview" ? selectedSlide :
        previewTab === "live" ? selectedDisplayState?.slide :
        previewTab === "users" ? "User management" :
        selectedBundle;

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
                            ? <><Monitor size={13} />&nbsp;{state.connectedDisplays} display{state.connectedDisplays !== 1 ? "s" : ""}</>
                            : <><MonitorOff size={13} />&nbsp;No displays</>}
                    </span>
                    {selectedDisplayConfig && (
                        <span className="admin-now-pill">
                            {selectedDisplayConfig.name}
                        </span>
                    )}
                    {selectedDisplayState && (
                        <span className="admin-now-pill">
                            <Play size={11} />
                            &nbsp;{selectedDisplayState.bundle}&nbsp;/&nbsp;<strong>{selectedDisplayState.slide}</strong>
                        </span>
                    )}
                </div>

                <nav className="admin-header-nav">
                    {state.displayConfigs.length > 0 && (
                        <>
                            <select
                                className="admin-display-select"
                                value={effectiveSelectedDisplay ?? ""}
                                onChange={(e) => setSelectedDisplay(e.target.value)}
                                title="Select display"
                            >
                                {state.displayConfigs.map((conf) => (
                                    <option key={conf.id} value={conf.id}>{conf.name}</option>
                                ))}
                            </select>
                        </>
                    )}
                    <button className="admin-nav-btn" onClick={loadBundles} title="Refresh">
                        <RefreshCw size={13} />
                    </button>

                    <div className="admin-user-menu" ref={userMenuRef}>
                        <button
                            className="admin-nav-btn admin-user-menu-trigger"
                            type="button"
                            onClick={() => setUserMenuOpen((current) => !current)}
                            title="User menu"
                        >
                            <User size={13} />
                            <span>{currentUser ?? "Admin"}</span>
                            <ChevronDown size={12} />
                        </button>
                        {userMenuOpen && (
                            <div className="admin-user-menu-popover">
                                <div className="admin-user-menu-title">Signed in as</div>
                                <div className="admin-user-menu-username">{currentUser ?? "unknown"}</div>
                                <button
                                    className="admin-user-menu-item"
                                    type="button"
                                    onClick={() => {
                                        setPreviewTab("users");
                                        setUserMenuOpen(false);
                                    }}
                                >
                                    Users
                                </button>
                                <button className="admin-user-menu-item" type="button" onClick={handleLogout}>
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </nav>
            </header>


            {/* ── Main 3-column area ─────────────────── */}
            <main className="admin-main">

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
                            <li key={b.name}>
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
                                        onClick={() => selectedDisplay && activateBundle(b.name, selectedDisplay)}
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
                                    <span className="admin-playing-icon-placeholder">
                                        {isActive(selectedBundle!, slide) ? <Play size={14} className="admin-playing-icon" /> : null}
                                    </span>
                                    <span className="admin-list-item-name" onClick={() => setSelectedSlide(slide)} style={{ cursor: "pointer" }}>{slide}</span>
                                    <button
                                        className={`admin-slide-toggle${isEnabled ? " on" : ""}`}
                                        title={isEnabled ? "Remove from cycle" : "Add to cycle"}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const normalized = new Map(orderedEntries.map((entry) => [entry.file.slice(0, -5), entry]));
                                            const next = slides.map((name) => {
                                                const entry = normalized.get(name) ?? { file: `${name}.json`, active: true };
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

                {/* Column 3 – Preview + details */}
                <section className="admin-col admin-col-preview">
                    <div className="admin-col-header">
                        <div className="admin-preview-header-row">
                            <div className="admin-preview-tabs-left">
                                <button
                                    className={`admin-preview-tab ${previewTab === "preview" ? "active" : ""}`}
                                    onClick={() => setPreviewTab("preview")}
                                >Preview</button>
                                <button
                                    className={`admin-preview-tab ${previewTab === "settings" ? "active" : ""}`}
                                    onClick={() => setPreviewTab("settings")}
                                    disabled={!selectedBundle}
                                    title="Bundle settings"
                                >
                                    <Settings size={11} /> Settings
                                </button>
                                {state.displayConfigs.length > 0 && (
                                    <button
                                        className={`admin-preview-tab ${previewTab === "displays" ? "active" : ""}`}
                                        type="button"
                                        onClick={() => setPreviewTab("displays")}
                                        title="Display settings"
                                    >
                                        Displays
                                    </button>
                                )}
                            </div>

                            <button
                                className={`admin-preview-tab admin-preview-tab-live-edge ${previewTab === "live" ? "active" : ""} ${selectedDisplayState ? "live" : ""}`}
                                onClick={() => setPreviewTab("live")}
                            >
                                {selectedDisplayState && <span className="admin-live-dot" />}Live
                            </button>
                        </div>
                    </div>

                    {previewTab === "settings" ? (
                        <BundleSettingsPanel
                            selectedBundle={selectedBundle}
                            bundleMeta={bundleMeta}
                            metaDraft={metaDraft}
                            setMetaDraft={setMetaDraft}
                            saveMeta={saveMeta}
                        />
                    ) : previewTab === "users" ? (
                        <UserManager />
                    ) : previewTab === "displays" ? (
                        <div className="admin-display-config-panel">
                            <div className="admin-display-config-header">
                                <strong>Display configuration</strong>
                            </div>
                            {displayDrafts.map((config, index) => (
                                <div className="admin-display-config-row" key={config.id}>
                                    <div className="admin-display-config-field">
                                        <label className="admin-label">ID</label>
                                        <input
                                            value={config.id}
                                            onChange={(e) => {
                                                const nextId = e.target.value.trim();
                                                setDisplayDrafts((current) => current.map((item, idx) => idx === index ? { ...item, id: nextId || item.id } : item));
                                            }}
                                            className="admin-settings-input"
                                            style={{ width: 100 }}
                                        />
                                    </div>
                                    <div className="admin-display-config-field">
                                        <label className="admin-label">Name</label>
                                        <input
                                            value={config.name}
                                            onChange={(e) => setDisplayDrafts((current) => current.map((item, idx) => idx === index ? { ...item, name: e.target.value } : item))}
                                            className="admin-settings-input"
                                            style={{ width: 180 }}
                                        />
                                    </div>
                                    <button
                                        className="admin-nav-btn"
                                        type="button"
                                        onClick={() => setDisplayDrafts((current) => current.filter((_, idx) => idx !== index))}
                                        disabled={displayDrafts.length <= 1}
                                        title="Remove display"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <div className="admin-display-config-actions">
                                <button
                                    className="admin-nav-btn"
                                    type="button"
                                    onClick={() => setDisplayDrafts((current) => [
                                        ...current,
                                        { id: `display-${current.length + 1}`, name: `Display ${current.length + 1}` },
                                    ])}
                                >
                                    Add display
                                </button>
                                <button
                                    className="admin-nav-btn"
                                    type="button"
                                    onClick={() => {
                                        updateDisplayConfig(displayDrafts);
                                        setPreviewTab("preview");
                                    }}
                                >
                                    Save
                                </button>
                                <button
                                    className="admin-nav-btn"
                                    type="button"
                                    onClick={() => {
                                        setDisplayDrafts(state.displayConfigs);
                                        setPreviewTab("preview");
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                        <div className="admin-preview-area">
                            {previewTab === "preview" && loadingPreview && <div className="admin-preview-overlay">Loading…</div>}
                            {previewTab === "preview" && !selectedSlide && !loadingPreview && (
                                <div className="admin-preview-overlay">Select a slide to preview</div>
                            )}
                            {previewTab === "live" && !selectedDisplayState && (
                                <div className="admin-preview-overlay">Nothing broadcasting</div>
                            )}
                            <DisplaySlide
                                json={previewTab === "live" ? liveJson : previewJson}
                                bundleMeta={previewTab === "live" ? liveBundleMeta : bundleMeta}
                                autoScale={true}
                                showMissingAssetWarning={true}
                            />
                        </div>

                        <div className="admin-preview-controls">
                            <div className="admin-preview-row admin-preview-row-two-col">
                                <div className="admin-preview-col-left">
                                    {selectedBundle && selectedSlide && (
                                        <Link
                                            href={`/admin/editor?bundle=${encodeURIComponent(selectedBundle)}&slide=${encodeURIComponent(selectedSlide)}`}
                                            className="admin-nav-btn"
                                        >
                                            <Pencil size={13} /> Edit slide
                                        </Link>
                                    )}
                                </div>
                                <div className="admin-preview-col-right">
                                    <label className="admin-label">Slide duration</label>
                                    <input
                                        type="number" min={0} max={3600}
                                        value={slideDurationDraft}
                                        onChange={(e) => setSlideDurationDraft(e.target.value)}
                                        className="toolbar-number-input"
                                        style={{ width: 64 }}
                                        title="Selected slide duration override (blank = use global)"
                                        disabled={!selectedSlide}
                                    />
                                    <span className="admin-label">s</span>
                                    <button
                                        className="admin-nav-btn"
                                        onClick={handleSaveSlideDuration}
                                        disabled={!isSlideDurationDirty}
                                        title="Save selected slide duration"
                                    >Save</button>
                                    {selectedSlide && isSlideDurationDirty && (
                                        <span className="admin-label" style={{ color: "#f59e0b" }}>Unsaved</span>
                                    )}
                                </div>
                            </div>

                        </div>
                        </>
                    )}
                </section>
            </main>

            {/* ── Footer ─────────────────────────────── */}
            <footer className="admin-footer">
                <div className="admin-footer-controls">
                    <button className="admin-foot-btn" onClick={() => navigate(-1)} disabled={slides.length < 2} title="Previous slide">
                        <StepBack size={16} />
                    </button>
                    <button
                        className={`admin-foot-btn ${selectedDisplayIsCycling ? "admin-foot-danger" : "admin-foot-primary"}`}
                        onClick={selectedDisplayIsCycling ? handleStopCycle : handleShowSlide}
                        disabled={selectedDisplayIsCycling
                            ? !connected
                            : !connected || !selectedDisplayBundle || activeBundleSlides.length === 0}
                        title={selectedDisplayIsCycling ? "Pause cycling" : "Show selected slide"}
                    >
                        {state.isCycling ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button className="admin-foot-btn" onClick={() => navigate(1)} disabled={slides.length < 2} title="Next slide">
                        <StepForward size={16} />
                    </button>
                    <div className="admin-footer-sep" />
                    <button className="admin-foot-btn admin-foot-danger" onClick={handleClearSlide} disabled={!selectedDisplayState} title="Blackout">
                        <CircleOff size={16} />
                    </button>
                    <button className="admin-foot-btn" onClick={() => loadBundles()} title="Reload bundles">
                        <RotateCcw size={15} />
                    </button>
                </div>
            </footer>

        </div>
        </>
    );
}
