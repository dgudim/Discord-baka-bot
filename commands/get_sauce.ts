import { ICommand } from "wokcommands";
import { getFileName, getLastFile, perc2color, sendToChannel } from "../utils";
import sagiri from "sagiri";
import { MessageEmbed, TextBasedChannel } from "discord.js";

const sagiri_client = sagiri("d78bfeac5505ab0a2af7f19d369029d4f6cd5176");

async function findSauce(file: string, channel: TextBasedChannel | null) {
    const results = await sagiri_client(file);
    let images = 0;
    for (let i = 0; i < results.length; i++) {
        if (results[i].similarity >= 80) {
            images++;
            const embed = new MessageEmbed();
            embed.setTitle(`Result №${i + 1} from saucenao`);
            embed.setColor(perc2color(results[i].similarity));
            embed.setDescription(`similarity: ${results[i].similarity}`);
            embed.setURL(results[i].url);
            embed.setImage(results[i].thumbnail);
            embed.setFields([{
                name: "Author",
                value: results[i].authorName || '-'
            },
            {
                name: "Author url",
                value: results[i].authorUrl || '-'
            },
            {
                name: "Site",
                value: results[i].site
            }]);
            channel?.send({
                embeds: [embed]
            });
        }
    }
    if (!images){
        sendToChannel(channel, "No sauce found :(");
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

        if (args[0].startsWith('http://') || args[0].startsWith('https://')) {
            findSauce(args[0], channel);
            return `searching sauce for ${getFileName(args[0])}`;
        }

        return "Invalid url."
    }
} as ICommand