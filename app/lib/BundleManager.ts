import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { BundleMeta, BundleSlideEntry } from "../interfaces/BundleMeta";
import { getBundlesDir, getSlidesDir } from "./paths";
import { TRANSITION_TYPES, TransitionConfig } from "./transitions";
import { SlideSchedule, isSlideScheduledNow, isValidTimeOfDay } from "./schedule";

const VALID_TRANSITION_TYPES = new Set(TRANSITION_TYPES.map((t) => t.value));

function parseTransition(value: unknown): TransitionConfig | undefined {
    if (!value || typeof value !== "object") return undefined;
    const type = (value as any).type;
    const duration = (value as any).duration;
    if (typeof type !== "string" || !VALID_TRANSITION_TYPES.has(type as TransitionConfig["type"])) return undefined;
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) return undefined;
    return { type: type as TransitionConfig["type"], duration };
}

function isValidIsoDate(value: unknown): value is string {
    return typeof value === "string" && value !== "" && !Number.isNaN(new Date(value).getTime());
}

function parseSchedule(value: unknown): SlideSchedule | undefined {
    if (!value || typeof value !== "object") return undefined;
    const mode = (value as any).mode;

    if (mode === "daily") {
        const dailyStart = (value as any).dailyStart;
        const dailyEnd = (value as any).dailyEnd;
        if (!isValidTimeOfDay(dailyStart) || !isValidTimeOfDay(dailyEnd)) return undefined;
        return { mode: "daily", dailyStart, dailyEnd };
    }

    const startRaw = (value as any).start;
    const endRaw = (value as any).end;
    const start = isValidIsoDate(startRaw) ? startRaw : undefined;
    const end = isValidIsoDate(endRaw) ? endRaw : undefined;
    if (!start && !end) return undefined;
    return { mode: "range", ...(start ? { start } : {}), ...(end ? { end } : {}) };
}

type RawMeta = Record<string, unknown>;

export interface OrderedSlide {
    id: string;
    duration?: number;
}

export class BundleManager {
    constructor() {}

    getMeta(bundle: string): BundleMeta {
        const raw = this.readRawMeta(bundle);
        const slides = this.buildSlidesFromMeta(bundle, raw);
        const meta = {
            ...raw,
            slides,
        } as BundleMeta;
        return meta;
    }

    getSlideJson(bundle: string, data: string): object | null {
        const filePath = this.slideFilePath(data);
        try {
            return JSON.parse(readFileSync(filePath, "utf8")) as object;
        } catch {
            return null;
        }
    }

    patchMeta(bundle: string, patch: Partial<BundleMeta>): BundleMeta {
        const existing = this.readRawMeta(bundle);
        const merged = { ...existing, ...patch } as RawMeta;
        const slides = this.buildSlidesFromMeta(bundle, merged);
        const finalMeta: BundleMeta = {
            ...(merged as BundleMeta),
            slides,
        };
        this.writeMeta(bundle, finalMeta);
        return finalMeta;
    }

    replaceMeta(bundle: string, next: Partial<BundleMeta>): BundleMeta {
        const replaced = { ...(next as RawMeta) };
        const slides = this.buildSlidesFromMeta(bundle, replaced);
        const finalMeta: BundleMeta = {
            ...(replaced as BundleMeta),
            slides,
        };
        this.writeMeta(bundle, finalMeta);
        return finalMeta;
    }

    getOrderedSlideNames(bundle: string, options?: { activeOnly?: boolean }): string[] {
        const slides = this.getMeta(bundle).slides ?? [];
        const activeOnly = options?.activeOnly ?? false;
        const now = new Date();
        return slides
            .filter((entry) => !activeOnly || (entry.active !== false && isSlideScheduledNow(entry.schedule, now)))
            .map((entry) => entry.id);
    }

    getOrderedSlides(bundle: string, options?: { activeOnly?: boolean }): OrderedSlide[] {
        const slides = this.getMeta(bundle).slides ?? [];
        const activeOnly = options?.activeOnly ?? false;
        const now = new Date();
        return slides
            .filter((entry) => !activeOnly || (entry.active !== false && isSlideScheduledNow(entry.schedule, now)))
            .map((entry) => ({
                id: entry.id,
                duration: entry.duration,
            }));
    }

    ensureSlideEntry(bundle: string, type: "fabric" | "website", data: string, title?: string, id?: string): string {
        const meta = this.getMeta(bundle);
        const slides = [...(meta.slides ?? [])];

        let existingId: string | undefined;
        if (type === "fabric") {
            const fileData = this.normalizeJsonFile(data);
            const existing = slides.find(s => s.type === "fabric" && this.normalizeJsonFile(s.data) === fileData);
            if (existing) existingId = existing.id;
        } else {
            const existing = slides.find(s => s.type === "website" && s.data === data);
            if (existing) existingId = existing.id;
        }

        if (existingId) return existingId;

        const entryId = id ? id : Date.now().toString();
        const newEntry: BundleSlideEntry = {
            id: entryId,
            type,
            data: type === "fabric" ? this.normalizeJsonFile(data) : data,
            active: true,
        };
        if (title) {
            newEntry.title = title;
        }

        slides.push(newEntry);
        this.writeMeta(bundle, { ...meta, slides });
        return entryId;
    }

    removeSlideEntry(bundle: string, id: string): void {
        const meta = this.getMeta(bundle);
        const slides = (meta.slides ?? []).filter((entry) => entry.id !== id);
        this.writeMeta(bundle, { ...meta, slides });
    }

    renameSlideEntry(bundle: string, id: string, newData?: string, newId?: string): void {
        const meta = this.getMeta(bundle);
        const slides = (meta.slides ?? []).map((entry) => {
            if (entry.id === id) {
                return {
                    ...entry,
                    ...(newData ? { data: entry.type === "fabric" ? this.normalizeJsonFile(newData) : newData } : {}),
                    ...(newId ? { id: newId } : {})
                };
            }
            return entry;
        });
        this.writeMeta(bundle, { ...meta, slides });
    }

    private bundleDir(bundle: string): string {
        return path.join(getBundlesDir(), bundle);
    }

    private slidesDir(): string {
        return path.join(getSlidesDir());
    }

    private slideFilePath(data: string): string {
        return path.join(this.slidesDir(), this.normalizeJsonFile(data));
    }

    private metaPath(bundle: string): string {
        return path.join(this.bundleDir(bundle), "bundle.json");
    }

    public normalizeJsonFile(filename: string): string {
        return filename.endsWith(".json") ? filename : `${filename}.json`;
    }

    private listGlobalSlideFiles(): string[] {
        const dir = this.slidesDir();
        if (!existsSync(dir)) return [];
        return readdirSync(dir)
            .filter((file) => file.endsWith(".json"))
            .sort((a, b) => a.localeCompare(b));
    }

    private readRawMeta(bundle: string): RawMeta {
        try {
            return JSON.parse(readFileSync(this.metaPath(bundle), "utf8")) as RawMeta;
        } catch {
            return {};
        }
    }

    private writeMeta(bundle: string, meta: BundleMeta): void {
        mkdirSync(this.bundleDir(bundle), { recursive: true });
        writeFileSync(this.metaPath(bundle), JSON.stringify(meta, null, 2), "utf8");
    }

    private buildSlidesFromMeta(bundle: string, rawMeta: RawMeta): BundleSlideEntry[] {
        return this.parseSlidesArray(rawMeta.slides);
    }

    private parseSlidesArray(value: unknown): BundleSlideEntry[] {
        if (!Array.isArray(value)) return [];
        const result: BundleSlideEntry[] = [];
        const seen = new Set<string>();

        for (const candidate of value) {
            if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;

            const id = (candidate as any).id;
            const type = (candidate as any).type;
            const data = (candidate as any).data;
            const title = (candidate as any).title;

            if (typeof id !== "string" || !id) continue;
            if (type !== "fabric" && type !== "website" && type !== "video") continue;
            if (typeof data !== "string" || !data) continue;

            if (seen.has(id)) continue;

            const activeRaw = (candidate as any).active;
            const durationRaw = (candidate as any).duration;
            const videoDurationRaw = (candidate as any).videoDuration;

            const entry: BundleSlideEntry = {
                id,
                type,
                data: type === "fabric" ? this.normalizeJsonFile(data) : data,
                title: typeof title === "string" ? title : undefined,
                active: typeof activeRaw === "boolean" ? activeRaw : true,
            };
            if (typeof durationRaw === "number" && Number.isFinite(durationRaw) && durationRaw >= 0) {
                entry.duration = durationRaw;
            }
            if (typeof videoDurationRaw === "number" && Number.isFinite(videoDurationRaw) && videoDurationRaw >= 0) {
                entry.videoDuration = videoDurationRaw;
            }
            const transition = parseTransition((candidate as any).transition);
            if (transition) {
                entry.transition = transition;
            }
            const schedule = parseSchedule((candidate as any).schedule);
            if (schedule) {
                entry.schedule = schedule;
            }

            result.push(entry);
            seen.add(id);
        }

        return result;
    }
}

export const bundleManager = new BundleManager();
