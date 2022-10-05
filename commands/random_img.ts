import { ICommand } from "dkrcommands";
import { isNSFW, getImgDir, sendImgToChannel } from "../sauce_utils";
import { safeReply, walk } from "discord_bots_common";

let indexUpToDate = false;
let index: string[] = [];
let currImg = 0;

export default {

    category: "Image management",
    description: "Get random image from image database",

    slash: true,
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    callback: async ({ channel, interaction }) => {

        if (!isNSFW(channel, interaction)) {
            return;
        }

        try {
            currImg++;

            if (!indexUpToDate || currImg == index.length) {
                index = walk(await getImgDir());
                index = index
                    .map(value => ({ value, sort: Math.random() }))
                    .sort((a, b) => a.sort - b.sort)
                    .map(({ value }) => value);
                currImg = 0;
                await safeReply(interaction, `📤 Loaded ${index.length} images`);
                indexUpToDate = true;
            }
            await safeReply(interaction, "🖼 Here is your image");

            await sendImgToChannel(channel, index[currImg], true);

        } catch (err) {
            await safeReply(interaction, `❌ Error: ${err}`);
        }
    }
} as ICommand;