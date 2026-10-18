import { createReadStream } from "fs";
import { Readable } from "stream";

/**
 * Streams a file (or the inclusive byte range start..end of it) as a response body.
 * Only a small chunk is held in memory at a time, and the read stops when the
 * client cancels — browsers routinely abort open-ended video range requests.
 */
export function streamFile(filePath: string, start?: number, end?: number): ReadableStream<Uint8Array> {
    return Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream<Uint8Array>;
}
