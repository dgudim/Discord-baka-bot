
const Danbooru = require('danbooru');
const booru = new Danbooru();

import sagiri from "sagiri";
const sagiri_client = sagiri('d78bfeac5505ab0a2af7f19d369029d4f6cd5176');

import * as iqdb from '@l2studio/iqdb-api'
import { BufferResolvable, EmbedBuilder, Message, Snowflake, TextBasedChannel } from 'discord.js';

import puppeteer, { Browser, Page } from 'puppeteer'
import { getFileName, limitLength, perc2color, sendToChannel, sleep, trimStringArray, walk, normalizeTags, isDirectory, eight_mb } from '@discord_bots_common/utils';
import { db, image_args_arr } from ".";
import { search_modifiers, sourcePrecedence } from "./config";
import { colors, wrap } from "@discord_bots_common/colors";
import { debug, error, info } from "@discord_bots_common/logger";

import sharp from "sharp";
import fs from "fs";
import { ensureTagsInDB, getImageMetatags, getImageTag, setLastTags } from "./tagging_utils";

let browser: Browser;
let page: Page;

async function getTagsBySelector(selector: string) {
    return page.evaluate(sel => {
        return Array.from(document.querySelectorAll(sel))
            .map(elem => elem.textContent?.replaceAll(' ', '_'));
    }, selector);
}

async function getAttributeBySelector(selector: string, attribute: string) {
    return page.evaluate((sel, attr) => {
        let img = document.querySelector(sel);
        return img ? img.getAttribute(attr) : '';
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
    url: string;
    similarity: number;
    thumbnail: string;
    author: string;
}

export interface PostInfo {
    author: string;
    character: string;
    tags: string;
    copyright: string;
    url: string;
}

export interface TagContainer {
    postInfo: PostInfo;
    file: string;
}

async function grabBySelectors(url: string,
    authorSelector: string, copyrightSelector: string,
    characterSelector: string, tagSelector: string) {
    await page.goto(url);

    const authorTags = await getTagsBySelector(authorSelector);
    const copyrightTags = await getTagsBySelector(copyrightSelector);
    const characterTags = await getTagsBySelector(characterSelector);
    const generalTags = await getTagsBySelector(tagSelector);

    return {
        author: authorTags.join(",") || '-',
        character: characterTags.join(",") || '-',
        tags: generalTags.join(",") || '-',
        copyright: copyrightTags.join(",") || '-',
        url: url
    }
}

async function ensurePuppeteerStarted() {
    if (!browser) {
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        page = await browser.newPage();
        debug('starting puppeteer');
    }
}

export async function findSauce(file: string, channel: TextBasedChannel, min_similarity: number, only_accept_from: string = '', set_last_tags: boolean = true) {

    info(`searching sauce for ${file}`);

    await ensurePuppeteerStarted();

    let sagiriResults;

    let posts: Post[] = [];
    try {
        sagiriResults = await sagiri_client(file);

        info(`got ${wrap(sagiriResults.length, colors.LIGHT_YELLOW)} results from saucenao`);

        for (let res of sagiriResults) {
            info(res.url + ' ' + wrap(res.similarity, colors.LIGHT_YELLOW));
        }

        for (let result of sagiriResults) {
            if (!only_accept_from || trimStringArray(only_accept_from.split(',')).some((elem) => result.url.includes(elem))) {
                posts.push({
                    source_db: `saucenao (${result.site})`,
                    url: result.url,
                    similarity: result.similarity,
                    thumbnail: result.thumbnail,
                    author: result.authorName || '-'
                });
            }
        }

    } catch (err) {
        sendToChannel(channel, "Sagiri api call error: " + err);
    }

    let callIq = !sagiriResults;

    if (!posts.some((post) => post.url.includes('booru') && post.similarity >= min_similarity)) {
        callIq = true;
    }

    if (callIq) {
        sendToChannel(channel, "calling iqdb, wait...");
        let iqDbResults;

        while (true) {
            try {
                iqDbResults = await iqdb.search(file);
            } catch (err) {
                error(err);
                break;
            }

            if (!iqDbResults.searched) {
                sendToChannel(channel, `iqdb error`)
                sendToChannel(channel, 'retrying call to iqdb');
                continue;
            }
            break;
        }

        if (iqDbResults?.results) {
            let iqdb_posts: Post[] = [];
            for (let result of iqDbResults.results) {
                for (let result_source of result.sources) {
                    iqdb_posts.push({
                        source_db: `iqdb ${result_source.service}`,
                        url: result_source.fixedHref,
                        similarity: result.similarity,
                        thumbnail: result.thumbnail.fixedSrc,
                        author: '-'
                    });
                }
            }

            info(`got ${wrap(iqdb_posts.length, colors.LIGHT_YELLOW)} results from iqdb in ${iqDbResults.timeSeconds}s, searched ${iqDbResults.searched} images`);

            for (let result of iqdb_posts) {
                info(result.url + ' ' + wrap(result.similarity, colors.LIGHT_YELLOW));
                if (!only_accept_from || trimStringArray(only_accept_from.split(',')).some((elem) => result.url.includes(elem))) {
                    posts.push(result);
                }
            }
        }
    }

    posts.sort((a, b) => { return b.similarity - a.similarity });

    let best_post_combined = posts[0];
    for (const source of sourcePrecedence) {
        let res = posts.find((value) => { return value.url.includes(source) && value.similarity >= min_similarity });
        if (res) {
            best_post_combined = res;
            break;
        }
    }

    if (best_post_combined) {
        const embed = new EmbedBuilder();
        embed.setTitle(`Result from ${best_post_combined.source_db}`);
        embed.setColor(perc2color(best_post_combined.similarity));
        embed.setDescription(`similarity: ${best_post_combined.similarity}`);

        let postInfo: PostInfo = await getPostInfoFromUrl(best_post_combined.url) || {
            author: best_post_combined.author.replaceAll(' ', '_') || '-',
            character: '-',
            tags: '-',
            copyright: '-',
            url: best_post_combined.url
        }

        embed.setURL(best_post_combined.url);
        embed.setImage(best_post_combined.thumbnail);
        embed.addFields([{
            name: "Author",
            value: normalizeTags(postInfo.author)
        },
        {
            name: "Character",
            value: normalizeTags(postInfo.character)
        },
        {
            name: "Tags",
            value: limitLength(normalizeTags(postInfo.tags), 1024)
        },
        {
            name: "Copyright",
            value: normalizeTags(postInfo.copyright)
        }]);

        if (set_last_tags) {
            setLastTags(channel, { postInfo: postInfo, file: file });
        }

        return { 'post': best_post_combined, 'postInfo': postInfo, 'embed': embed };
    } else {
        sendToChannel(channel, "No sauce found :(");
        return null;
    }
}

export async function getPostInfoFromUrl(url: string): Promise<PostInfo | undefined> {

    if (url.includes('danbooru')) {
        const fileName = getFileName(url);
        const lastIndex = fileName.indexOf('?');
        const post = await booru.posts(+fileName.slice(0, lastIndex == -1 ? fileName.length : lastIndex));

        return {
            author: post.tag_string_artist || '-',
            character: post.tag_string_character || '-',
            tags: post.tag_string_general || '-',
            copyright: post.tag_string_copyright || '-',
            url: url
        }
    }

    if (url.includes('gelbooru')) {

        return grabBySelectors(url,
            '#tag-list > li.tag-type-artist > a',
            '#tag-list > li.tag-type-copyright > a',
            '#tag-list > li.tag-type-character > a',
            '#tag-list > li.tag-type-general > a');

    }

    if (url.includes('sankakucomplex') || url.includes('rule34')) {

        return grabBySelectors(url,
            '#tag-sidebar > li.tag-type-artist > a',
            '#tag-sidebar > li.tag-type-copyright > a',
            '#tag-sidebar > li.tag-type-character > a',
            '#tag-sidebar > li.tag-type-general > a');

    }

    if (url.includes('yande') || url.includes('konachan')) {

        return grabBySelectors(url,
            '#tag-sidebar > li.tag-type-artist > a:nth-child(2)',
            '#tag-sidebar > li.tag-type-copyright > a:nth-child(2)',
            '#tag-sidebar > li.tag-type-character > a:nth-child(2)',
            '#tag-sidebar > li.tag-type-general > a:nth-child(2)');

    }

    return undefined;
}

export async function grabImageUrl(url: string) {
    await ensurePuppeteerStarted();

    await page.goto(url);

    let res;

    if (url.includes('danbooru')) {
        res = await getAttributeBySelector('.image-view-original-link', 'href');
    } else if (url.includes('yande.re')) {
        res = await getAttributeBySelector('#highres-show', 'href');
    } else if (url.includes('gelbooru')) {
        await callFunction('resizeTransition();');
    } else if (url.includes('rule34')) {
        await callFunction('Post.highres();');
    } else if (url.includes('sankakucomplex')) {
        await page.click('#image');
    }

    return res || getAttributeBySelector('#image', 'src');
}

export type saveDirType =
    | 'IMAGE'
    | 'SAVE'

export function getKeyByDirType(dir_type: saveDirType): string {
    let key;
    switch (dir_type) {
        case 'SAVE':
            key = 'send_file_dir'
            break;
        case 'IMAGE':
            key = 'img_dir'
            break;
    }
    return key;
}

let lastFiles: Map<Snowflake, string> = new Map<Snowflake, string>();
let lastFileUrls: Map<Snowflake, string> = new Map<Snowflake, string>();

export function changeSavedDirectory(channel: TextBasedChannel, dir_type: saveDirType, dir: string | null): boolean | undefined {
    if (dir) {
        let key = getKeyByDirType(dir_type);
        if (isDirectory(dir)) {
            sendToChannel(channel, `Changed ${dir_type.toLowerCase()} directory to ${dir}`);
            db.push(`^${key}`, dir.endsWith('/') ? dir.substring(0, dir.length - 1) : dir, true);
            return true;
        } else {
            sendToChannel(channel, `Invalid ${dir_type} directory, will use previous`);
            return false;
        }
    }
}

export async function getImgDir() {
    return db.getData(`^${getKeyByDirType('IMAGE')}`);
}

export async function getSendDir() {
    return db.getData(`^${getKeyByDirType('SAVE')}`);
}

export function setLastImg(channel: TextBasedChannel, file: string, fileUrl: string): void {
    lastFiles.set(channel.id, file);
    lastFileUrls.set(channel.id, fileUrl);
}

export function getLastImgUrl(channel: TextBasedChannel): string {
    return lastFileUrls.get(channel.id) || '';
}

export function getLastImgPath(channel: TextBasedChannel): string {
    return lastFiles.get(channel.id) || '';
}

export async function sendImgToChannel(channel: TextBasedChannel, file: string, attachMetadata: boolean = false): Promise<void> {
    let attachment: BufferResolvable | undefined = file;
    let message: Promise<Message<boolean>> | undefined;
    let width = (await sharp(file).metadata()).width || 0;
    if (fs.statSync(file).size > eight_mb || width > 3000) {
        sendToChannel(channel, 'image too large, compressing, wait...');
        await sharp(file)
            .resize({ width: 1920 })
            .jpeg({
                quality: 80
            })
            .toBuffer().then(data => {
                if (data.byteLength > eight_mb) {
                    sendToChannel(channel, 'image still too large, bruh');
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
            setLastImg(channel, file, (await message).attachments.at(0)?.url || '');
        }
    }
}

export async function searchImages(searchQuery: string, channel: TextBasedChannel | null) {

    let images: string[] = [];
    const img_dir = await getImgDir();
    if (!isDirectory(img_dir)) {
        await sendToChannel(channel, `Image directory ${img_dir} does not exist or not a directory`);
        return images;
    }
    images = walk(img_dir);

    if (images.length > 0 && !await db.exists(`^${images[0]}`)) {
        await sendToChannel(channel, "refreshing image tag database, might take a while...");
        await Promise.all(images.map((value) => {
            ensureTagsInDB(value);
        }));
        await sleep(5000); // let the database save
    }

    let search_terms = trimStringArray(searchQuery.split(';'));
    for (const search_term of search_terms) {

        let activeModifier_key = "";
        let activeModifier = (_content: string[], _search_term: string[]) => true;
        for (let [key, func] of search_modifiers.entries()) {
            if (search_term.indexOf(key) != -1) {
                activeModifier_key = key;
                activeModifier = func;
                break;
            }
        }

        let search_term_split = trimStringArray(search_term.split(activeModifier_key));

        if (search_term_split.length != 2) {
            sendToChannel(channel, `Invalid search term ${search_term}`);
        } else {
            if (image_args_arr.indexOf(search_term_split[0]) == -1) {
                sendToChannel(channel, `No such xmp tag: ${search_term_split[0]}`);
            } else {
                const results = await Promise.all(images.map((value) => {
                    return getImageTag(value, search_term_split[0]);
                }));
                images = images.filter((_element, index) => {
                    return activeModifier(
                        trimStringArray(results[index].split(',')),
                        trimStringArray(search_term_split[1].split(',')));
                });
            }
        }
    }

    sendToChannel(channel, `Found ${images.length} images`);
    return images;
}