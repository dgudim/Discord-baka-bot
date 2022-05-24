import { TextBasedChannel } from "discord.js";
import { config } from "./index"
import fs from "fs";

export function changeSavedDirectory(channel: TextBasedChannel | null, dir_type: string, dir: string, key: string) {
    if (dir) {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            channel?.send({
                content: `Changed ${dir_type} directory to ${dir}`
            });
            config.set(key, dir.endsWith('/') ? dir : (dir + "/"));
            config.save();
            return true;
        } else {
            channel?.send({
                content: `Invalid ${dir_type} directory, will use previous`
            });
            return false;
        }
    }
}