import { ICommand } from "wokcommands";
import { findSauce } from "../sauce_utils";
import fs from "fs";
import https from 'https';
import sharp from "sharp";
import { combinedReply, fetchUrl, getFileName, getLastImgUrl, isImageUrlType, isPngOrJpgUrlType, isUrl, sendImgToChannel, sendToChannel } from "../utils";
import { Message, CommandInteraction, TextBasedChannel } from "discord.js";

async function searchAndSendSauce(
    interaction: CommandInteraction, message: Message, channel: TextBasedChannel,
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

        if (!url) {

            if (message && message.attachments.size) {
                let attachmentUrl = message.attachments.at(0)!.url;
                const res = await fetchUrl(attachmentUrl);
                if (isImageUrlType(res.type)) {
                    if (isPngOrJpgUrlType(res.type)) {
                        await searchAndSendSauce(interaction, message, channel, min_similarity, attachmentUrl);
                    } else {

                        await combinedReply(interaction, message, 'attachement is not jpg or png, converting, please wait');

                        const filePath = '/tmp/temp.jpg';
                        const file_stream = fs.createWriteStream(filePath);
                        if(fs.existsSync(filePath)){
                            fs.unlinkSync(filePath);
                        }

                        https.get(attachmentUrl, response => {

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
                } else {
                    await combinedReply(interaction, message, 'attachement does not look like an image');
                }
                return;
            }

            await searchAndSendSauce(interaction, message, channel, min_similarity, getLastImgUrl(channel));
            return;
        }

        if (isUrl(url)) {
            await searchAndSendSauce(interaction, message, channel, min_similarity, url);
        } else {
            await combinedReply(interaction, message, "Invalid Url");
        }
    }
} as ICommand