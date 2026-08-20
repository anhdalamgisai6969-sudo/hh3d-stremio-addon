const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const {
  getHome, searchMovies, getMovieMeta,
  decodeEpisodeId, extractVideoUrl
} = require("./scraper");

const manifest = {
  id: "org.yentran.hh3d",
  version: "1.0.0",
  name: "HH3D",
  description: "Xem hoạt hình từ nguồn HH3D",
  resources: ["catalog", "meta", "stream"],
  types: ["series"],
  idPrefixes: ["hh3d:"],
  catalogs: [{
    type: "series",
    id: "hh3d",
    name: "Hoạt hình 3D",
    extra: [{ name: "search", isRequired: false }, { name: "skip", isRequired: false }]
  }]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ extra = {} }) => {
  try {
    if (extra.search) return { metas: await searchMovies(extra.search) };
    const page = Math.floor(Number(extra.skip || 0) / 100) + 1;
    return { metas: await getHome(page) };
  } catch (e) {
    console.error("Catalog error:", e.message);
    return { metas: [] };
  }
});

builder.defineMetaHandler(async ({ id }) => {
  try {
    return { meta: await getMovieMeta(id) };
  } catch (e) {
    console.error("Meta error:", e.message);
    return { meta: null };
  }
});

builder.defineStreamHandler(async ({ id }) => {
  try {
    if (!id.startsWith("hh3d_ep:")) return { streams: [] };
    const episodeUrl = decodeEpisodeId(id);
    const videoUrl = await extractVideoUrl(episodeUrl);
    if (!videoUrl) return { streams: [] };
    return {
      streams: [{
        name: "HH3D",
        title: "HH3D - Direct Stream",
        url: videoUrl
      }]
    };
  } catch (e) {
    console.error("Stream error:", e.message);
    return { streams: [] };
  }
});

const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`HH3D addon: http://127.0.0.1:${PORT}/manifest.json`);
