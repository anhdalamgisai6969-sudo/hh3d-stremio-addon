const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://hoathinh3d.so";

const http = axios.create({
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"
  }
});

function absoluteUrl(url, base = BASE_URL) {
  if (!url) return null;
  try { return new URL(url, base).href; } catch { return null; }
}
function cleanText(text) {
  return text ? text.replace(/\s+/g, " ").trim() : "";
}
function idFromUrl(url) {
  return "hh3d:" + Buffer.from(url).toString("base64url");
}
function decodeMovieId(id) {
  return Buffer.from(id.replace(/^hh3d:/, ""), "base64url").toString("utf8");
}
async function getHTML(url) {
  return (await http.get(url)).data;
}

function parseCards(html) {
  const $ = cheerio.load(html);
  const results = [];
  const seen = new Set();

  $("a").each((_, a) => {
    const el = $(a);
    const href = absoluteUrl(el.attr("href"));
    if (!href || seen.has(href)) return;

    const img = el.find("img").first();
    let name =
      cleanText(el.find("h1,h2,h3,h4,.title,.name").first().text()) ||
      cleanText(el.attr("title")) ||
      cleanText(img.attr("alt")) ||
      cleanText(el.text());

    if (!name || name.length > 150) return;
    if (!/hoathinh3d\.so/.test(href)) return;

    const poster = absoluteUrl(
      img.attr("data-src") || img.attr("data-original") || img.attr("src")
    );

    // Loại link rõ ràng là tập xem trực tiếp khỏi catalog.
    if (/tap-\d+/i.test(href)) return;

    seen.add(href);
    results.push({
      id: idFromUrl(href),
      type: "series",
      name,
      poster
    });
  });
  return results;
}

async function getHome(page = 1) {
  const urls = page === 1
    ? [BASE_URL + "/"]
    : [`${BASE_URL}/page/${page}/`, `${BASE_URL}/trang/${page}/`];

  for (const url of urls) {
    try {
      const items = parseCards(await getHTML(url));
      if (items.length) return items.slice(0, 100);
    } catch (e) {
      console.error("Home failed:", url, e.message);
    }
  }
  return [];
}

async function searchMovies(query) {
  const urls = [
    `${BASE_URL}/?s=${encodeURIComponent(query)}`,
    `${BASE_URL}/search/${encodeURIComponent(query)}`,
    `${BASE_URL}/tim-kiem/${encodeURIComponent(query)}`
  ];

  for (const url of urls) {
    try {
      const items = parseCards(await getHTML(url))
        .filter(x => x.name.toLowerCase().includes(query.toLowerCase()));
      if (items.length) return items.slice(0, 100);
    } catch (e) {}
  }

  const home = await getHome();
  return home.filter(x => x.name.toLowerCase().includes(query.toLowerCase()));
}

async function getMovieMeta(id) {
  const url = decodeMovieId(id);
  const html = await getHTML(url);
  const $ = cheerio.load(html);

  const name =
    cleanText($("h1").first().text()) ||
    cleanText($('meta[property="og:title"]').attr("content")) ||
    "HH3D";

  const description =
    cleanText($(".description,.entry-content,.content").first().text()) ||
    cleanText($('meta[name="description"]').attr("content"));

  const poster = absoluteUrl(
    $('meta[property="og:image"]').attr("content") ||
    $(".poster img").first().attr("src") ||
    $("img").first().attr("src")
  );

  const videos = [];
  const seen = new Set();

  $("a").each((_, a) => {
    const el = $(a);
    const href = absoluteUrl(el.attr("href"));
    if (!href || seen.has(href) || !/tap-\d+|episode/i.test(href)) return;

    seen.add(href);
    const text = cleanText(el.text()) || cleanText(el.attr("title")) || "Tập";
    const match = href.match(/tap-(\d+)/i) || text.match(/(\d+)/);
    const episode = match ? Number(match[1]) : videos.length + 1;

    videos.push({
      id: "hh3d_ep:" + Buffer.from(href).toString("base64url"),
      title: text,
      season: 1,
      episode
    });
  });

  videos.sort((a, b) => a.episode - b.episode);

  if (!videos.length) {
    videos.push({
      id: "hh3d_ep:" + Buffer.from(url).toString("base64url"),
      title: "Xem phim",
      season: 1,
      episode: 1
    });
  }

  return {
    id,
    type: "series",
    name,
    description,
    poster,
    videos
  };
}

function decodeEpisodeId(id) {
  return Buffer.from(id.replace(/^hh3d_ep:/, ""), "base64url").toString("utf8");
}

function findMedia(text) {
  const patterns = [
    /https?:\/\/[^"'\\\s<>]+?\.m3u8[^"'\\\s<>]*/i,
    /https?:\/\/[^"'\\\s<>]+?\.mp4[^"'\\\s<>]*/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].replace(/&amp;/g, "&");
  }
  return null;
}

async function extractVideoUrl(episodeUrl) {
  const html = await getHTML(episodeUrl);
  const $ = cheerio.load(html);

  let src = $("video").attr("src") || $("video source").attr("src") || $("source").attr("src");
  if (src) return absoluteUrl(src, episodeUrl);

  let media = findMedia(html);
  if (media) return media;

  const iframes = [];
  $("iframe").each((_, f) => {
    const src = absoluteUrl($(f).attr("src"), episodeUrl);
    if (src) iframes.push(src);
  });

  for (const iframeUrl of iframes) {
    try {
      const iframeHtml = await getHTML(iframeUrl);
      const iframe$ = cheerio.load(iframeHtml);
      src = iframe$("video").attr("src") || iframe$("source").attr("src");
      if (src) return absoluteUrl(src, iframeUrl);
      media = findMedia(iframeHtml);
      if (media) return media;
    } catch (e) {
      console.error("Iframe failed:", e.message);
    }
  }

  return null;
}

module.exports = {
  getHome,
  searchMovies,
  getMovieMeta,
  decodeEpisodeId,
  extractVideoUrl
};
