import { ICommand } from "dkrcommands";
import { isNSFW, findSauce, getLastImgUrl, sendImgToChannel } from "../sauce_utils";
import fs from "fs";
import https from "https";
import sharp from "sharp";
import { CommandInteraction, TextBasedChannel, ApplicationCommandOptionType } from "discord.js";
import { none, nullableString, safeReply, getFileName, sendToChannel, getAllUrlFileAttachements, fetchUrl, isImageUrlType, isPngOrJpgUrlType } from "discord_bots_common/dist/utils/utils";

async function searchAndSendSauce(
    interaction: CommandInteraction | none, channel: TextBasedChannel,
    min_similarity: number, url: nullableString) {

    if (!url) {
        return safeReply(interaction, "❌ No file provided.");
    }

    await safeReply(interaction, `🔎 Searching sauce for \`${getFileName(url)}\``);
    await sendToChannel(channel, (await findSauce(url, channel, min_similarity)).embed);
}

export default {
    category: "Image management",
    description: "Get sauce of an image",

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
    }],

    callback: async ({ channel, interaction, }) => {

        if (!isNSFW(channel, interaction)) {
            return;
        }

        const min_similarity = interaction!.options.getNumber("min-similarity") || 75;

        const urls = await getAllUrlFileAttachements(interaction, "url", "image", true);

        if (!urls.length) {
            return searchAndSendSauce(interaction, channel, min_similarity, getLastImgUrl(channel));
        }

        await safeReply(interaction, `📥 Getting sauce for ${urls.length} image(s)`);

        for (const image_url of urls) {

            const res = await fetchUrl(image_url);

            if (!isImageUrlType(res.type)) {
                return safeReply(interaction, "🚫 Url does not point to an image");
            }

            if (isPngOrJpgUrlType(res.type)) {
                await sendToChannel(channel, image_url);
                await searchAndSendSauce(interaction, channel, min_similarity, image_url);
            } else {

                await safeReply(interaction, "🕜 Attachement is not jpg or png, converting, please wait");

                const filePath = "/tmp/temp.jpg";
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

                    file_stream.on("finish", async () => {
                        file_stream.close();
                        await sendImgToChannel(channel, filePath);
                        await searchAndSendSauce(interaction, channel, min_similarity, getLastImgUrl(channel));
                    });
                });
            }
        }
    }
} as ICommand;