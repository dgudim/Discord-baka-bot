
const Danbooru = require("danbooru");
const booru = new Danbooru();

import sagiri from "sagiri";
const sagiri_client = sagiri("d78bfeac5505ab0a2af7f19d369029d4f6cd5176");

import * as iqdb from "@l2studio/iqdb-api";
import { BufferResolvable, ChatInputCommandInteraction, EmbedBuilder, Message, Snowflake, TextBasedChannel, TextChannel } from "discord.js";

import pixiv from "pixiv.ts";

import puppeteer, { Browser, Page } from "puppeteer";
import { debug, error, info, warn } from "discord_bots_common/dist/utils/logger";
import { colors, wrap } from "discord_bots_common/dist/utils/colors";
import { getEnvironmentVar } from "discord_bots_common/dist/utils/init_utils";
import { normalizeStringArray, sendToChannel, perc2color, getFileName, stripUrlScheme, isDirectory, eight_mb, walk, sleep, none, safeReply, clamp } from "discord_bots_common/dist/utils/utils";
import { db, image_args } from "..";
import { search_modifiers, sourcePrecedence } from "../config";

import sharp from "sharp";
import fs from "fs";
import { appendPostInfoToEmbed, getXmpTag, ensureTagsInDB, getImageMetatags, getImageTag, setLastTags } from "./tagging_utils";

let browser: Browser;
let page: Page;
let pixiv_client: pixiv;

async function getTagsBySelector(selector: string) {
    return page.evaluate(sel => {
        return Array.from(document.querySelectorAll(sel))
            .map(elem => elem.textContent?.replaceAll(" ", "_"));
    }, selector);
}

async function getAttributeBySelector(selector: string, attribute: string) {
    return page.evaluate((sel, attr) => {
        const img = document.querySelector(sel);
        return img ? img.getAttribute(attr) : "";
    }, selector, attribute);
}

async function callFunction(func: string) {
    try {
        await page.evaluate(func);
    } catch (e) {
        error(`error calling function: ${func}: ${e}`);
    }
}

interface Post {
    source_db: string;
    source_url: string;
    image_url: string;
    similarity: number;
    author: string;
    rating: string;
}

export interface PostInfo {
    author: string;
    character: string;
    tags: string;
    copyright: string;
    source_url: string;
    image_url: string;
    rating: string;
}

async function grabBySelectors(source_url: string,
    authorSelector: string, copyrightSelector: string,
    characterSelector: string, tagSelector: string, ratingSelector: string) {

    await gotoPage(source_url);

    const authorTags = await getTagsBySelector(authorSelector);
    const copyrightTags = await getTagsBySelector(copyrightSelector);
    const characterTags = await getTagsBySelector(characterSelector);
    const generalTags = await getTagsBySelector(tagSelector);
    const rating = await getTagsBySelector(ratingSelector);

    let image_url;
    if (source_url.includes("yande.re")) {
        image_url = await getAttributeBySelector("#highres-show", "href");
    } else if (source_url.includes("gelbooru")) {
        await callFunction("resizeTransition();");
    } else if (source_url.includes("rule34")) {
        await callFunction("Post.highres();");
    } else if (source_url.includes("sankakucomplex")) {
        await page.click("#image");
    }

    image_url = image_url || await getAttributeBySelector("#image", "src");

    return {
        author: authorTags.join(",") || "-",
        character: characterTags.join(",") || "-",
        tags: generalTags.join(",") || "-",
        copyright: copyrightTags.join(",") || "-",
        source_url: source_url,
        image_url: image_url || "",
        rating: ratingToReadable(rating.join(",").replace("Rating:", "").trim().toLowerCase() || "-")
    };
}

async function ensurePuppeteerStarted() {
    if (!browser) {
        browser = await puppeteer.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        debug("starting puppeteer");
    }
    if (!page) {
        page = await browser.newPage();
        debug("opening a new page");
    }
}

async function gotoPage(url: string) {
    await ensurePuppeteerStarted();
    await page.goto(url);
}

export async function ensurePixivLogin() {
    if (process.env.PIXIV_TOKEN) {
        if (!pixiv_client) {
            debug("logging into pixiv");
            pixiv_client = await pixiv.refreshLogin(process.env.PIXIV_TOKEN);
        }
        return pixiv_client;
    } else {
        warn(`🟧🔎 ${wrap("PIXIV_TOKEN", colors.LIGHTER_BLUE)} not specified, can't login into pixiv`);
        return undefined;
    }
}

export async function findSauce(image_url: string, channel: TextBasedChannel, min_similarity: number, only_accept_from = "") {

    info(`searching sauce for ${image_url}`);

    await ensurePuppeteerStarted();

    let sagiriResults;

    const posts: Post[] = [];
    try {
        sagiriResults = await sagiri_client(image_url);

        info(`got ${wrap(sagiriResults.length, colors.LIGHT_YELLOW)} results from saucenao`);

        for (const res of sagiriResults) {
            info(res.url + " " + wrap(res.similarity, colors.LIGHT_YELLOW));
        }

        for (const result of sagiriResults) {
            if (!only_accept_from || normalizeStringArray(only_accept_from.split(",")).some((elem) => result.url.includes(elem))) {
                posts.push({
                    source_db: `saucenao (${result.site})`,
                    source_url: result.url,
                    similarity: result.similarity,
                    image_url: image_url,
                    author: result.authorName || "-",
                    rating: "-"
                });
            }
        }

    } catch (err) {
        sendToChannel(channel, "Sagiri api call error: " + err);
    }

    let callIq = !sagiriResults;

    if (!posts.some((post) => post.source_url.includes("booru") && post.similarity >= min_similarity)) {
        callIq = true;
    }

    if (callIq) {
        sendToChannel(channel, "calling iqdb, wait...");
        let iqDbResults;

        while (!iqDbResults?.results) {
            try {
                iqDbResults = await iqdb.search(image_url);
            } catch (err) {
                error(err);
                sendToChannel(channel, `iqdb error, retrying`);
                continue;
            }
            break;
        }

        if (iqDbResults?.results) {
            const iqdb_posts: Post[] = [];
            for (const result of iqDbResults.results) {
                for (const result_source of result.sources) {
                    iqdb_posts.push({
                        source_db: `iqdb ${result_source.service}`,
                        source_url: result_source.fixedHref,
                        similarity: result.similarity,
                        image_url: image_url,
                        author: "-",
                        rating: result.type
                    });
                }
            }

            info(`got ${wrap(iqdb_posts.length, colors.LIGHT_YELLOW)} results from iqdb in ${iqDbResults.timeSeconds}s, searched ${iqDbResults.searched} images`);

            for (const post of iqdb_posts) {
                info(post.source_url + " " + wrap(post.similarity, colors.LIGHT_YELLOW));
                if (!only_accept_from || normalizeStringArray(only_accept_from.split(",")).some(accept_from => post.source_url.includes(accept_from))) {
                    posts.push(post);
                }
            }
        }
    }

    posts.sort((a, b) => { return b.similarity - a.similarity; });

    let best_post_combined;
    for (const source of sourcePrecedence) {
        const res = posts.find(post => { return post.source_url.includes(source) && post.similarity >= min_similarity; });
        if (res) {
            best_post_combined = res;
            break;
        }
    }

    let postInfo;
    let embed;

    if (best_post_combined) {
        embed = new EmbedBuilder();
        embed.setTitle(`Result from ${best_post_combined.source_db}`);
        embed.setColor(perc2color(best_post_combined.similarity));
        embed.setDescription(`similarity: ${best_post_combined.similarity}`);

        postInfo = await getPostInfoFromUrl(best_post_combined.source_url) || {
            author: best_post_combined.author.replaceAll(" ", "_") || "-",
            character: "-",
            tags: "-",
            copyright: "-",
            source_url: best_post_combined.source_url,
            image_url: image_url,
            rating: ratingToReadable(best_post_combined.rating)
        };

        embed.setImage(postInfo.image_url);

        appendPostInfoToEmbed(embed, postInfo);

    } else {
        sendToChannel(channel, "No sauce found :(");
        postInfo =  {
            author: "-",
            character: "-",
            tags: "-",
            copyright: "-",
            source_url: "-",
            image_url: image_url,
            rating: "-"
        };
    }

    
    setLastTags(channel, postInfo);

    return { postInfo: postInfo, embed: embed };
}

export async function getPostInfoFromUrl(source_url: string): Promise<PostInfo | undefined> {

    if (source_url.includes("pixiv")) {
        const illust = await (await ensurePixivLogin())?.illust.get(source_url);

        if (illust) {

            const tags: string[] = [];
            for (const pixiv_tag of illust.tags) {
                if (pixiv_tag.translated_name) {
                    tags.push(pixiv_tag.translated_name);
                }
            }

            return {
                author: `${illust.user.name} (${illust.user.id})`,
                character: "-",
                copyright: "-",
                tags: tags.join(",") || "-",
                source_url: source_url,
                image_url: "-",
                rating: `${illust.sanity_level}`
            };
        }
        return undefined;
    }

    if (source_url.includes("danbooru")) {
        const fileName = getFileName(source_url);
        const lastIndex = fileName.indexOf("?");
        const post = await booru.posts(+fileName.slice(0, lastIndex == -1 ? fileName.length : lastIndex));

        await gotoPage(source_url);
        const image_url = await getAttributeBySelector(".image-view-original-link", "href");

        return {
            author: post.tag_string_artist || "-",
            character: post.tag_string_character || "-",
            tags: post.tag_string_general || "-",
            copyright: post.tag_string_copyright || "-",
            source_url: source_url,
            image_url: image_url || "-",
            rating: ratingToReadable(post.rating || "-")
        };
    }

    if (source_url.includes("gelbooru")) {

        return grabBySelectors(source_url,
            "#tag-list > li.tag-type-artist > a",
            "#tag-list > li.tag-type-copyright > a",
            "#tag-list > li.tag-type-character > a",
            "#tag-list > li.tag-type-general > a",
            "li:has(> a)[style*=\"line-break: anywhere;\"] + li");

    }

    if (source_url.includes("sankakucomplex") || source_url.includes("rule34")) {

        return grabBySelectors(source_url,
            "#tag-sidebar > li.tag-type-artist > a",
            "#tag-sidebar > li.tag-type-copyright > a",
            "#tag-sidebar > li.tag-type-character > a",
            "#tag-sidebar > li.tag-type-general > a",
            "#stats > ul > li:not(:has(> a))");

    }

    if (source_url.includes("yande") || source_url.includes("konachan")) {

        return grabBySelectors(source_url,
            "#tag-sidebar > li.tag-type-artist > a:nth-child(2)",
            "#tag-sidebar > li.tag-type-copyright > a:nth-child(2)",
            "#tag-sidebar > li.tag-type-character > a:nth-child(2)",
            "#tag-sidebar > li.tag-type-general > a:nth-child(2)",
            "#stats > ul > li:has(> span[class=\"vote-desc\"])");

    }

    return undefined;
}

export type saveDirType =
    | "IMAGE"
    | "SAVE"

export function getKeyByDirType(dir_type: saveDirType): string {
    let key;
    switch (dir_type) {
        case "SAVE":
            key = "send_file_dir";
            break;
        case "IMAGE":
            key = "img_dir";
            break;
    }
    return key;
}

function ratingToReadable(rating: string) {
    switch (rating) {
        case "e":
            return "explicit";

        case "ero":
        case "q":
            return "questionable";

        case "s":
            return "sensitive";

        case "general":
        case "g":
            return "safe";

        default:
            return rating;
    }
}

function ratingToLevel(rating: string) {
    let rating_int;
    switch (rating) {
        case "explicit":
            return "90";

        case "questionable":
            return "65";

        case "sensitive":
            return "50";

        case "safe":
            return "15";

        default:

            rating_int = parseInt(rating);
            if (!isNaN(rating_int)) {
                return (clamp(rating_int * 10, 0, 100)).toString();
            }

            warn(`Unknown rating: ${wrap(rating, colors.GREEN)}`);
            return "-";
    }
}

export function getSauceConfString(lastTagsFrom_get_sauce: PostInfo) {
    return getXmpTag("character", lastTagsFrom_get_sauce.character) +
        getXmpTag("author", lastTagsFrom_get_sauce.author) +
        getXmpTag("copyright", lastTagsFrom_get_sauce.copyright) +
        getXmpTag("tags", lastTagsFrom_get_sauce.tags) +
        getXmpTag("hlvl", ratingToLevel(lastTagsFrom_get_sauce.rating)) +
        ` -xmp-xmp:sourcepost='${stripUrlScheme(lastTagsFrom_get_sauce.source_url)}'`;
}

const lastImagesPerChannel: Map<Snowflake, string> = new Map<Snowflake, string>();
const lastImageUrlsPerChannel: Map<Snowflake, string> = new Map<Snowflake, string>();

export function changeSavedDirectory(channel: TextBasedChannel, dir_type: saveDirType, dir: string | null): boolean | undefined {
    if (dir) {
        const key = getKeyByDirType(dir_type);
        if (isDirectory(dir)) {
            sendToChannel(channel, `📂 Changed ${dir_type.toLowerCase()} directory to ${dir}`);
            db.push(`^${key}`, dir.endsWith("/") ? dir.substring(0, dir.length - 1) : dir, true);
            return true;
        } else {
            sendToChannel(channel, `❌ Invalid ${dir_type} directory, will use previous`, true);
            return false;
        }
    }
}

export async function getImgDir() {
    return db.getData(`^${getKeyByDirType("IMAGE")}`);
}

export async function getSendDir() {
    return db.getData(`^${getKeyByDirType("SAVE")}`);
}

export function setLastImg(channel: TextBasedChannel, image: string, imageUrl: string): string {
    debug(`Set last image path to ${image} | url to ${imageUrl}`);
    lastImagesPerChannel.set(channel.id, image);
    lastImageUrlsPerChannel.set(channel.id, imageUrl);
    return imageUrl;
}

export function getLastImgUrl(channel: TextBasedChannel): string {
    return lastImageUrlsPerChannel.get(channel.id) || "";
}

export function getLastImgPath(channel: TextBasedChannel): string {
    return lastImagesPerChannel.get(channel.id) || "";
}

export async function sendImgToChannel(channel: TextBasedChannel, file: string, attachMetadata = false): Promise<string | undefined> {
    let attachment: BufferResolvable | undefined = file;
    let message: Promise<Message<boolean>> | undefined;
    const width = (await sharp(file).metadata()).width || 0;
    if (fs.statSync(file).size > eight_mb || width > 3000) {
        sendToChannel(channel, "🕜 Image too large, compressing, wait...");
        await sharp(file)
            .resize({ width: 1920 })
            .jpeg({
                quality: 80
            })
            .toBuffer().then(data => {
                if (data.byteLength > eight_mb) {
                    sendToChannel(channel, "❌ Image still too large, bruh", true);
                    attachment = undefined;
                } else {
                    attachment = data;
                }
            });
    }

    if (attachment) {
        if (attachMetadata) {
            message = channel.send({
                files: [{
                    attachment: attachment,
                    name: getFileName(file)
                }],
                embeds: [await getImageMetatags(file)]
            });
        } else {
            message = channel.send({
                files: [{
                    attachment: attachment,
                    name: getFileName(file)
                }]
            });
        }

        if (message) {
            return setLastImg(channel, file, (await message).attachments.at(0)?.url || "");
        }
    }
    return undefined;
}

export async function searchImages(searchQuery: string, channel: TextBasedChannel | null) {

    let images: string[] = [];
    const img_dir = await getImgDir();
    if (!isDirectory(img_dir)) {
        await sendToChannel(channel, `❌ Image directory ${img_dir} does not exist or not a directory`, true);
        return images;
    }
    images = walk(img_dir);

    if (images.length > 0 && !await db.exists(`^${images[0]}`)) {
        await sendToChannel(channel, "🕝 Refreshing image tag database, might take a while...");
        await Promise.all(images.map((value) => {
            ensureTagsInDB(value);
        }));
        await sleep(5000); // let the database save
    }

    const search_terms = normalizeStringArray(searchQuery.split(";"));
    for (const search_term of search_terms) {

        let activeModifier_key = "";
        let activeModifier = (_content: string[], _search_term: string[]) => true;
        for (const [key, func] of search_modifiers.entries()) {
            if (search_term.indexOf(key) != -1) {
                activeModifier_key = key;
                activeModifier = func;
                break;
            }
        }

        const search_term_split = normalizeStringArray(search_term.split(activeModifier_key));

        if (search_term_split.length != 2) {
            sendToChannel(channel, `🚫 Invalid search term ${search_term}`, true);
        } else {
            if (image_args.indexOf(search_term_split[0]) == -1) {
                sendToChannel(channel, `🚫 No such xmp tag: ${search_term_split[0]}`, true);
            } else {
                const results = await Promise.all(images.map((value) => {
                    return getImageTag(value, search_term_split[0]);
                }));
                images = images.filter((_element, index) => {
                    return activeModifier(
                        normalizeStringArray(results[index].split(",")),
                        normalizeStringArray(search_term_split[1].split(",")));
                });
            }
        }
    }

    sendToChannel(channel, `🔎 Found ${images.length} images`);
    return images;
}

export function isNSFW(channel: TextChannel, interaction: ChatInputCommandInteraction | none) {
    if (!channel.nsfw && !getEnvironmentVar("NSFW_CHANNELS").split(",").includes(channel.id)) {
        safeReply(interaction, "This channel is not nsfw. No horny allowed here", true);
        return false;
    }
    return true;
}