import { TextBasedChannel } from "discord.js";
import { colors, parse, wrap } from "./colors";
import { sendToChannel } from "./utils";

export enum logLevel {
    DEBUG = colors.GRAY,
    INFO = colors.WHITE,
    WARN = colors.YELLOW,
    ERROR = colors.LIGHT_RED
}

export function log(message: any, color: logLevel) {
    switch (color) {
        case logLevel.DEBUG:
        case logLevel.INFO:
        default:
            console.log(parse(wrap(message, color)));
            break;
        case logLevel.WARN:
            console.warn(parse(wrap(message, color)));
            break;
        case logLevel.ERROR:
            console.error(parse(wrap(message, color)));
            break;
    }
}

export function debug(message: any) {
    log(message, logLevel.DEBUG);
}

export function info(message: any) {
    log(message, logLevel.INFO);
}

export function warn(message: any) {
    log(message, logLevel.WARN);
}

export function error(message: any, channel?: TextBasedChannel) {
    if (channel) {
        sendToChannel(channel, message, true);
    } else {
        log(message, logLevel.ERROR);
    }
}