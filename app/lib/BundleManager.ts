import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { BundleMeta, BundleSlideEntry } from "../interfaces/BundleMeta";
import { getBundlesDir } from "./paths";

type RawMeta = Record<string, unknown>;

export interface OrderedSlide {
    slide: string;
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
        delete meta.activeSlides;
        return meta;
    }

    getSlideJson(bundle: string, slide: string): object | null {
        const filePath = path.join(this.slidesDir(bundle), this.fileFromSlide(slide));
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
        delete finalMeta.activeSlides;
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
        delete finalMeta.activeSlides;
        this.writeMeta(bundle, finalMeta);
        return finalMeta;
    }

    getOrderedSlideNames(bundle: string, options?: { activeOnly?: boolean }): string[] {
        const slides = this.getMeta(bundle).slides ?? [];
        const activeOnly = options?.activeOnly ?? false;
        return slides
            .filter((entry) => !activeOnly || entry.active !== false)
            .map((entry) => this.slideFromFile(entry.file));
    }

    getOrderedSlides(bundle: string, options?: { activeOnly?: boolean }): OrderedSlide[] {
        const slides = this.getMeta(bundle).slides ?? [];
        const activeOnly = options?.activeOnly ?? false;
        return slides
            .filter((entry) => !activeOnly || entry.active !== false)
            .map((entry) => ({
                slide: this.slideFromFile(entry.file),
                duration: entry.duration,
            }));
    }

    ensureSlideEntry(bundle: string, slide: string): void {
        const meta = this.getMeta(bundle);
        const file = this.fileFromSlide(slide);
        const slides = [...(meta.slides ?? [])];
        const hasEntry = slides.some((entry) => this.normalizeJsonFile(entry.file) === file);
        if (!hasEntry) {
            slides.push({ file, active: true });
            this.writeMeta(bundle, { ...meta, slides });
        }
    }

    removeSlideEntry(bundle: string, slide: string): void {
        const meta = this.getMeta(bundle);
        const file = this.fileFromSlide(slide);
        const slides = (meta.slides ?? []).filter((entry) => this.normalizeJsonFile(entry.file) !== file);
        this.writeMeta(bundle, { ...meta, slides });
    }

    renameSlideEntry(bundle: string, oldSlide: string, newSlide: string): void {
        const meta = this.getMeta(bundle);
        const oldFile = this.fileFromSlide(oldSlide);
        const newFile = this.fileFromSlide(newSlide);
        const slides = (meta.slides ?? []).map((entry) => {
            if (this.normalizeJsonFile(entry.file) === oldFile) {
                return { ...entry, file: newFile };
            }
            return entry;
        });
        this.writeMeta(bundle, { ...meta, slides });
    }

    private bundleDir(bundle: string): string {
        return path.join(getBundlesDir(), bundle);
    }

    private slidesDir(bundle: string): string {
        return path.join(this.bundleDir(bundle), "slides");
    }

    private metaPath(bundle: string): string {
        return path.join(this.bundleDir(bundle), "bundle.json");
    }

    private listSlideFiles(bundle: string): string[] {
        const dir = this.slidesDir(bundle);
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
        const cleanMeta = { ...meta } as BundleMeta & { activeSlides?: unknown };
        delete cleanMeta.activeSlides;
        writeFileSync(this.metaPath(bundle), JSON.stringify(cleanMeta, null, 2), "utf8");
    }

    private buildSlidesFromMeta(bundle: string, rawMeta: RawMeta): BundleSlideEntry[] {
        const allFiles = this.listSlideFiles(bundle);
        const allSet = new Set(allFiles);
        const slidesFromMeta = this.parseSlidesArray(rawMeta.slides, allSet);
        if (slidesFromMeta.length > 0) {
            const known = new Set(slidesFromMeta.map((entry) => entry.file));
            const rest = allFiles
                .filter((file) => !known.has(file))
                .map((file) => ({ file, active: true }));
            return [...slidesFromMeta, ...rest];
        }

        const activeSlides = this.parseActiveSlides(rawMeta.activeSlides, allSet);
        if (activeSlides.length > 0) {
            const activeSet = new Set(activeSlides);
            const inactive = allFiles
                .filter((file) => !activeSet.has(file))
                .map((file) => ({ file, active: false }));
            return [
                ...activeSlides.map((file) => ({ file, active: true })),
                ...inactive,
            ];
        }

        return allFiles.map((file) => ({ file, active: true }));
    }

    private parseSlidesArray(value: unknown, allSet: Set<string>): BundleSlideEntry[] {
        if (!Array.isArray(value)) return [];
        const result: BundleSlideEntry[] = [];
        const seen = new Set<string>();

        for (const candidate of value) {
            if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
            const fileRaw = (candidate as { file?: unknown }).file;
            if (typeof fileRaw !== "string") continue;
            const file = this.normalizeJsonFile(fileRaw);
            if (!allSet.has(file) || seen.has(file)) continue;

            const activeRaw = (candidate as { active?: unknown }).active;
            const durationRaw = (candidate as { duration?: unknown }).duration;
            const entry: BundleSlideEntry = {
                file,
                active: typeof activeRaw === "boolean" ? activeRaw : true,
            };
            if (typeof durationRaw === "number" && Number.isFinite(durationRaw) && durationRaw >= 0) {
                entry.duration = durationRaw;
            }

            result.push(entry);
            seen.add(file);
        }

        return result;
    }

    private parseActiveSlides(value: unknown, allSet: Set<string>): string[] {
        if (!Array.isArray(value)) return [];
        const result: string[] = [];
        const seen = new Set<string>();

        for (const slide of value) {
            if (typeof slide !== "string") continue;
            const file = this.normalizeJsonFile(slide);
            if (!allSet.has(file) || seen.has(file)) continue;
            seen.add(file);
            result.push(file);
        }

        return result;
    }

    private normalizeJsonFile(name: string): string {
        return name.endsWith(".json") ? name : `${name}.json`;
    }

    private fileFromSlide(slide: string): string {
        return this.normalizeJsonFile(slide);
    }

    private slideFromFile(file: string): string {
        return file.endsWith(".json") ? file.slice(0, -5) : file;
    }
}

export const bundleManager = new BundleManager();