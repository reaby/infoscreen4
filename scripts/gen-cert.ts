// Creates a local certificate authority (once) and a server certificate signed by it,
// in the data directory.
//
// Browsers only cache files (videos, images, fonts) from HTTPS sites whose certificate
// they trust. A bare self-signed certificate is never trusted, so every slide change
// downloads its media again. Install ca.pem as a trusted root on each display machine
// once; server certificates can then be regenerated without touching the displays.
//
// Usage: tsx scripts/gen-cert.ts [--if-missing] [extra-hostname-or-ip ...]
//        (extra names can also be given as CERT_HOSTS="name1,10.0.0.5")
//   --if-missing  do nothing when a server certificate already exists, or when
//                 DISABLE_HTTPS is set (container start-up)

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { hostname, networkInterfaces, tmpdir } from "node:os";
import path from "node:path";
import { getTlsFiles, isHttpsDisabled, type TlsFiles } from "../app/lib/tlsFiles";

const CA_VALIDITY_DAYS = 3650;
const SERVER_VALIDITY_DAYS = 825; // the longest validity Apple devices accept

function openssl(...args: string[]): void {
    try {
        execFileSync("openssl", args, { stdio: "pipe" }); // silences key-generation progress output
    } catch (error) {
        const { stderr, code } = error as { stderr?: Buffer; code?: string };
        if (stderr) process.stderr.write(stderr);
        throw new Error(`openssl ${args[0]} failed${code === "ENOENT" ? ": openssl is not installed or not on PATH" : ""}`);
    }
}

function lanAddresses(): string[] {
    return Object.values(networkInterfaces())
        .flat()
        .filter((iface) => iface && !iface.internal && iface.family === "IPv4")
        .map((iface) => iface!.address);
}

function certificateNames(extraNames: string[]): string[] {
    const fromEnv = (process.env.CERT_HOSTS ?? "").split(",");
    const extra = [...extraNames, ...fromEnv].map((name) => name.trim()).filter(Boolean);
    const host = hostname();
    return [...new Set(["localhost", "127.0.0.1", "::1", host, `${host}.local`, ...lanAddresses(), ...extra])];
}

function subjectAltName(names: string[]): string {
    return names.map((name) => (isIP(name) ? `IP:${name}` : `DNS:${name}`)).join(",");
}

/** Returns true when a new authority was created. */
function ensureCertificateAuthority(files: TlsFiles): boolean {
    if (existsSync(files.ca) && existsSync(files.caKey)) {
        console.log(`Using the existing certificate authority (${display(files.ca)}).`);
        return false;
    }
    openssl(
        "req", "-x509", "-new", "-newkey", "rsa:2048", "-nodes", "-sha256",
        "-keyout", files.caKey, "-out", files.ca, "-days", String(CA_VALIDITY_DAYS),
        "-subj", "/CN=Infoscreen4 Local CA",
        "-addext", "basicConstraints=critical,CA:TRUE",
        "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    );
    console.log(`Created a new certificate authority: ${display(files.ca)} (+ private key ${display(files.caKey)}).`);
    return true;
}

function createServerCertificate(files: TlsFiles, names: string[]): void {
    const workDir = mkdtempSync(path.join(tmpdir(), "infoscreen-cert-"));
    try {
        const csr = path.join(workDir, "server.csr");
        const extensions = path.join(workDir, "server.ext");
        writeFileSync(extensions, [
            "basicConstraints=CA:FALSE",
            "keyUsage=critical,digitalSignature,keyEncipherment",
            "extendedKeyUsage=serverAuth",
            `subjectAltName=${subjectAltName(names)}`,
        ].join("\n"));

        openssl(
            "req", "-new", "-newkey", "rsa:2048", "-nodes", "-sha256",
            "-keyout", files.key, "-out", csr, "-subj", `/CN=${hostname()}`,
        );
        openssl(
            "x509", "-req", "-in", csr, "-sha256",
            "-CA", files.ca, "-CAkey", files.caKey, "-set_serial", `0x${randomBytes(16).toString("hex")}`,
            "-out", files.cert, "-days", String(SERVER_VALIDITY_DAYS), "-extfile", extensions,
        );
    } finally {
        rmSync(workDir, { recursive: true, force: true });
    }
}

function display(file: string): string {
    return path.relative(process.cwd(), file) || file;
}

function main(): void {
    // The server reads .env (INFOSCREEN_DATA_DIR, CERT_HOSTS...), so the certificate must land where it looks.
    if (existsSync(".env")) process.loadEnvFile(".env");

    const args = process.argv.slice(2);
    const ifMissing = args.includes("--if-missing");
    const extraNames = args.filter((arg) => !arg.startsWith("--"));
    const files = getTlsFiles();

    if (ifMissing && isHttpsDisabled()) {
        console.log("HTTPS is disabled (DISABLE_HTTPS); not generating a certificate.");
        return;
    }
    if (ifMissing && existsSync(files.key) && existsSync(files.cert)) {
        console.log(`TLS certificate found (${display(files.cert)}); not generating a new one.`);
        return;
    }

    mkdirSync(path.dirname(files.cert), { recursive: true });
    const names = certificateNames(extraNames);
    const caCreated = ensureCertificateAuthority(files);
    createServerCertificate(files, names);

    console.log(`Created ${display(files.cert)} + ${display(files.key)}, valid for:\n  ${names.join("\n  ")}`);
    console.log([
        "",
        caCreated
            ? `Next: install ${display(files.ca)} as a trusted root certificate on every display and admin machine.`
            : `Machines that already trust ${display(files.ca)} accept the new certificate as-is.`,
        `  Windows (Edge/Chrome): certutil -addstore -user Root ${display(files.ca)}`,
        "  Firefox: Settings → Certificates → Authorities → Import",
        `Keep ${display(files.caKey)} private: anyone holding it can create certificates your displays trust.`,
        "Re-run this script when the server's hostname or IP address changes.",
    ].join("\n"));
}

main();
