import { ICommand } from "dkrcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { fetchUrl, getFileName, isImageUrlType, isUrl, safeReply, sendToChannel } from "discord_bots_common";
import { findSauce, getImgDir, getLastImgUrl, getPostInfoFromUrl, grabImageUrl, sendImgToChannel } from "../sauce_utils";
import sharp from "sharp";
import { getSauceConfString } from "../config";
import { ensureTagsInDB, writeTagsToFile } from "../tagging_utils";
import { ApplicationCommandOptionType } from "discord.js";

export default {
    category: 'Admin image management',
    description: 'Download an image, tag it and save it to the database',

    slash: 'both',
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    options: [{
        name: "url",
        description: "Image url",
        type: ApplicationCommandOptionType.String,
        required: false,
    }, {
        name: "file",
        description: "Image file",
        type: ApplicationCommandOptionType.Attachment,
        required: false,
    }],

    callback: async ({ interaction, channel }) => {

        const interaction_nn = interaction!;

        let urls: string[] = [];
        let argument_url = interaction_nn.options.getString("url");
        let embed_url = interaction_nn.options.getAttachment("file")?.url;
        
        if (await isUrl(argument_url)) {
            urls.push(argument_url!);
        } else if (argument_url) {
            await sendToChannel(channel, 'Invalid url');
        }   
        if (await isUrl(embed_url)) {
            urls.push(embed_url!);
        }        

        if(!urls.length) {
            await sendToChannel(channel, 'No images to add');
            return;
        } else {
            await safeReply(interaction_nn, 'Adding image(s) to db');
        }

        for (const url of urls) {

            const res = await fetchUrl(url);

            if (res.ok) {

                const is_plain_image = isImageUrlType(res.type);
                const img_url = is_plain_image ? url : await grabImageUrl(url);

                if (img_url) {

                    let fileName = getFileName(img_url) + '.jpeg';
                    const file_path = path.join(await getImgDir(), fileName);

                    if (fs.existsSync(file_path)) {
                        await sendToChannel(channel, 'file aleady exists');
                        return;
                    }

                    await sendToChannel(channel, `saving as ${fileName}`);

                    const file = fs.createWriteStream(file_path);

                    https.get(img_url, (response) => {

                        const sharpPipeline = sharp();
                        sharpPipeline.jpeg({
                            quality: 100
                        }).pipe(file);

                        response.pipe(sharpPipeline);

                        file.on('finish', async () => {
                            file.close();
                            sendToChannel(channel, `saved ${fileName}, `);
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
                                    sendToChannel(channel, `wrote tags`);
                                    ensureTagsInDB(file_path);
                                });
                            } else {
                                await sendToChannel(channel, `could not get tags`);
                            }
                        });
                    });
                } else {
                    await sendToChannel(channel, 'could not get image url from page');
                }
            } else {
                await sendToChannel(channel, `return code: ${res.status}, ${res.statusText}`);
            }
        }

    }
} as ICommand