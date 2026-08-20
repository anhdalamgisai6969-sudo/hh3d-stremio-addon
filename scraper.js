const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://hoathinh3d.so";

const http = axios.create({
    timeout: 30000,
    maxRedirects: 5,
    headers: {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/130.0.0.0 Safari/537.36",

        "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

        "Accept-Language":
            "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
    }
});


/* =========================================
   HÀM CƠ BẢN
========================================= */

function cleanText(text) {
    if (!text) return "";

    return String(text)
        .replace(/\s+/g, " ")
        .replace(/\n/g, " ")
        .trim();
}


function absoluteUrl(url, base = BASE_URL) {

    if (!url) return null;

    try {
        return new URL(url, base).href;
    } catch {
        return null;
    }

}


async function getHTML(url) {

    console.log("Fetching:", url);

    const response = await http.get(url);

    return response.data;
}


/* =========================================
   ID PHIM
========================================= */

function idFromUrl(url) {

    return "hh3d:" +
        Buffer
            .from(url)
            .toString("base64url");

}


function urlFromId(id) {

    try {

        return Buffer
            .from(
                id.replace(/^hh3d:/, ""),
                "base64url"
            )
            .toString("utf8");

    } catch {

        return null;

    }

}


/* =========================================
   ID TẬP
========================================= */

function episodeIdFromUrl(url) {

    return "hh3d_ep:" +
        Buffer
            .from(url)
            .toString("base64url");

}


function decodeEpisodeId(id) {

    try {

        return Buffer
            .from(
                id.replace(/^hh3d_ep:/, ""),
                "base64url"
            )
            .toString("utf8");

    } catch {

        return null;

    }

}


/* =========================================
   KIỂM TRA LINK CÓ PHẢI LINK PHIM
========================================= */

function isValidMovieUrl(url) {

    if (!url) return false;

    try {

        const u = new URL(url);

        if (
            !u.hostname.includes("hoathinh3d")
        ) {
            return false;
        }


        const path =
            u.pathname.toLowerCase();


        /*
           Loại bỏ các trang không phải phim
        */

        const blocked = [

            "login",
            "register",
            "history",
            "bookmark",
            "follow",
            "category",
            "genre",
            "tag",
            "search",
            "tim-kiem",
            "sitemap",
            "privacy",
            "terms",
            "contact",
            "schedule"

        ];


        if (
            blocked.some(
                item => path.includes(item)
            )
        ) {
            return false;
        }


        /*
           Link trang chủ
        */

        if (
            path === "/" ||
            path === ""
        ) {
            return false;
        }


        return true;

    } catch {

        return false;

    }

}


/* =========================================
   KIỂM TRA LINK TẬP
========================================= */

function isEpisodeUrl(url) {

    if (!url) return false;

    const lower =
        url.toLowerCase();


    return (

        /tap-\d+/i.test(lower) ||

        /episode[-_/]?\d+/i.test(lower) ||

        /xem-phim/i.test(lower) ||

        /watch/i.test(lower)

    );

}


/* =========================================
   LẤY POSTER
========================================= */

function getPoster($, element) {

    const el = $(element);

    const img =
        el.find("img").first();


    let poster =

        img.attr("data-src") ||

        img.attr("data-lazy-src") ||

        img.attr("data-original") ||

        img.attr("src") ||

        img.attr("srcset");


    if (!poster) return null;


    /*
       srcset có thể chứa nhiều URL
    */

    if (
        poster.includes(",")
    ) {

        poster =
            poster
                .split(",")[0]
                .trim()
                .split(" ")[0];

    }


    return absoluteUrl(poster);

}


/* =========================================
   LẤY TÊN PHIM
========================================= */

function getTitle($, element) {

    const el = $(element);


    const selectors = [

        "h1",
        "h2",
        "h3",
        "h4",

        ".title",
        ".name",
        ".film-name",
        ".movie-title",

        "[data-title]"

    ];


    for (
        const selector of selectors
    ) {

        const item =
            el.find(selector).first();


        let text =
            cleanText(item.text());


        if (!text) {

            text =
                cleanText(
                    item.attr("data-title")
                );

        }


        if (text) {

            return text;

        }

    }


    /*
       fallback
    */

    let title =
        cleanText(
            el.attr("title")
        );


    if (title) {

        return title;

    }


    title =
        cleanText(
            el.find("img")
                .first()
                .attr("alt")
        );


    if (title) {

        return title;

    }


    return "";

}


/* =========================================
   PARSE DANH SÁCH PHIM

   Hàm này là phần quan trọng nhất
   để tránh lỗi EMPTY CONTENT
========================================= */

function parseMovies(html) {

    const $ =
        cheerio.load(html);


    const results = [];


    const seen =
        new Set();


    /*
       Selector phổ biến
    */

    const selectors = [

        ".movie-item",

        ".film-item",

        ".item",

        ".poster",

        ".film",

        ".movie",

        "article",

        "li"

    ];


    /*
       Hàm thêm phim
    */

    function addMovie(
        url,
        title,
        poster
    ) {

        if (!url) return;


        url =
            absoluteUrl(url);


        if (
            !isValidMovieUrl(url)
        ) {
            return;
        }


        /*
           Không dùng link tập
           làm phim riêng lẻ trong catalog.

           Tuy nhiên nếu không còn
           link phim nào khác thì
           link tập vẫn được xử lý
           ở fallback phía dưới.
        */

        if (
            isEpisodeUrl(url)
        ) {
            return;
        }


        title =
            cleanText(title);


        if (
            !title ||
            title.length < 2 ||
            title.length > 200
        ) {
            return;
        }


        /*
           Loại một số text menu
        */

        const badTitles = [

            "trang chủ",
            "đăng nhập",
            "đăng ký",
            "lịch chiếu",
            "mới cập nhật",
            "xem thêm",
            "xem đầy đủ",
            "tìm kiếm"

        ];


        if (
            badTitles.includes(
                title.toLowerCase()
            )
        ) {
            return;
        }


        if (
            seen.has(url)
        ) {
            return;
        }


        seen.add(url);


        results.push({

            id:
                idFromUrl(url),

            type:
                "series",

            name:
                title,

            poster:
                poster || null

        });

    }


    /*
       PHƯƠNG PHÁP 1

       Tìm các card phim
    */

    for (
        const selector of selectors
    ) {

        $(selector).each(
            (_, element) => {

                const el =
                    $(element);


                let link =
                    el.attr("href");


                if (!link) {

                    link =
                        el
                            .find("a")
                            .first()
                            .attr("href");

                }


                if (!link) return;


                const title =
                    getTitle(
                        $,
                        element
                    );


                const poster =
                    getPoster(
                        $,
                        element
                    );


                addMovie(
                    link,
                    title,
                    poster
                );

            }
        );

    }


    /*
       PHƯƠNG PHÁP 2

       Nếu selector phía trên
       không bắt được card,
       quét toàn bộ thẻ <a>
    */

    $("a").each(
        (_, element) => {

            const el =
                $(element);


            const href =
                el.attr("href");


            if (!href) return;


            const img =
                el.find("img")
                    .first();


            let title =

                cleanText(
                    el.attr("title")
                ) ||

                cleanText(
                    img.attr("alt")
                );


            /*
               Nếu link có nhiều text
               như:

               Tập 154 Tiên Nghịch Xian Ni

               sẽ cố lấy text đó.
            */

            if (!title) {

                title =
                    cleanText(
                        el.text()
                    );

            }


            if (
                title.length > 150
            ) {

                return;

            }


            const poster =

                absoluteUrl(
                    img.attr("data-src") ||
                    img.attr("data-lazy-src") ||
                    img.attr("data-original") ||
                    img.attr("src")
                );


            addMovie(
                href,
                title,
                poster
            );

        }
    );


    console.log(
        "Movies found:",
        results.length
    );


    return results
        .slice(0, 100);

}


/* =========================================
   LẤY PHIM TỪ TRANG CHỦ
========================================= */

async function getHome(page = 1) {

    const urls = [

        BASE_URL + "/"

    ];


    /*
       Một số website dùng nhiều kiểu
       phân trang khác nhau
    */

    if (page > 1) {

        urls.push(

            `${BASE_URL}/page/${page}/`,

            `${BASE_URL}/page/${page}`,

            `${BASE_URL}/trang/${page}`

        );

    }


    for (
        const url of urls
    ) {

        try {

            const html =
                await getHTML(url);


            const movies =
                parseMovies(html);


            if (
                movies.length > 0
            ) {

                return movies;

            }

        } catch (error) {

            console.error(
                "Home error:",
                error.message
            );

        }

    }


    return [];

}


/* =========================================
   SEARCH
========================================= */

async function searchMovies(query) {

    query =
        cleanText(query);


    if (!query) {

        return [];

    }


    const urls = [

        `${BASE_URL}/?s=${encodeURIComponent(query)}`,

        `${BASE_URL}/search?q=${encodeURIComponent(query)}`,

        `${BASE_URL}/tim-kiem?q=${encodeURIComponent(query)}`,

        `${BASE_URL}/tim-kiem/${encodeURIComponent(query)}`

    ];


    for (
        const url of urls
    ) {

        try {

            const html =
                await getHTML(url);


            const movies =
                parseMovies(html);


            const filtered =
                movies.filter(
                    movie =>

                        movie.name
                            .toLowerCase()
                            .includes(
                                query.toLowerCase()
                            )
                );


            if (
                filtered.length > 0
            ) {

                return filtered
                    .slice(0, 100);

            }

        } catch (error) {

            console.log(
                "Search URL failed:",
                url,
                error.message
            );

        }

    }


    /*
       Fallback:
       tìm trong trang chủ
    */

    try {

        const home =
            await getHome();


        return home
            .filter(
                movie =>

                    movie.name
                        .toLowerCase()
                        .includes(
                            query.toLowerCase()
                        )
            )
            .slice(0, 100);

    } catch {

        return [];

    }

}


/* =========================================
   LẤY META PHIM
========================================= */

async function getMovieMeta(id) {

    const url =
        urlFromId(id);


    if (!url) {

        throw new Error(
            "Invalid movie ID"
        );

    }


    const html =
        await getHTML(url);


    const $ =
        cheerio.load(html);


    /*
       TITLE
    */

    let name =

        cleanText(
            $("h1").first().text()
        ) ||

        cleanText(
            $('meta[property="og:title"]')
                .attr("content")
        ) ||

        cleanText(
            $("title").text()
        );


    /*
       Xóa tên website
    */

    name =
        name
            .replace(
                /\s*[-|]\s*HOATHINH3D.*$/i,
                ""
            )
            .trim();


    /*
       DESCRIPTION
    */

    const description =

        cleanText(
            $('meta[name="description"]')
                .attr("content")
        ) ||

        cleanText(
            $('meta[property="og:description"]')
                .attr("content")
        ) ||

        cleanText(
            $(".description")
                .first()
                .text()
        ) ||

        cleanText(
            $(".content")
                .first()
                .text()
        );


    /*
       POSTER
    */

    let poster =

        $('meta[property="og:image"]')
            .attr("content") ||

        $(".poster img")
            .first()
            .attr("src") ||

        $(".movie-poster img")
            .first()
            .attr("src") ||

        $("img")
            .first()
            .attr("src");


    poster =
        absoluteUrl(
            poster,
            url
        );


    const videos = [];


    const seenEpisodes =
        new Set();


    /*
       QUÉT TOÀN BỘ LINK TẬP
    */

    $("a").each(
        (_, element) => {

            const el =
                $(element);


            const href =
                absoluteUrl(
                    el.attr("href"),
                    url
                );


            if (!href) return;


            if (
                !isEpisodeUrl(href)
            ) {
                return;
            }


            if (
                seenEpisodes.has(href)
            ) {
                return;
            }


            seenEpisodes.add(href);


            let title =

                cleanText(
                    el.text()
                ) ||

                cleanText(
                    el.attr("title")
                );


            /*
               Lấy số tập
            */

            const match =

                title.match(
                    /(?:tập|episode)\s*(\d+)/i
                ) ||

                href.match(
                    /tap-(\d+)/i
                ) ||

                href.match(
                    /episode[-_/]?(\d+)/i
                );


            let episode =

                match
                    ? Number(match[1])
                    : videos.length + 1;


            /*
               Nếu không có title
            */

            if (!title) {

                title =
                    "Tập " +
                    episode;

            }


            videos.push({

                id:
                    episodeIdFromUrl(
                        href
                    ),

                title,

                season: 1,

                episode

            });

        }
    );


    /*
       Sắp xếp tập
    */

    videos.sort(
        (a, b) =>
            a.episode -
            b.episode
    );


    /*
       Nếu trang đó chính là
       một trang tập và không
       tìm được danh sách tập
    */

    if (
        videos.length === 0 &&
        isEpisodeUrl(url)
    ) {

        videos.push({

            id:
                episodeIdFromUrl(
                    url
                ),

            title:
                "Tập 1",

            season: 1,

            episode: 1

        });

    }


    /*
       Nếu vẫn không có tập
       tạo một video mặc định
    */

    if (
        videos.length === 0
    ) {

        videos.push({

            id:
                episodeIdFromUrl(
                    url
                ),

            title:
                "Xem phim",

            season: 1,

            episode: 1

        });

    }


    console.log(
        "Episodes found:",
        videos.length
    );


    return {

        id,

        type:
            "series",

        name:
            name ||
            "HH3D",

        description,

        poster,

        videos

    };

}


/* =========================================
   TÌM LINK VIDEO
========================================= */

function extractMediaFromText(
    text
) {

    if (!text) return null;


    const patterns = [

        /*
           M3U8
        */

        /https?:\/\/[^"'\\\s<>]+?\.m3u8[^"'\\\s<>]*/i,


        /*
           MP4
        */

        /https?:\/\/[^"'\\\s<>]+?\.mp4[^"'\\\s<>]*/i


    ];


    for (
        const pattern of patterns
    ) {

        const match =
            text.match(pattern);


        if (match) {

            return match[0]
                .replace(
                    /&amp;/g,
                    "&"
                );

        }

    }


    return null;

}


/* =========================================
   KIỂM TRA VIDEO TRONG HTML
========================================= */

function extractFromHtml(
    html,
    pageUrl
) {

    const $ =
        cheerio.load(html);


    /*
       video[src]
    */

    let source =

        $("video")
            .first()
            .attr("src");


    if (source) {

        return absoluteUrl(
            source,
            pageUrl
        );

    }


    /*
       video source[src]
    */

    source =

        $("video source")
            .first()
            .attr("src") ||

        $("source")
            .first()
            .attr("src");


    if (source) {

        return absoluteUrl(
            source,
            pageUrl
        );

    }


    /*
       Tìm trong toàn bộ HTML
    */

    return extractMediaFromText(
        html
    );

}


/* =========================================
   STREAM EXTRACTOR
========================================= */

async function extractVideoUrl(
    episodeUrl
) {

    if (!episodeUrl) {

        return null;

    }


    console.log(
        "Extract video:",
        episodeUrl
    );


    const html =
        await getHTML(
            episodeUrl
        );


    /*
       1. Kiểm tra trực tiếp
    */

    let videoUrl =
        extractFromHtml(
            html,
            episodeUrl
        );


    if (videoUrl) {

        console.log(
            "Direct video found:",
            videoUrl
        );

        return videoUrl;

    }


    const $ =
        cheerio.load(html);


    /*
       2. Lấy tất cả iframe
    */

    const iframes = [];


    $("iframe").each(
        (_, element) => {

            const src =
                $(element)
                    .attr("src");


            const iframeUrl =
                absoluteUrl(
                    src,
                    episodeUrl
                );


            if (
                iframeUrl &&
                !iframes.includes(
                    iframeUrl
                )
            ) {

                iframes.push(
                    iframeUrl
                );

            }

        }
    );


    /*
       3. Kiểm tra từng iframe
    */

    for (
        const iframeUrl of iframes
    ) {

        try {

            console.log(
                "Checking iframe:",
                iframeUrl
            );


            const iframeHtml =
                await getHTML(
                    iframeUrl
                );


            videoUrl =
                extractFromHtml(
                    iframeHtml,
                    iframeUrl
                );


            if (videoUrl) {

                console.log(
                    "Iframe video found:",
                    videoUrl
                );

                return videoUrl;

            }


            /*
               Một số player
               nhúng iframe tiếp
            */

            const iframe$ =
                cheerio.load(
                    iframeHtml
                );


            const nestedIframe =
                iframe$("iframe")
                    .first()
                    .attr("src");


            if (nestedIframe) {

                const nestedUrl =
                    absoluteUrl(
                        nestedIframe,
                        iframeUrl
                    );


                if (nestedUrl) {

                    try {

                        const nestedHtml =
                            await getHTML(
                                nestedUrl
                            );


                        videoUrl =
                            extractFromHtml(
                                nestedHtml,
                                nestedUrl
                            );


                        if (videoUrl) {

                            return videoUrl;

                        }

                    } catch (error) {

                        console.log(
                            "Nested iframe failed:",
                            error.message
                        );

                    }

                }

            }

        } catch (error) {

            console.log(
                "Iframe error:",
                iframeUrl,
                error.message
            );

        }

    }


    /*
       Không tìm được video
    */

    console.log(
        "No video URL found"
    );


    return null;

}


/* =========================================
   EXPORT
========================================= */

module.exports = {

    getHome,

    searchMovies,

    getMovieMeta,

    decodeEpisodeId,

    extractVideoUrl

};
