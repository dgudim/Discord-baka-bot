import { tagContainer } from "./utils";

export const search_modifiers = new Map([
    ["@*=",
        (content: string[], search_term: string[]) => {
            return content.some((content_value) =>
                search_term.some((search_value) => content_value.startsWith(search_value)));
            // any content value must start with one of the search value
        }],
    ["@&=",
        (content: string[], search_term: string[]) => {
            return content.some((content_value) =>
                search_term.some((search_value) => content_value.endsWith(search_value)));
            // any content value must end with one of the search values
        }],
    ["!=",
        (content: string[], search_term: string[]) => {
            return search_term.every((value) => !content.includes(value));
        }],
    ["#=",
        (content: string[], search_term: string[]) => {
            return content.join() == search_term.join();
        }],
    ["*=",
        (content: string[], search_term: string[]) => {
            return content.every((content_value) =>
                search_term.some((search_value) => content_value.startsWith(search_value)));
            // every content value must start with one of the search value
        }],
    ["&=",
        (content: string[], search_term: string[]) => {
            return content.every((content_value) =>
                search_term.some((search_value) => content_value.endsWith(search_value)));
            // every content value must end with one of the search values
        }],
    ["@=",
        (content: string[], search_term: string[]) => {
            return search_term.some((value) =>
                content.some((content_value) => content_value.includes(value)));
        }],
    ["=",
        (content: string[], search_term: string[]) => {
            return search_term.every((value) =>
                content.some((content_value) => content_value.includes(value)));
        }]
]);

export function getSauceConfString(lastTagsFrom_get_sauce: tagContainer) {
    return ` -xmp-xmp:character='${lastTagsFrom_get_sauce.character}'` +
        ` -xmp-xmp:author='${lastTagsFrom_get_sauce.author}'` +
        ` -xmp-xmp:copyright='${lastTagsFrom_get_sauce.copyright}'` +
        ` -xmp-xmp:tags='${lastTagsFrom_get_sauce.tags}'` +
        ` -xmp-xmp:sourcepost='${lastTagsFrom_get_sauce.post}'`;
}

export const sourcePrecedence = ['danbooru', 'gelbooru', 'yande.re', "konachan"]