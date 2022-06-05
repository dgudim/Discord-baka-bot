import { ICommand } from "wokcommands";
import { getFileName, getLastFile, getLastFileUrl, getLastTags, isUrl, perc2color, sendToChannel, setLastTags, tagContainer } from "../utils";
import sagiri from "sagiri";
import { MessageEmbed, TextBasedChannel } from "discord.js";

const Danbooru = require('danbooru');
const booru = new Danbooru();

const sagiri_client = sagiri("d78bfeac5505ab0a2af7f19d369029d4f6cd5176");

import iqdb from '@l2studio/iqdb-api';

import puppeteer, { Browser, Page } from 'puppeteer'
let browser: Browser;
let page: Page;

const sourcePrecedence = ['danbooru', 'gelbooru', 'yande.re', "konachan"]

async function getTagsBySelector(selector: string) {
    return page.evaluate(sel => {
        return Array.from(document.querySelectorAll(sel))
            .map(elem => elem.textContent);
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
    if (!isUrl(sourceFile)) {
        setLastTags(new tagContainer(
            character,
            author,
            tags,
            copyright,
            resultUrl,
            sourceFile));
    }
}

class Post {
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

    setEmbedFields(embed, authorTags.join(",") || '-',
        characterTags.join(",") || '-',
        generalTags.join(",") || '-',
        copyrightTags.join(",") || '-',
        post.url, post.thumbnail,
        sourceFile);
}

async function findSauce(file: string, channel: TextBasedChannel | null) {
    
    if (!browser) {
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        page = await browser.newPage();
        console.log('stating puppeteer');
    }

    let sagiriResults

    let posts = [];
    try {
        sagiriResults = await sagiri_client(file);

        console.log(`got ${sagiriResults.length} results from sagiri`);

        for (let result of sagiriResults) {
            posts.push(new Post(
                result.url,
                result.similarity,
                result.thumbnail,
                result.authorName || '-',
                "saucenao"));
        }

    } catch (err) {
        sendToChannel(channel, "Sagiri api call error: " + err);
        console.log("Sagiri api call error: " + err);
    }

    let callIq = !sagiriResults;

    if (!posts.some((post) => post.url.includes('booru'))) {
        callIq = true;
    }

    if (callIq) {
        sendToChannel(channel, "calling iqdb, wait...");
        let iqDbResults = await iqdb(file);
        if (iqDbResults.results) {
            for (let result of iqDbResults.results) {
                posts.push(new Post(
                    result.url,
                    result.similarity,
                    result.image,
                    '-', "iqdb"));
            }
        }
    }

    posts.sort((a, b) => { return b.similarity - a.similarity });

    console.log(`sorted posts: ${posts}`);

    let best_post_combined = posts[0];
    for (let i = 0; i < sourcePrecedence.length; i++) {
        let res = posts.find((value) => { return value.similarity >= 80 && value.url.includes(sourcePrecedence[i]) });
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

        } else if (best_post_combined.url.includes('yande') || best_post_combined.url.includes('konachan')) {

            await grabBySelectors(best_post_combined, embed, file,
                '#tag-sidebar > li.tag-type-artist > a:nth-child(2)',
                '#tag-sidebar > li.tag-type-copyright > a:nth-child(2)',
                '#tag-sidebar > li.tag-type-character > a:nth-child(2)',
                '#tag-sidebar > li.tag-type-general > a:nth-child(2)');

        } else {

            setEmbedFields(embed, best_post_combined.author || '-',
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
}

export default {
    category: 'Misc',
    description: 'Get sauce of an image',

    slash: 'both',
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    expectedArgs: '<url>',
    expectedArgsTypes: ['STRING'],
    minArgs: 0,
    maxArgs: 1,

    callback: async ({ args, channel }) => {

        if (!args.length) {
            const file = getLastFile();
            if (!file) {
                return "No file provided."
            }
            findSauce(file, channel);
            return `searching sauce for ${getFileName(file)}`;
        }

        if (isUrl(args[0])) {
            findSauce(args[0], channel);
            return `searching sauce for ${getFileName(args[0])}`;
        }

        return "Invalid url."
    }
} as ICommand