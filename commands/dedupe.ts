import { ICommand } from "dkrcommands";
import { db } from "..";
import fs from "fs";
import { getValueIfExists, safeReply, sendToChannel, walk } from "discord_bots_common";
import { getImgDir } from "../sauce_utils";
import { ensureTagsInDB } from "../tagging_utils";

const phash_dist = require("sharp-phash/distance");

export default {
    category: "Image management",
    description: "Dedupe image database",

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    callback: async ({ channel, interaction }) => {

        await safeReply(interaction, "🗃 Deduping databse...");

        const images = walk(await getImgDir());
        const sourcePostMap = new Map<string, string>();
        const phashMap = new Map<string, string[]>();
        let deleted = 0;
        for (const image of images) {
            await ensureTagsInDB(image);
            const sourcePost = await getValueIfExists(db, `^${image}^tags^sourcepost`);
            const phash = await getValueIfExists(db, `^${image}^phash`);
            if (sourcePost != "-" && sourcePostMap.has(sourcePost)) {
                try {
                    fs.unlinkSync(image);
                    deleted++;
                    sendToChannel(channel, `🗑 Deleted ${image}`);
                } catch (err) {
                    sendToChannel(channel, `❌ Error deleting ${image}`, true);
                }
            } else {
                sourcePostMap.set(sourcePost, image);
            }

            if (phash != "-") {
                let found = false;
                for (const [fingerprint, similar] of phashMap) {
                    if (phash_dist(fingerprint, phash) < 3) {
                        similar.push(phash);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    phashMap.set(phash, []);
                }
            }

        }
        await safeReply(interaction, `🟩 Dedupe finished, ${deleted} images deleted`);
    }
} as ICommand;