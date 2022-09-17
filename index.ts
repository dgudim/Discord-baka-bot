import { GatewayIntentBits, TextBasedChannel, Message, Client, ApplicationCommandOptionType, Snowflake } from 'discord.js'; // discord api
import img_tags from './image_tags.json';
import path from 'path';
import fs from 'fs';
import { exec, spawn, ChildProcessWithoutNullStreams } from 'child_process';
import util from "util";
const execPromise = util.promisify(exec);
import dotenv from 'dotenv'; // evironment vars

import { JsonDB } from 'node-json-db';
import { Config } from 'node-json-db/dist/lib/JsonDBConfig'
import { getChannelName, getDateTime, getSimpleEmbed, messageReply, sendToChannel, debug, error, info, warn, colors, wrap, testEnvironmentVar, dkrInit } from 'discord_bots_common';
import { getKeyByDirType } from './sauce_utils';

import * as readline from 'readline';
import { messageReplies } from './config';

export const db = new JsonDB(new Config("db", true, true, '^'));

export let image_args_command_options: { name: string; description: string; type: ApplicationCommandOptionType | undefined; required: boolean; }[] = [];
export let image_args: string[] = [];
export let xpm_image_args_grep: string = "";

dotenv.config();

const terminalShellsByChannel = new Map<string, ChildProcessWithoutNullStreams>();
const channelTerminalShellUsers = new Map<string, Array<string>>();

const bultInCommands = ['alias', 'bg', 'bind', 'builtin',
    'cd', 'command', 'compgen', 'complete', 'declare', 'dirs', 'disown', 'echo', 'enable', 'eval',
    'exec', 'exit', 'export', 'fc', 'fg', 'getopts', 'hash', 'help', 'history', 'jobs', 'kill', 'let', 'local',
    'logout', 'popd', 'printf', 'pushd', 'pwd', 'read', 'readonly', 'set', 'shift', 'shopt', 'source',
    'suspend', 'test', 'times', 'trap', 'type', 'typeset', 'ulimit', 'umask', 'unalias', 'unset', 'until', 'wait', 'y', 'n'];

function isBuiltin(str: string): boolean {
    let command = str.split(' ')[0];
    return bultInCommands.some(bultInCommand => command == bultInCommand);
}

export let status_channel: TextBasedChannel;

export function toggleTerminalChannel(channel: TextBasedChannel | null, client_id: string): boolean {
    let added = false;
    const channel_id = channel?.id || '';
    if (!terminalShellsByChannel.has(channel_id)) {
        const shell_session = spawn('/bin/sh');

        shell_session.on('error', (err) => {
            sendToChannel(channel, 'Failed to start shell session: ' + err);
        });

        shell_session.stdout.on('data', (data) => {
            sendToChannel(channel, (data + '').trim());
        });

        shell_session.stderr.on('data', (data) => {
            sendToChannel(channel, (data + '').trim());
        });

        shell_session.on('close', (code) => {
            sendToChannel(channel, 'shell session exited with code ' + code);
            sendToChannel(channel, 'turned OFF terminal mode for all users in this channel');
            terminalShellsByChannel.delete(channel_id);
            channelTerminalShellUsers.set(channel_id, []);
        });

        terminalShellsByChannel.set(channel_id, shell_session);
        channelTerminalShellUsers.set(channel_id, []);
    }

    let client_index = channelTerminalShellUsers.get(channel_id)!.indexOf(client_id);

    if (client_index == -1) {
        channelTerminalShellUsers.get(channel_id)?.push(client_id);
        added = true;
    } else {
        channelTerminalShellUsers.get(channel_id)?.splice(client_index, 1);
    }

    return added;
}

const client = new Client({
    rest: {
        timeout: 60000,
        retries: 3
    },
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ]
});

function writeExifToolConfig(): void {
    let exifToolConfig = `
    %Image::ExifTool::UserDefined = (
    'Image::ExifTool::XMP::xmp' => {
        # (simple string, no checking, we specify the name explicitly so it stays all uppercase)
    `;

    for (let i = 0; i < img_tags.length; i++) {
        const name = img_tags[i].name.toLowerCase().replace(' ', '-');
        image_args.push(name);
        const raw_type = img_tags[i].type.toUpperCase();
        let type;
        switch (raw_type) {
            case "STRING":
                type = ApplicationCommandOptionType.String;
                break;
            case "INTEGER":
                type = ApplicationCommandOptionType.Integer;
                break;
            default:
                error(`Unknowt xmp arg type: ${raw_type}`);
                break;
        }
        image_args_command_options.push({
            name: name,
            description: name,
            type: type,
            required: false,
        });

        xpm_image_args_grep += ` -e '${img_tags[i].xmpName}'`;
        exifToolConfig += `
        ${img_tags[i].xmpName.toUpperCase()} => {
            Name => '${img_tags[i].xmpName.toUpperCase()}'
        }` + (i != img_tags.length - 1 ? "," : "");
    }

    exifToolConfig += `
        },
    );

    1; #end
    `;

    fs.writeFileSync(path.join(__dirname, "./exiftoolConfig.conf"), exifToolConfig);
    debug('exiftool config written');
}
function secondsToDhms(seconds: number) {
    let d = Math.floor(seconds / (3600 * 24));
    let h = Math.floor(seconds % (3600 * 24) / 3600);
    let m = Math.floor(seconds % 3600 / 60);
    let s = Math.floor(seconds % 60);

    let dDisplay = d > 0 ? (d + "d") : "";
    let hDisplay = h > 0 ? (h + "h") : "";
    let mDisplay = m > 0 ? (m + "m") : "";
    let sDisplay = s > 0 ? (s + "s") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}


client.on('ready', async () => {

    if (!await db.exists(`^${getKeyByDirType('IMAGE')}`)
        || !await db.exists(`^${getKeyByDirType('SAVE')}`)) {
        await db.push(`^${getKeyByDirType('IMAGE')}`, '/home/public_files', true);
        await db.push(`^${getKeyByDirType('SAVE')}`, '/home/kloud/Downloads', true);
    }

    writeExifToolConfig();

    testEnvironmentVar(process.env.TEST_SERVERS, "TEST_SERVERS", true);
    testEnvironmentVar(process.env.OWNERS, "OWNERS", false);
    testEnvironmentVar(process.env.TEMP_DIR, "TEMP_DIR", false);
    testEnvironmentVar(process.env.STATUS_CHANNEL_ID, "STATUS_CHANNEL_ID", false);
    
    if (!process.env.EXIFTOOL_PATH) {
        warn(`${wrap('EXIFTOOL_PATH', colors.LIGHTER_BLUE)} not specified, will try to search the system ${wrap('PATH', colors.LIGHTER_BLUE)} variable`);
        process.env.EXIFTOOL_PATH = 'exiftool'
    }

    try {
        await execPromise(process.env.EXIFTOOL_PATH);
    } catch (err) {
        error(`${err} \n exiting`)
        process.exit(1);
    }

    dkrInit(client, __dirname);

    if (process.env.TEMP_DIR && process.env.STATUS_CHANNEL_ID) {
        let channel = await client.channels.fetch(process.env.STATUS_CHANNEL_ID);
        if (channel?.isTextBased()) {
            status_channel = channel;
        } else {
            error(`${wrap('STATUS_CHANNEL_ID', colors.LIGHTER_BLUE)} doesn't refer to a text channel`);
            channel = null;
        }
        if (!fs.existsSync(process.env.TEMP_DIR) && channel) {
            fs.mkdirSync(process.env.TEMP_DIR);
            await sendToChannel(channel, getSimpleEmbed("🟢 Server is online", getDateTime(), "Green"));
        }
    }

    // every 10 minutes
    setInterval(async function () {
        // update status
        client.user?.setPresence({
            status: 'online',
            activities: [{
                name: `uptime: ${secondsToDhms(process.uptime())}`
            }]
        });
    }, 10 * 60 * 1000);
});

let messageCache = new Map<Snowflake, Message>();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (message: string) => {
    if (message.startsWith("|=") || message.startsWith("==")) {
        const reply = message.startsWith("|=");
        message = message.slice(2);
        const delim_index = message.indexOf(":");
        let id = message.slice(0, delim_index);
        let msg = message.slice(delim_index + 1);
        if(!reply) {
            let channel;
            for (let guild_channel of client.channels.cache) {
                if (guild_channel[0] == id) {
                    channel = guild_channel[1];
                    break;
                }
            }

            if (channel) {
                if (channel.isTextBased()) {
                    channel.send(msg);
                } else {
                    warn(`Channel ${wrap(id, colors.CYAN)} is not a text based channel`);
                }
            } else {
                warn(`Could not find channel ${wrap(id, colors.CYAN)}`);
            }
        } else {
            const message = messageCache.get(id);
            if(message) {
                messageReply(message, msg);
            } else {
                warn(`Couldn't reply to ${id}, invalid id or message expired`);
            }
        }
    }
})

client.on('messageCreate', (message) => {

    if (message.author.id != client.user?.id) {
        let msg = "";
        if (message.content) {
            msg += message.content;
        }
        if (message.attachments) {
            for (let attachement of message.attachments) {
                msg += "\n" + attachement[1].name + ": " + attachement[1].url;
            }
        }
        const messageId = message.id;
        messageCache.set(messageId, message);
        // hold max 50 messages in cache
        if (messageCache.size > 50) {
            messageCache.delete(Array.from(messageCache.keys()).at(0)!);
        }
        info(`channel ${wrap(getChannelName(message.channel), colors.YELLOW)} (${message.channelId}), user ${wrap(message.author.tag, colors.LIGHT_RED)}: ${msg} (id: ${messageId})`);
    }

    if (!message.content.startsWith('>') &&
        terminalShellsByChannel.has(message.channelId) &&
        channelTerminalShellUsers.get(message.channelId)?.indexOf(message.author.id) != -1) {
        const command = isBuiltin(message.content.trim()) ? message.content.trim() + "\n" :
            "timeout 5s '" + message.content.trim() + "' | sed -e 's/\x1b\[[0-9;]*[a-zA-Z]//g'"
        info(`-> ${wrap("executing", colors.LIGHTER_BLUE)} "${command}"`);
        terminalShellsByChannel.get(message.channelId)?.stdin.write(`${command} \n`);
        return;
    }

    const msg_content = message.content.toLocaleLowerCase();
    if (messageReplies.has(msg_content)) {
        messageReplies.get(msg_content)!(message);
    }
});

client.login(process.env.TOKEN);
