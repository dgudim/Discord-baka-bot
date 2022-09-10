import { GatewayIntentBits, TextBasedChannel, Message, Client } from 'discord.js'; // discord api
import DKRCommands from "dkrcommands";
import img_tags from './image_tags.json';
import path from 'path';
import fs from 'fs';
import { exec, spawn, ChildProcessWithoutNullStreams } from 'child_process';
import util from "util";
const execPromise = util.promisify(exec);
import dotenv from 'dotenv'; // evironment vars

import { JsonDB } from 'node-json-db';
import { Config } from 'node-json-db/dist/lib/JsonDBConfig'
import { getChannelName, getDateTime, getSimpleEmbed, messageReply, sendToChannel } from '@discord_bots_common/utils';
import { colors, wrap } from '@discord_bots_common/colors';
import { debug, error, info, warn } from '@discord_bots_common/logger';
import { getKeyByDirType } from './sauce_utils';

export const db = new JsonDB(new Config("db", true, true, '^'));

export let image_args_arr: string[] = [];
export let image_args: string = "";
export let image_args_types: string[] = [];
export let xpm_image_args_grep: string = "";

dotenv.config();

const terminalShellsByChannel = new Map<string, ChildProcessWithoutNullStreams>();
const channelTerminalShellUsers = new Map<string, Array<string>>();

const bultInCommands = ['alias', 'bg', 'bind', 'builtin',
    'cd', 'command', 'compgen', 'complete', 'declare', 'dirs', 'disown', 'echo', 'enable', 'eval',
    'exec', 'exit', 'export', 'fc', 'fg', 'getopts', 'hash', 'help', 'history', 'jobs', 'kill', 'let', 'local',
    'logout', 'popd', 'printf', 'pushd', 'pwd', 'read', 'readonly', 'set', 'shift', 'shopt', 'source',
    'suspend', 'test', 'times', 'trap', 'type', 'typeset', 'ulimit', 'umask', 'unalias', 'unset', 'until', 'wait', 'y', 'n'];

export const prefix = '>';

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

const messageReplies = new Map([ // put your message replies here
    ["ping", (message: Message) => { messageReply(message, 'pong'); }],
    ["windows", (message: Message) => { messageReply(message, '🐧 Linux 🐧'); }],
    ["pain and suffering", (message: Message) => { messageReply(message, 'main() and buffering'); }],
    ["понял", (message: Message) => { messageReply(message, 'не поняла'); }],
    ["amogus", (message: Message) => { messageReply(message, 'sus'); }]
]);

function writeExifToolConfig(): void {
    let exifToolConfig = `
    %Image::ExifTool::UserDefined = (
    'Image::ExifTool::XMP::xmp' => {
        # (simple string, no checking, we specify the name explicitly so it stays all uppercase)
    `;

    for (let i = 0; i < img_tags.length; i++) {
        image_args_arr.push(img_tags[i].name.toLowerCase().replace(' ', '-'));
        image_args += (i > 0 ? ' ' : '') + `<${img_tags[i].name}>`;
        image_args_types.push(img_tags[i].type.toUpperCase());
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

client.on('ready', async () => {

    if (!await db.exists(`^${getKeyByDirType('IMAGE')}`)
        || !await db.exists(`^${getKeyByDirType('SAVE')}`)) {
        await db.push(`^${getKeyByDirType('IMAGE')}`, '/home/public_files', true);
        await db.push(`^${getKeyByDirType('SAVE')}`, '/home/kloud/Downloads', true);
    }

    client.user?.setPresence({
        status: 'online',
        activities: [{
            name: 'prefix is ' + prefix
        }]
    });

    writeExifToolConfig();

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
    
    new DKRCommands(client, {
        commandDir: path.join(__dirname, 'commands'),
        typeScript: true,
        botOwners: ['410761741484687371', '470215458889662474'],
        testServers: [process.env.LOCAL_SERV_ID || '', process.env.FILEBIN_SERV_ID || '', process.env.MINEICE_SERV_ID || ''],
        disabledDefaultCommands: ['language', 'prefix', 'help']
    })
        .setDefaultPrefix(prefix)
        .setColor(0x005555);

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
    } else {
        warn(`please specify ${wrap('TEMP_DIR', colors.LIGHTER_BLUE)} and ${wrap('STATUS_CHANNEL_ID', colors.LIGHTER_BLUE)}`);
    }
});

client.on('messageCreate', (message) => {

    if (message.author.id != client.user?.id) {
        let msg = "";
        if (message.content) {
            msg += message.content;
        }
        if (message.attachments) {
            for (let attachement of message.attachments) {
                msg += "\n" + attachement[1].name + ": " + attachement[1].proxyURL;
            }
        }
        info(`channel ${wrap(getChannelName(message.channel), colors.YELLOW)}, user ${wrap(message.author.tag, colors.LIGHT_RED)}: ${msg}`);
    }

    if (!message.content.startsWith(prefix) &&
        terminalShellsByChannel.has(message.channelId) &&
        channelTerminalShellUsers.get(message.channelId)?.indexOf(message.author.id) != -1) {
        terminalShellsByChannel.get(message.channelId)?.stdin.write(
            isBuiltin(message.content.trim()) ? message.content.trim() + "\n" :
                "timeout 5s " + message.content.trim() + " | sed -e 's/\x1b\[[0-9;]*[a-zA-Z]//g' \n");
        return;
    }

    const msg_content = message.content.toLocaleLowerCase();
    if (messageReplies.has(msg_content)) {
        messageReplies.get(msg_content)!(message);
    }
});

client.login(process.env.TOKEN);
