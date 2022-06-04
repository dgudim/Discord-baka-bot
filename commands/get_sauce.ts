import { ICommand } from "wokcommands";
import { getFileName, getLastFile, getLastFileUrl, getLastTags, isUrl, perc2color, sendToChannel, setLastTags, tagContainer } from "../utils";
import sagiri from "sagiri";
import { MessageEmbed, TextBasedChannel } from "discord.js";

const Danbooru = require('danbooru');
const booru = new Danbooru();

const sagiri_client = sagiri("d78bfeac5505ab0a2af7f19d369029d4f6cd5176");

import puppeteer, { Browser, Page } from 'puppeteer'
let browser: Browser;
let page: Page;

const sourcePrecedence = ['Danbooru', 'Yande.re']

async function getTagsBySelector(selector: string) {
    return page.evaluate(sel => {
        return Array.from(document.querySelectorAll(sel))
            .map(elem => elem.textContent);
    }, selector);
}

async function findSauce(file: string, channel: TextBasedChannel | null) {
    try {

        if (!browser) {
            browser = await puppeteer.launch();
            page = await browser.newPage();
        }
        
        const results = await sagiri_client(file);

        let best_post = results[0];
        for (let i = 0; i < sourcePrecedence.length; i++) {
            let res = results.find((value) => { return value.similarity >= 80 && value.site == sourcePrecedence[i] });
            if(res){
                best_post = res;
                break;
            }
        }

        const embed = new MessageEmbed();
        embed.setTitle(`Result from saucenao`);
        embed.setColor(perc2color(best_post.similarity));
        embed.setDescription(`similarity: ${best_post.similarity}`);
        embed.setURL(best_post.url);
        embed.setImage(best_post.thumbnail);
        if (best_post.site == 'Danbooru') {
            const post = await booru.posts(+getFileName(best_post.url))
            embed.addFields([{
                name: "Author",
                value: post.tag_string_artist || '-'
            },
            {
                name: "Character",
                value: post.tag_string_character || '-'
            },
            {
                name: "Tags",
                value: post.tag_string_general || '-'
            },
            {
                name: "Copyright",
                value: post.tag_string_copyright || '-'
            }]);
            if (!isUrl(file)) {
                setLastTags(new tagContainer(
                    post.tag_string_character,
                    post.tag_string_artist,
                    post.tag_string_general,
                    post.tag_string_copyright,
                    best_post.url,
                    file));
            }
        } else if (best_post.site == 'Yande.re') {

            await page.goto(best_post.url);

            const authorTags = await getTagsBySelector('#tag-sidebar > li.tag-type-artist > a:nth-child(2)');
            const copyrightTags = await getTagsBySelector('#tag-sidebar > li.tag-type-copyright > a:nth-child(2)');
            const characterTags = await getTagsBySelector('#tag-sidebar > li.tag-type-character > a:nth-child(2)');
            const generalTags = await getTagsBySelector('#tag-sidebar > li.tag-type-general > a:nth-child(2)');

            embed.addFields([{
                name: "Author",
                value: authorTags.join(",") || '-'
            },
            {
                name: "Character",
                value: characterTags.join(",") || '-'
            },
            {
                name: "Tags",
                value: generalTags.join(",") || '-'
            },
            {
                name: "Copyright",
                value: copyrightTags.join(",") || '-'
            }]);

            if (!isUrl(file)) {
                setLastTags(new tagContainer(
                    characterTags.join(","),
                    authorTags.join(","),
                    generalTags.join(","),
                    copyrightTags.join(","),
                    best_post.url,
                    file));
            }

        } else {
            embed.addFields([{
                name: "Author",
                value: best_post.authorName || '-'
            },
            {
                name: "Author url",
                value: best_post.authorUrl || '-'
            }]);
            if (!isUrl(file)) {
                setLastTags(new tagContainer(
                    '',
                    best_post.authorName || '-',
                    '',
                    '',
                    best_post.url,
                    file));
            }
        }
        embed.addField("Site", best_post.site);
        channel?.send({
            embeds: [embed]
        });
    } catch (err) {
        sendToChannel(channel, "Error occured while calling the api: " + err);
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