import { ICommand } from "wokcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { changeSavedDirectory, combinedReply, ensureTagsInDB, getFileName, getLastTags, isUrl, sendToChannel, writeTagsToFile } from "../utils";
import { getImgDir, getSendDir } from "..";
import { findSauce, grabImageUrl } from "../sauce_utils";
import sharp from "sharp";
import { getSauceConfString } from "../config";

export default {
    category: 'Misc',
    description: 'Download an image, tag it and save it to the database',

    slash: 'both',
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<url> <directory-path>',
    expectedArgsTypes: ['STRING', 'STRING'],
    minArgs: 1,
    maxArgs: 2,

    callback: async ({ message, interaction, channel, args }) => {

        changeSavedDirectory(channel, 'IMAGE', args[1]);

        if (isUrl(args[0])) {
            let input_url = args[0];
            let fileName = getFileName(input_url);
            await combinedReply(interaction, message, `saving as ${fileName}`);
            if (fs.existsSync(fileName)) {
                await combinedReply(interaction, message, 'file exists');
                return;
            }

            const res = await fetch(input_url);

            if (res.ok) {
                const buff = await res.blob();

                const img_url = buff.type.startsWith('image/') ? input_url : await grabImageUrl(input_url);

                if (img_url) {
                    const file_path = path.join(getImgDir(), fileName);
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
                            const sauce = await findSauce(img_url, channel, 85);
                            if (sauce && sauce.similarity >= 85) {
                                writeTagsToFile(getSauceConfString(getLastTags(channel)), file_path, channel, () => {
                                    sendToChannel(channel, `wrote tags`);
                                    ensureTagsInDB(file_path);
                                });
                            }
                        });
                    });
                } else {
                    await combinedReply(interaction, message, 'could not get image url from page');
                }

            } else {
                await combinedReply(interaction, message, 'url does not exist');
            }
        } else {
            await combinedReply(interaction, message, 'invalid url');
        }
    }
} as ICommand