import { ICommand } from "dkrcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { fetchUrl, getAllUrlFileAttachements, getFileName, isImageUrlType, safeReply, sendToChannel } from "discord_bots_common";
import { findSauce, getImgDir, getLastImgUrl, getPostInfoFromUrl, getSauceConfString, grabImageUrl, ensurePixivLogin, sendImgToChannel } from "../sauce_utils";
import sharp from "sharp";
import { ensureTagsInDB, writeTagsToFile } from "../tagging_utils";
import { ApplicationCommandOptionType } from "discord.js";

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
                        const img_dir = await getImgDir();
                        await sendToChannel(channel, `📥 Downloading from pixiv (${illust.user.name} - ${illust.title}) tp ${img_dir}`);
                        await client.util.downloadIllust(illust, img_dir, "original");
                        await sendToChannel(channel, `💾 Saved`);
                    } else {
                        await safeReply(interaction_nn, "🚫 Can't download from pixiv without token");
                    }
                    return;
                }

                const img_url = is_plain_image ? url : await grabImageUrl(url);
                

                if (img_url) {

                    let fileName = getFileName(img_url) + '.jpeg';
                    const file_path = path.join(await getImgDir(), fileName);

                    if (fs.existsSync(file_path)) {
                        await sendToChannel(channel, '❌ File aleady exists', true);
                        return;
                    }

                    await sendToChannel(channel, `📥 Saving as ${fileName}`);

                    const file = fs.createWriteStream(file_path);

                    https.get(img_url, (response) => {

                        const sharpPipeline = sharp();
                        sharpPipeline.jpeg({
                            quality: 100
                        }).pipe(file);

                        response.pipe(sharpPipeline);

                        file.on('finish', async () => {
                            file.close();
                            sendToChannel(channel, `💾 Saved ${fileName}, `);
                            let postInfo;
                            if (!is_plain_image) {
                                postInfo = await getPostInfoFromUrl(url);
                            }
                            if (!postInfo) {
                                await sendImgToChannel(channel, file_path);
                                const sauce = await findSauce(getLastImgUrl(channel), channel, 85);
                                if (sauce && sauce.post.similarity >= 85) {
                                    postInfo = sauce.postInfo;
                                }
                            } else if (interaction) {
                                await sendToChannel(channel, img_url);
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