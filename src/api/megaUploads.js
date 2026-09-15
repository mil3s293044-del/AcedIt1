/**
 * megaUploads — the client half of "store a textbook, read a chapter".
 *
 * Two direct calls to the local server rather than entries in the functions
 * shim, for one reason each:
 *
 *   - **The upload is multipart**, and the shim speaks JSON. It is the same
 *     shape `/local-ai/uploadFile` already takes, on its own endpoint because
 *     the two have different multer configurations — a 100 MB book goes to
 *     DISK on the server and a 7 MB photo does not need to.
 *   - **The list is a GET** and returns nothing that belongs in the read cache:
 *     it is about storage rather than about a table, and `readCache`'s
 *     invalidation is keyed on tables.
 *
 * THE HANDLE CARRIES NO PATH AND NO EMAIL. `mega-file://<uuid>` is all the
 * client ever holds; the bucket key, which contains the owner, is assembled
 * server-side and checked on every read. A handle lifted out of somebody's
 * network tab resolves to nothing in another student's session.
 */
import { supabase } from "@/api/supabaseClient";
import { megaReason } from "@/lib/megaUpload";

async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("Sign in to upload a book.");
    return { Authorization: `Bearer ${token}` };
}

/**
 * Store one book.
 *
 * Refused on the CLIENT first where the reason is knowable there — a 200 MB
 * file has no business travelling over school wifi just to be told no at the
 * other end. `megaReason` is the same rule the server applies.
 */
export async function uploadMega(file, { onProgress } = {}) {
    const bad = megaReason(file);
    if (bad) throw new Error(bad);

    const headers = await authHeader();
    const body = new FormData();
    body.append("file", file);

    // XHR rather than fetch, because a 100 MB upload on school wifi needs a
    // progress bar and `fetch` has no upload progress event. Everything else
    // in the app uses fetch; this is the one place that genuinely cannot.
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/local-ai/uploadMega");
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress?.(e.loaded / e.total);
        };
        xhr.onload = () => {
            let json = {};
            try { json = JSON.parse(xhr.responseText || "{}"); } catch { /* handled below */ }
            if (xhr.status >= 200 && xhr.status < 300 && json.file_url) resolve(json);
            // The server's own message when it gave one: every refusal there
            // names the file, the size and the limit.
            else reject(new Error(json.message || "That book couldn't be uploaded."));
        };
        xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
        xhr.ontimeout = () => reject(new Error("The upload timed out."));
        xhr.send(body);
    });
}

/** Every book this student has stored, newest first. */
export async function listMega() {
    const headers = await authHeader();
    const r = await fetch("/local-ai/megaFiles", { headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || "Couldn't load your books.");
    return j;
}

/**
 * The `file_url` a generate call sends.
 *
 * The range rides in the FRAGMENT, so one stored book answers chapter 7 today
 * and chapter 9 next week without being uploaded twice. A handle with no
 * fragment reads ONE page on the server rather than the whole book — the safe
 * direction, since the other one spends a term's chips by accident.
 */
export const megaUrl = (handle, from, to) => `${handle}#${from}-${to}`;
