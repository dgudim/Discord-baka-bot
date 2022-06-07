
const Danbooru = require('danbooru');
const booru = new Danbooru();

import sagiri from "sagiri";
const sagiri_client = sagiri('d78bfeac5505ab0a2af7f19d369029d4f6cd5176');

import iqdb from '@l2studio/iqdb-api';
import { MessageEmbed, TextBasedChannel } from 'discord.js';

import puppeteer, { Browser, Page } from 'puppeteer'
import { ensureTagsInDB, getFileName, getImageTag, perc2color, sendToChannel, setLastTags, sleep, tagContainer, trimStringArray, walk } from './utils';
import { db, getImgDir, image_args_arr } from ".";
import { search_modifiers, sourcePrecedence } from "./config";
let browser: Browser;
let page: Page;

async function getTagsBySelector(selector: string) {
    return page.evaluate(sel => {
        return Array.from(document.querySelectorAll(sel))
            .map(elem => elem.textContent.replaceAll(' ', '_'));
    }, selector);
}

function setEmbedFields(embed: MessageEmbed, author: string, character: string, tags: string, copyright: string,
    resultUrl: string, resultThumbnail: string, sourceFile: string) {
    embed.setURL(resultUrl);
    embed.setImage(resultThumbnail);
    embed.addFields([{
        name: "Author",
        value: author
    },
    {
        name: "Character",
        value: character
    },
    {
        name: "Tags",
        value: tags
    },
    {
        name: "Copyright",
        value: copyright
    }]);
    setLastTags(new tagContainer(
        character,
        author,
        tags,
        copyright,
        resultUrl,
        sourceFile));
}

export class Post {
    source: string;
    url: string;
    similarity: number;
    thumbnail: string;
    author: string;

    constructor(url: string, similarity: number, thumbnail: string, author: string, source: string) {
        this.url = url;
        this.similarity = similarity;
        this.thumbnail = thumbnail;
        this.author = author;
        this.source = source;
    }
}

async function grabBySelectors(post: Post, embed: MessageEmbed, sourceFile: string,
    authorSelector: string, copyrightSelector: string,
    characterSelector: string, tagSelector: string) {
    await page.goto(post.url);

    const authorTags = await getTagsBySelector(authorSelector);
    const copyrightTags = await getTagsBySelector(copyrightSelector);
    const characterTags = await getTagsBySelector(characterSelector);
    const generalTags = await getTagsBySelector(tagSelector);

    setEmbedFields(embed,
        authorTags.join(",") || '-',
        characterTags.join(",") || '-',
        generalTags.join(",") || '-',
        copyrightTags.join(",") || '-',
        post.url, post.thumbnail,
        sourceFile);
}

export async function findSauce(file: string, channel: TextBasedChannel | null, min_similarity: number, only_accept_from: string = '') {

    console.log(`searching sauce for ${file}`);

    if (!browser) {
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        page = await browser.newPage();
        console.log('starting puppeteer');
    }

    let sagiriResults

    let posts = [];
    try {
        sagiriResults = await sagiri_client(file);

        console.log(`got ${sagiriResults.length} results from sagiri`);

        for (let res of sagiriResults) {
            console.log(res.url, res.similarity);
        }

        for (let result of sagiriResults) {
            if (!only_accept_from || trimStringArray(only_accept_from.split(',')).some((elem) => result.url.includes(elem))) {
                posts.push(new Post(
                    result.url,
                    result.similarity,
                    result.thumbnail,
                    result.authorName || '-',
                    "saucenao"));
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
        let iqDbResults = await iqdb(file);
        if (!iqDbResults.success) {
            sendToChannel(channel, `iqdb error: ${iqDbResults.error}`)
        }
        if (iqDbResults.results) {
            console.log(`got ${iqDbResults.results.length} results from iqdb`);
            for (let res of iqDbResults.results) {
                console.log(res.url, res.similarity);
            }
            for (let result of iqDbResults.results) {
                if (!only_accept_from || trimStringArray(only_accept_from.split(',')).some((elem) => result.url.includes(elem))) {
                    posts.push(new Post(
                        result.url,
                        result.similarity,
                        result.image,
                        '-', "iqdb"));
                }
            }
        }
    }

    posts.sort((a, b) => { return b.similarity - a.similarity });

    let best_post_combined = posts[0];
    for (let i = 0; i < sourcePrecedence.length; i++) {
        let res = posts.find((value) => { return value.url.includes(sourcePrecedence[i]) && value.similarity >= min_similarity });
        if (res) {
            best_post_combined = res;
            break;
        }
    }

    if (best_post_combined) {
        const embed = new MessageEmbed();
        embed.setTitle(`Result from ${best_post_combined.source}`);
        embed.setColor(perc2color(best_post_combined.similarity));
        embed.setDescription(`similarity: ${best_post_combined.similarity}`);

        if (best_post_combined.url.includes('danbooru')) {
            const post = await booru.posts(+getFileName(best_post_combined.url));
            setEmbedFields(embed, post.tag_string_artist || '-',
                post.tag_string_character || '-',
                post.tag_string_general || '-',
                post.tag_string_copyright || '-',
                best_post_combined.url, best_post_combined.thumbnail,
                file);
        } else if (best_post_combined.url.includes('gelbooru')) {

            await grabBySelectors(best_post_combined, embed, file,
                '#tag-list > li.tag-type-artist > a',
                '#tag-list > li.tag-type-copyright > a',
                '#tag-list > li.tag-type-character > a',
                '#tag-list > li.tag-type-general > a');

        } else if (best_post_combined.url.includes('sankakucomplex')) {

            await grabBySelectors(best_post_combined, embed, file,
                '#tag-sidebar > li.tag-type-artist > a',
                '#tag-sidebar > li.tag-type-copyright > a',
                '#tag-sidebar > li.tag-type-character > a',
                '#tag-sidebar > li.tag-type-general > a');

        } else if (best_post_combined.url.includes('yande') || best_post_combined.url.includes('konachan')) {

            await grabBySelectors(best_post_combined, embed, file,
                '#tag-sidebar > li.tag-type-artist > a:nth-child(2)',
                '#tag-sidebar > li.tag-type-copyright > a:nth-child(2)',
                '#tag-sidebar > li.tag-type-character > a:nth-child(2)',
                '#tag-sidebar > li.tag-type-general > a:nth-child(2)');

        } else {

            setEmbedFields(embed, best_post_combined.author.replaceAll(' ', '_') || '-',
                '-',
                '-',
                '-',
                best_post_combined.url, best_post_combined.thumbnail,
                file);
        }
        channel?.send({
            embeds: [embed]
        });
    } else {
        sendToChannel(channel, "No sauce found :(")
    }

    return best_post_combined;
}

export async function searchImages(searchQuery: string, channel: TextBasedChannel | null) {

    let images: string[];
    images = walk(getImgDir());

    if (images.length > 0 && !db.exists(`^${images[0]}`)) {
        await sendToChannel(channel, "refreshing image tag database, might take a while...");
        await Promise.all(images.map((value) => {
            ensureTagsInDB(value);
        }));
        await sleep(5000); // let the database save
    }

    let search_terms = trimStringArray(searchQuery.split(';'));
    for (let i = 0; i < search_terms.length; i++) {

        let activeModifier_key = "";
        let activeModifier = (_content: string[], _search_term: string[]) => true;
        for (let [key, func] of search_modifiers.entries()) {
            if (search_terms[i].indexOf(key) != -1) {
                activeModifier_key = key;
                activeModifier = func;
                break;
            }
        }

        let search_term_split = trimStringArray(search_terms[i].split(activeModifier_key));

        if (search_term_split.length != 2) {
            sendToChannel(channel, `Invalid search term ${search_terms[i]}`);
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