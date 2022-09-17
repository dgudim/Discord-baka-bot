import { ICommand } from "dkrcommands";
import { findSauce, getLastImgUrl, sendImgToChannel } from "../sauce_utils";
import fs from "fs";
import https from 'https';
import sharp from "sharp";
import { fetchUrl, getAllUrlFileAttachements, getFileName, isImageUrlType, isPngOrJpgUrlType, isUrl, safeReply, sendToChannel } from "discord_bots_common";
import { CommandInteraction, TextBasedChannel, ApplicationCommandOptionType } from "discord.js";

async function searchAndSendSauce(
    interaction: CommandInteraction, channel: TextBasedChannel,
    min_similarity: number, fileOrUrl: string | undefined) {

    if (!fileOrUrl) {
        await safeReply(interaction, "No file provided.");
        return;
    }

    await safeReply(interaction, `Searching sauce for ${getFileName(fileOrUrl)}`);
    let sauce = await findSauce(fileOrUrl, channel, min_similarity);
    if (sauce) {
        await sendToChannel(channel, sauce.embed);
    }
}

export default {
    category: 'Image management',
    description: 'Get sauce of an image',

    slash: true,
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    options: [{
        name: "url",
        description: "Url to get the sauce from",
        type: ApplicationCommandOptionType.String,
        required: false
    }, {
        name: "image",
        description: "File to get the sauce from",
        type: ApplicationCommandOptionType.Attachment,
        required: false
    }, {
        name: "min-similarity",
        description: "Minimum similarity of the image (1-100)",
        type: ApplicationCommandOptionType.Integer,
        required: false
    }
    ],

    callback: async ({ channel, interaction, }) => {

        let interaction_nn = interaction!;

        let min_similarity = interaction_nn.options.getNumber('min-similarity') || 75;

        let urls = await getAllUrlFileAttachements(interaction_nn, "url", "image", true);

        if (!urls.length) {
            await searchAndSendSauce(interaction_nn, channel, min_similarity, getLastImgUrl(channel));
            return;
        }

        await safeReply(interaction_nn, `Getting sauce for ${urls.length} image(s)`);

        for (let image_url of urls) {
            let res = await fetchUrl(image_url);
            if (isPngOrJpgUrlType(res.type)) {
                await searchAndSendSauce(interaction_nn, channel, min_similarity, image_url);
            } else {

                await safeReply(interaction_nn, 'Attachement is not jpg or png, converting, please wait');

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
                        await searchAndSendSauce(interaction_nn, channel, min_similarity, getLastImgUrl(channel));
                    });
                });
            }
        }
    }
} as ICommand