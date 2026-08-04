export type TransitionType =
    | "none"
    | "fade"
    | "slide-left"
    | "slide-right"
    | "slide-up"
    | "slide-down"
    | "zoom";

export interface TransitionConfig {
    type: TransitionType;
    duration: number; // ms
}

export const TRANSITION_TYPES: { value: TransitionType; label: string }[] = [
    { value: "none", label: "None (instant cut)" },
    { value: "fade", label: "Fade" },
    { value: "slide-left", label: "Slide left" },
    { value: "slide-right", label: "Slide right" },
    { value: "slide-up", label: "Slide up" },
    { value: "slide-down", label: "Slide down" },
    { value: "zoom", label: "Zoom" },
];

export const DEFAULT_TRANSITION: TransitionConfig = { type: "none", duration: 600 };

export function resolveTransition(
    override: Partial<TransitionConfig> | undefined | null,
    fallback: Partial<TransitionConfig> | undefined | null,
): TransitionConfig {
    const type = override?.type ?? fallback?.type ?? DEFAULT_TRANSITION.type;
    const duration = override?.duration ?? fallback?.duration ?? DEFAULT_TRANSITION.duration;
    return { type, duration };
}
