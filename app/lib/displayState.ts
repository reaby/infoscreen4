import fs from "fs";
import path from "path";

export interface DisplayConfig {
    id: string;
    name: string;
}

const file = path.join(process.cwd(), "data", "display.json");

function readDisplayConfigs(): DisplayConfig[] {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([{ id: "display-1", name: "Display 1" }], null, 2), "utf8");
    }
    try {
        return JSON.parse(fs.readFileSync(file, "utf8")) as DisplayConfig[];
    } catch {
        return [{ id: "display-1", name: "Display 1" }];
    }
}

export function getDisplayConfigs(): DisplayConfig[] {
    return readDisplayConfigs();
}

export function setDisplayConfigs(configs: DisplayConfig[]) {
    fs.writeFileSync(file, JSON.stringify(configs, null, 2), "utf8");
}

export function ensureDisplayId(displayId: string): string {
    const configs = readDisplayConfigs();
    if (configs.some((conf) => conf.id === displayId)) return displayId;
    return configs[0]?.id ?? "display-1";
}
