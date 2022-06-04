import { ICommand } from "wokcommands";
import { getFileName, getLastFile, getLastTags, isUrl, perc2color, sendToChannel, setLastTags, tagContainer } from "../utils";
import sagiri from "sagiri";
import { MessageEmbed, TextBasedChannel } from "discord.js";
const Danbooru = require('danbooru')
const booru = new Danbooru()

const sagiri_client = sagiri("d78bfeac5505ab0a2af7f19d369029d4f6cd5176");

async function findSauce(file: string, channel: TextBasedChannel | null) {
    try {
        const results = await sagiri_client(file);

        let best_post = results.find((value) => { return value.similarity >= 80 && value.site == 'Danbooru' });
        if(!best_post) {
            best_post = results.find((value) => { return value.similarity >= 80 && value.site == 'Pixiv' }) || results[0];
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