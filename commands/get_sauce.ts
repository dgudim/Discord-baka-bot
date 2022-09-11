import { ICommand } from "dkrcommands";
import { findSauce, getLastImgUrl, sendImgToChannel } from "../sauce_utils";
import fs from "fs";
import https from 'https';
import sharp from "sharp";
import { combinedReply, fetchUrl, getFileName, isImageUrlType, isPngOrJpgUrlType, isUrl, sendToChannel } from "discord_bots_common";
import { Message, CommandInteraction, TextBasedChannel } from "discord.js";

async function searchAndSendSauce(
    interaction: CommandInteraction | undefined, message: Message | undefined, channel: TextBasedChannel,
    min_similarity: number, fileOrUrl: string | undefined) {

    if (!fileOrUrl) {
        await combinedReply(interaction, message, "No file provided.");
        return;
    }

    await combinedReply(interaction, message, `searching sauce for ${getFileName(fileOrUrl)}`);
    let sauce = await findSauce(fileOrUrl, channel, min_similarity);
    if (sauce) {
        await sendToChannel(channel, sauce.embed);
    }
}

export default {
    category: 'Image management',
    description: 'Get sauce of an image',

    slash: 'both',
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    expectedArgs: '<url> <min-similarity>',
    expectedArgsTypes: ['STRING', 'NUMBER'],
    minArgs: 0,
    maxArgs: 2,

    callback: async ({ channel, interaction, message, args }) => {

        let url = interaction ? interaction.options.getString('url') : args[0];
        let min_similarity = (interaction ? interaction.options.getNumber('min-similarity') : +args[1]) || 75;

        let urls: string[] = [];
        if (url) {
            if (await isUrl(url)) {
                urls.push(url);
            } else {
                await combinedReply(interaction, message, "Invalid Url");
            }
        }

        if (message && message.attachments.size) {
            for (let attachement of message.attachments) {
                let res = await fetchUrl(attachement[1].url);
                if (isImageUrlType(res.type)) {
                    urls.push(attachement[1].url);
                } else {
                    await sendToChannel(channel, `attachement ${attachement[1].name} does not look like an image`);
                }
            }
        }

        if (!urls.length) {
            await searchAndSendSauce(interaction, message, channel, min_similarity, getLastImgUrl(channel));
            return;
        }

        await combinedReply(interaction, message, `Getting sauce for ${urls.length} image(s)`);

        for (let image_url of urls) {
            let res = await fetchUrl(image_url);
            if (isPngOrJpgUrlType(res.type)) {
                await searchAndSendSauce(interaction, message, channel, min_similarity, image_url);
            } else {

                await combinedReply(interaction, message, 'attachement is not jpg or png, converting, please wait');

                const filePath = '/tmp/temp.jpg';
                const file_stream = fs.createWriteStream(filePath);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                https.get(image_url, response => {

                    const sharpPipeline = sharp();
                    sharpPipeline.jpeg({
                        quality: 100
                    }).pipe(file_stream);

                    response.pipe(sharpPipeline);

                    file_stream.on('finish', async () => {
                        file_stream.close();
                        await sendImgToChannel(channel, filePath);
                        await searchAndSendSauce(interaction, message, channel, min_similarity, getLastImgUrl(channel));
                    });
                });
            }
        }
    }
} as ICommand