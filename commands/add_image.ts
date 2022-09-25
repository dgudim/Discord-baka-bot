import { ICommand } from "dkrcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { fetchUrl, getAllUrlFileAttachements, getFileName, isImageUrlType, safeReply, sendToChannel, sleep, walk } from "discord_bots_common";
import { findSauce, getImgDir, getLastImgUrl, getPostInfoFromUrl, getSauceConfString, grabImageUrl, ensurePixivLogin, sendImgToChannel, PostInfo } from "../sauce_utils";
import sharp from "sharp";
import { ensureTagsInDB, writeTagsToFile } from "../tagging_utils";
import { ApplicationCommandOptionType, TextChannel } from "discord.js";
import { IncomingMessage } from "http";

async function getFilePath(file_name: string, channel: TextChannel) {
    file_name = file_name.endsWith(".jpeg") ? file_name : file_name + '.jpeg';
    const file_path = path.join(await getImgDir(), file_name);

    if (fs.existsSync(file_path)) {
        await sendToChannel(channel, '❌ File aleady exists', true);
        return undefined;
    }

    return file_path;
}

async function getMetadata(channel: TextChannel, img_url: string, is_plain_image: boolean, file_name: string) {

    const file_path = await getFilePath(file_name, channel);
    if (!file_path) {
        return undefined;
    }

    let postInfo;
    if (!is_plain_image) {
        postInfo = await getPostInfoFromUrl(img_url);
    }

    if (!is_plain_image) {
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

    return { postInfo, file_name, file_path };
}

async function processAndSaveImage(
    source: fs.ReadStream | IncomingMessage,
    metadata: { postInfo: PostInfo | undefined, file_name: string, file_path: string } | undefined,
    channel: TextChannel) {

    if (!metadata) {
        return;
    }

    await sendToChannel(channel, `📥 Saving as ${metadata.file_name}`);

    const target = fs.createWriteStream(metadata.file_path);

    const sharpPipeline = sharp();
    sharpPipeline.jpeg({
        quality: 100
    }).pipe(target);

    source.pipe(sharpPipeline);

    return new Promise<void>(resolve => {

        target.on('finish', async () => {
            target.close();
            await sendToChannel(channel, `💾 Saved ${metadata.file_name}, `);

            if (metadata.postInfo) {
                await writeTagsToFile(getSauceConfString(metadata.postInfo), metadata.file_path, channel, async () => {
                    await ensureTagsInDB(metadata.file_path);
                    await sendToChannel(channel, `📝 Wrote tags`);
                });
            } else {
                await sendToChannel(channel, `❌ Could not get tags`, true);
            }

            resolve();
        });

    })
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

                        // monitor size (wait for files to be saved) (idk why await on downloadIllust is not enough)
                        let exit = false;
                        let prev_time = 0;
                        let images: string[] = [];
                        while(true) {
                            let images_stats = fs.readdirSync(img_dir);
                            let curr_time = 0;
                            images = [];
                            for (const image_stats of images_stats) {
                                const file = img_dir + "/" + image_stats;
                                images.push(file);
                                const stat = fs.statSync(file);
                                curr_time += stat.mtime.getTime();
                            }
                            if(exit) {
                                break;
                            }
                            exit = prev_time == curr_time;
                            prev_time = curr_time;
                            await sleep(1500);
                        }

                        const postInfo = await getPostInfoFromUrl(url);

                        for (const image of images) {
                            const new_file_name = getFileName(image);
                            const new_file_path = await getFilePath(new_file_name, channel);
                            if(new_file_path) {
                                await processAndSaveImage(fs.createReadStream(image), { 
                                    postInfo: postInfo, 
                                    file_name: new_file_name, 
                                    file_path: new_file_path }, channel);
                            }
                            fs.unlinkSync(image);
                        }

                    } else {
                        await safeReply(interaction_nn, "🚫 Can't download from pixiv without token");
                    }
                    return;
                }


                const img_url = is_plain_image ? url : await grabImageUrl(url);

                if (img_url) {
                    https.get(img_url, async (response) => {
                        processAndSaveImage(response, await getMetadata(channel, img_url, is_plain_image, getFileName(img_url)), channel);
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