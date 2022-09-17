import { ICommand } from "dkrcommands";
import { db } from "..";
import fs from "fs";
import { safeReply, sendToChannel, walk } from "discord_bots_common";
import { getImgDir } from "../sauce_utils";

export default {
    category: 'Image management',
    description: 'Dedupe image database',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    callback: async ({ channel, interaction }) => {

        let interaction_nn = interaction!;

        await safeReply(interaction_nn, "Deduping databse...");

        let images = walk(await getImgDir());
        let hashMap = new Map<string, string>();
        let deleted = 0;
        for (const image of images) {
            let sourcePost;
            if (await db.exists(`^${image}^tags^sourcepost`)) {
                sourcePost = await db.getData(`^${image}^tags^sourcepost`);
                if (sourcePost != '-' && hashMap.has(sourcePost)) {
                    try {
                        fs.unlinkSync(image);
                        deleted++;
                        sendToChannel(channel, `deleted ${image}`);
                    } catch (err) {
                        sendToChannel(channel, `error deleting ${image}`);
                    }
                } else {
                    hashMap.set(sourcePost, image);
                }
            }
        }
        await safeReply(interaction_nn, `Dedupe finished, ${deleted} images deleted`);
    }
} as ICommand