import path from "path";
import { getDataDir } from "./paths";

export interface TlsFiles {
    key: string;   // server private key
    cert: string;  // server certificate
    ca: string;    // local certificate authority that signs `cert`; displays trust this
    caKey: string; // the authority's private key
}

/**
 * Where `pnpm run gen-cert` writes its files: the data directory, which Docker mounts
 * as a volume, so certificates (and the authority displays trust) survive rebuilds.
 */
export function getTlsFiles(): TlsFiles {
    const dir = getDataDir();
    return {
        key: path.join(dir, "key.pem"),
        cert: path.join(dir, "cert.pem"),
        ca: path.join(dir, "ca.pem"),
        caKey: path.join(dir, "ca-key.pem"),
    };
}

/** The key and certificate the server uses: SSL_KEY / SSL_CERT, else the data directory. */
export function resolveServerTlsFiles(): Pick<TlsFiles, "key" | "cert"> {
    const defaults = getTlsFiles();
    return {
        key: process.env.SSL_KEY ?? defaults.key,
        cert: process.env.SSL_CERT ?? defaults.cert,
    };
}
