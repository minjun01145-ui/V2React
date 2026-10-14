import assert from "node:assert/strict";
import { findSlideImage, imageCreditText, isCommerciallyUsableLicense, parseCommonsResults } from "../src/slide-assistant/imageSearch.ts";

/** A Commons search page as the API returns it, including the licence metadata of one file. */
function page(title: string, license: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    index: extra.index ?? 1,
    title,
    imageinfo: [{
      mime: extra.mime ?? "image/jpeg",
      thumburl: extra.thumburl ?? "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Bus.jpg/1280px-Bus.jpg",
      descriptionurl: "https://commons.wikimedia.org/wiki/File:Bus.jpg",
      extmetadata: {
        LicenseShortName: { value: license },
        LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" },
        Artist: { value: '<a href="https://example.org">사진가</a>' },
      },
    }],
  };
}

function search(...pages: readonly Record<string, unknown>[]): unknown {
  return { query: { pages: Object.fromEntries(pages.map((item, index) => [`p${index}`, item])) } };
}

// ---- licence filter: only commercially reusable licences are kept ----

for (const license of ["CC0", "CC BY 4.0", "CC BY-SA 4.0", "Public domain", "Attribution", "No restrictions"]) {
  assert.ok(isCommerciallyUsableLicense(license), `${license} may be reused commercially`);
}
for (const license of ["", "CC BY-NC 4.0", "CC BY-NC-SA 3.0", "CC BY-ND 2.0", "GFDL 1.2", "Fair use", "NonCommercial"]) {
  assert.ok(!isCommerciallyUsableLicense(license), `${license} must not be offered`);
}

// ---- response parsing: hosts, types and licences are checked field by field ----

const parsed = parseCommonsResults(search(
  page("File:Bus.jpg", "CC BY-SA 4.0", { index: 2 }),
  page("File:Cat.jpg", "CC BY-NC 4.0", { index: 1, thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Cat.jpg/1280px-Cat.jpg" }),
  page("File:Tracked.svg", "CC0", { index: 3, mime: "image/svg+xml" }),
  page("File:Elsewhere.jpg", "CC0", { index: 4, thumburl: "https://example.com/Elsewhere.jpg" }),
  page("File:Bus 2.jpg", "Public domain", { index: 5, thumburl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cc/Bus_2.jpg/1280px-Bus_2.jpg" }),
));
assert.equal(parsed.length, 2, "non-commercial, unrenderable, off-host and SVG files are skipped");
assert.equal(parsed[0]!.license, "CC BY-SA 4.0");
assert.equal(parsed[0]!.creator, "사진가", "the artist name is stripped of its HTML");
assert.equal(parsed[0]!.licenseUrl, "https://creativecommons.org/licenses/by-sa/4.0");
assert.equal(parsed[1]!.url.endsWith("Bus_2.jpg/1280px-Bus_2.jpg"), true);
assert.deepEqual(parseCommonsResults({}), [], "an unexpected shape yields no candidates");
assert.deepEqual(parseCommonsResults(null), []);
assert.deepEqual(parseCommonsResults({ query: { pages: { a: { imageinfo: [{ mime: "image/jpeg" }] } } } }), [], "a missing thumbnail is skipped");
const untitled = page("File:No author.jpg", "CC0");
const info = (untitled.imageinfo as Record<string, unknown>[])[0]!;
info.extmetadata = { LicenseShortName: { value: "CC0" } };
assert.equal(parseCommonsResults(search(untitled))[0]!.creator, "No author.jpg", "without an artist the file name is used");

assert.equal(imageCreditText({ source: "Wikimedia Commons", creator: "사진가", license: "CC BY-SA 4.0", licenseUrl: "", pageUrl: "" }),
  "사진가 · CC BY-SA 4.0 · Wikimedia Commons");

// ---- search: the request and the failures before the picture is decoded ----

const requests: string[] = [];
const empty = async (input: string | URL | Request): Promise<Response> => {
  requests.push(String(input));
  return new Response(JSON.stringify({ query: { pages: {} } }), { status: 200 });
};
await assert.rejects(() => findSlideImage("버스", empty), /찾지 못했/, "a search without a usable picture reports it");
assert.match(requests[0]!, /gsrsearch=.*filetype%3Abitmap/, "the search stays inside bitmap files");
assert.match(requests[0]!, /origin=\*/, "the browser request is a CORS request");
await assert.rejects(() => findSlideImage("   ", empty), /검색어/, "an empty query is refused before any request");

const notAnImage = async (input: string | URL | Request): Promise<Response> => String(input).includes("api.php")
  ? new Response(JSON.stringify(search(page("File:Bus.jpg", "CC0"))), { status: 200 })
  : new Response("nope", { status: 200, headers: { "content-type": "text/html" } });
await assert.rejects(() => findSlideImage("bus", notAnImage), /내려받지 못했/, "a download that is not an image is refused");

const tooBig = async (input: string | URL | Request): Promise<Response> => String(input).includes("api.php")
  ? new Response(JSON.stringify(search(page("File:Bus.jpg", "CC0"))), { status: 200 })
  : new Response(new Uint8Array(13 * 1024 * 1024), { status: 200, headers: { "content-type": "image/jpeg", "content-length": String(13 * 1024 * 1024) } });
await assert.rejects(() => findSlideImage("bus", tooBig), /너무 커서/, "an oversized download is refused");

const failedSearch = async (): Promise<Response> => new Response("busy", { status: 503 });
await assert.rejects(() => findSlideImage("bus", failedSearch), /검색하지 못했/);

console.log("image search tests passed");
