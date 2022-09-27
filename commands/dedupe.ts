import { ICommand } from "dkrcommands";
import { db } from "..";
import fs from "fs";
import { safeReply, sendToChannel, walk } from "discord_bots_common";
import { getImgDir } from "../sauce_utils";

export default {
    category: "Image management",
    description: "Dedupe image database",

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    callback: async ({ channel, interaction }) => {

        const interaction_nn = interaction!;

        await safeReply(interaction_nn, "🗃 Deduping databse...");

        const images = walk(await getImgDir());
        const hashMap = new Map<string, string>();
        let deleted = 0;
        for (const image of images) {
            let sourcePost;
            if (await db.exists(`^${image}^tags^sourcepost`)) {
                sourcePost = await db.getData(`^${image}^tags^sourcepost`);
                if (sourcePost != "-" && hashMap.has(sourcePost)) {
                    try {
                        fs.unlinkSync(image);
                        deleted++;
                        sendToChannel(channel, `🗑 Deleted ${image}`);
                    } catch (err) {
                        sendToChannel(channel, `❌ Error deleting ${image}`, true);
                    }
                } else {
                    hashMap.set(sourcePost, image);
                }
            }
        }
        await safeReply(interaction_nn, `🟩 Dedupe finished, ${deleted} images deleted`);
    }
} as ICommand;