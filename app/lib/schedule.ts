export interface SlideScheduleRange {
    mode: "range";
    start?: string; // ISO datetime string
    end?: string;   // ISO datetime string
}

export interface SlideScheduleDaily {
    mode: "daily";
    dailyStart: string; // "HH:MM", 24h, local time
    dailyEnd: string;   // "HH:MM", 24h, local time — if earlier than dailyStart, wraps past midnight
}

export type SlideSchedule = SlideScheduleRange | SlideScheduleDaily;

export function isValidTimeOfDay(value: unknown): value is string {
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isSlideScheduledNow(schedule: SlideSchedule | undefined, now: Date): boolean {
    if (!schedule) return true;

    if (schedule.mode === "daily") {
        const [startH, startM] = schedule.dailyStart.split(":").map(Number);
        const [endH, endM] = schedule.dailyEnd.split(":").map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (startMinutes === endMinutes) return true; // full 24h window
        if (startMinutes < endMinutes) {
            return nowMinutes >= startMinutes && nowMinutes < endMinutes;
        }
        // Window wraps past midnight, e.g. 22:00-06:00
        return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }

    if (schedule.start && now.getTime() < new Date(schedule.start).getTime()) return false;
    if (schedule.end && now.getTime() > new Date(schedule.end).getTime()) return false;
    return true;
}
