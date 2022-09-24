import { ICommand } from "dkrcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { fetchUrl, getAllUrlFileAttachements, getFileName, info, isImageUrlType, safeReply, sendToChannel, sleep, walk } from "discord_bots_common";
import { findSauce, getImgDir, getLastImgUrl, getPostInfoFromUrl, getSauceConfString, grabImageUrl, ensurePixivLogin, sendImgToChannel } from "../sauce_utils";
import sharp from "sharp";
import { ensureTagsInDB, writeTagsToFile } from "../tagging_utils";
import { ApplicationCommandOptionType, TextChannel } from "discord.js";
import { IncomingMessage } from "http";

async function processAndSaveImage(
    source: fs.ReadStream | IncomingMessage,
    file_name: string,
    channel: TextChannel, img_url: string, 
    send_from_target_file: boolean, is_plain_image: boolean) {

    file_name = file_name.endsWith(".jpeg") ? file_name : file_name + '.jpeg';
    const file_path = path.join(await getImgDir(), file_name);

    if (fs.existsSync(file_path)) {
        await sendToChannel(channel, '❌ File aleady exists', true);
        return;
    }

    await sendToChannel(channel, `📥 Saving as ${file_name}`);

    const target = fs.createWriteStream(file_path);

    const sharpPipeline = sharp();
    sharpPipeline.jpeg({
        quality: 100
    }).pipe(target);

    source.pipe(sharpPipeline);

    target.on('finish', async () => {
        target.close();
        await sendToChannel(channel, `💾 Saved ${file_name}, `);
        let postInfo;
        if (!is_plain_image) {
            postInfo = await getPostInfoFromUrl(img_url);
        }

        if (send_from_target_file || !is_plain_image) {
            await sendImgToChannel(channel, file_path);
        } else {
            await sendToChannel(channel, img_url);
        }

        if (!postInfo) {
            const sauce = await findSauce(getLastImgUrl(channel), channel, 85);
            if (sauce && sauce.post.similarity >= 85) {
                postInfo = sauce.postInfo;
            }
        }

        if (postInfo) {
            writeTagsToFile(getSauceConfString(postInfo), file_path, channel, () => {
                sendToChannel(channel, `📝 Wrote tags`);
                ensureTagsInDB(file_path);
            });
        } else {
            await sendToChannel(channel, `❌ Could not get tags`, true);
        }
    });
}

export default {
    category: 'Admin image management',
    description: 'Download an image, tag it and save it to the database',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    options: [{
        name: "url",
        description: "Image url",
        type: ApplicationCommandOptionType.String,
        required: false,
    }, {
        name: "image",
        description: "Image file",
        type: ApplicationCommandOptionType.Attachment,
        required: false,
    }],

    callback: async ({ interaction, channel }) => {

        const interaction_nn = interaction!;

        let urls = await getAllUrlFileAttachements(interaction_nn, "url", "image", true);

        if (!urls.length) {
            await safeReply(interaction_nn, '🚫 No images to add');
            return;
        } else {
            await safeReply(interaction_nn, '📥 Adding image(s) to db');
        }

        for (const url of urls) {

            const res = await fetchUrl(url);

            if (res.ok) {

                const is_plain_image = isImageUrlType(res.type);

                // special treatment for pixiv
                if (!is_plain_image && url.includes('pixiv')) {
                    const client = await ensurePixivLogin();
                    if (client) {
                        const illust = await client.illust.get(url);
                        const img_dir = "./downloaded";
                        await sendToChannel(channel, `📥 Downloading from pixiv`);
                        await client.util.downloadIllust(illust, img_dir, "original");

                        // wait for images to be saved (idk why await on downloadIllust is not enough)
                        await sleep(3000);

                        const images = walk(img_dir);

                        for (const image of images) {
                            await processAndSaveImage(fs.createReadStream(image), getFileName(image), channel, url, true, is_plain_image);
                            fs.unlinkSync(image);
                        }

                    } else {
                        await safeReply(interaction_nn, "🚫 Can't download from pixiv without token");
                    }
                    return;
                }


                const img_url = is_plain_image ? url : await grabImageUrl(url);

                if (img_url) {
                    https.get(img_url, (response) => {
                        processAndSaveImage(response, getFileName(img_url), channel, img_url, false, is_plain_image);
                    });
                } else {
                    await sendToChannel(channel, '❌ Could not get image url from page', true);
                }
            } else {
                await sendToChannel(channel, `❌ Return code: ${res.status}, ${res.statusText}`, true);
            }
        }

    }
} as ICommand