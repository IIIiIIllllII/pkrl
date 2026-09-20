"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var dex_text_exports = {};
__export(dex_text_exports, {
  DexText: () => DexText,
  TLadd: () => TLadd,
  TLfor: () => TLfor,
  TLkey: () => TLkey
});
module.exports = __toCommonJS(dex_text_exports);
var path = __toESM(require("path"));
var import_dex_data = require("./dex-data");
/**
 * Dex Text
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * @license MIT
 */
const TEXT_DIR = path.resolve(__dirname, "../data/text");
const TEXT_LANGUAGES = [
  { code: "en", legacyId: "english", name: "English", fullName: "English" },
  { code: "de", legacyId: "german", name: "Deutsch", fullName: "Deutsch (German)" },
  { code: "es", legacyId: "spanish", name: "Espa\xF1ol", fullName: "Espa\xF1ol (Spanish)" },
  { code: "fr", legacyId: "french", name: "Fran\xE7ais", fullName: "Fran\xE7ais (French)" },
  { code: "it", legacyId: "italian", name: "Italiano", fullName: "Italiano (Italian)" },
  { code: "nl", legacyId: "dutch", name: "Nederlands", fullName: "Nederlands (Dutch)" },
  { code: "pt", legacyId: "portuguese", name: "Portugu\xEAs", fullName: "Portugu\xEAs (Portuguese)" },
  { code: "tr", legacyId: "turkish", name: "T\xFCrk\xE7e", fullName: "T\xFCrk\xE7e (Turkish)" },
  { code: "hi", legacyId: "hindi", name: "\u0939\u093F\u0902\u0926\u0940", fullName: "\u0939\u093F\u0902\u0926\u0940 (Hindi)" },
  { code: "ja", legacyId: "japanese", name: "\u65E5\u672C\u8A9E", fullName: "\u65E5\u672C\u8A9E (Japanese)" },
  { code: "zh-cn", legacyId: "simplifiedchinese", name: "\u7B80\u4F53\u4E2D\u6587", fullName: "\u7B80\u4F53\u4E2D\u6587 (Simplified Chinese)" },
  { code: "zh-tw", legacyId: "traditionalchinese", name: "\u7E41\u9AD4\u4E2D\u6587", fullName: "\u7E41\u9AD4\u4E2D\u6587 (Traditional Chinese)" },
  { code: "ko", legacyId: "korean", name: "\uD55C\uAD6D\uC5B4", fullName: "\uD55C\uAD6D\uC5B4 (Korean)" }
];
const TEXT_LANGUAGE_TABLE = {};
for (const lang of TEXT_LANGUAGES) {
  TEXT_LANGUAGE_TABLE[(0, import_dex_data.toID)(lang.code)] = lang;
  TEXT_LANGUAGE_TABLE[lang.code] = lang;
  TEXT_LANGUAGE_TABLE[lang.legacyId] = lang;
  TEXT_LANGUAGE_TABLE[lang.name] = lang;
  TEXT_LANGUAGE_TABLE[lang.name.toLowerCase()] = lang;
}
TEXT_LANGUAGE_TABLE["en-afd"] = {
  code: "en-afd",
  legacyId: "english",
  name: "English (AFD)",
  fullName: "English (AFD)"
};
class DexText {
  static {
    this.rawTextCache = {};
  }
  constructor(dex) {
    this.dex = dex;
  }
  static loadTextFile(name, exportName, optional = false) {
    const filePath = `${TEXT_DIR}/${name}`;
    if (optional) {
      try {
        require.resolve(filePath);
      } catch (e) {
        if (e.code === "MODULE_NOT_FOUND" || e.code === "ENOENT") return {};
        throw e;
      }
    }
    return require(filePath)[exportName];
  }
  static loadRawTextData(lang = "en") {
    lang ||= "en";
    const cached = this.rawTextCache[lang];
    if (cached) return cached;
    const langDir = lang === "en" ? `` : `${lang}/`;
    const optional = lang !== "en";
    const otherNameTables = Object.fromEntries(import_dex_data.OTHER_NAME_TABLES.map((table) => [
      table,
      this.loadTextFile(`${langDir}names`, table, optional) || {}
    ]));
    const data = {
      Pokedex: this.loadTextFile(
        `${langDir}pokedex`,
        "PokedexText",
        optional
      ),
      Tags: this.loadTextFile(`${langDir}tags`, "TagsText", optional) || {},
      ...otherNameTables,
      Moves: this.loadTextFile(`${langDir}moves`, "MovesText", optional),
      Abilities: this.loadTextFile(`${langDir}abilities`, "AbilitiesText", optional),
      Items: this.loadTextFile(`${langDir}items`, "ItemsText", optional),
      Default: this.loadTextFile(`${langDir}default`, "DefaultText", optional)
    };
    if (lang !== "en") this.validateTranslations(data, lang);
    return this.rawTextCache[lang] = data;
  }
  static resolveTagsTable(englishTable, localizedTable) {
    const FIELDS = ["name", "hint", "desc"];
    const table = {};
    for (const id in englishTable) {
      const entry = {};
      for (const field of FIELDS) {
        const value = localizedTable[id]?.[field] ?? englishTable[id][field];
        if (value) entry[field] = value;
      }
      table[id] = entry;
    }
    return table;
  }
  static resolveNameTable(englishTable, localizedTable) {
    const table = {};
    for (const id in englishTable) {
      table[id] = localizedTable[id] ?? englishTable[id];
    }
    for (const id in localizedTable) {
      if (!(id in englishTable) && localizedTable[id] !== null) {
        table[id] = localizedTable[id];
      }
    }
    return table;
  }
  static resolveOtherNameTables(englishData, localizedData) {
    return Object.fromEntries(import_dex_data.OTHER_NAME_TABLES.map((table) => [
      table,
      this.resolveNameTable(englishData[table], localizedData[table])
    ]));
  }
  static validateTranslations(value, lang, keyPath = "") {
    if (value === "") {
      throw new Error(`${lang} translation ${keyPath} must use null to fall back to English`);
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      this.validateTranslations(child, lang, keyPath ? `${keyPath}.${key}` : key);
    }
  }
  static getName(effect, lang = "en") {
    if (!("effectType" in effect)) {
      return this.tagName(effect.name, lang);
    }
    let table;
    switch (effect.effectType) {
      case "Pokemon":
        table = "Pokedex";
        break;
      case "Move":
        table = "Moves";
        break;
      case "Item":
        table = "Items";
        break;
      case "Ability":
        table = "Abilities";
        break;
      case "Nature":
        return this.otherName("NatureNames", effect.name, lang);
      case "Type":
      case "EffectType":
        return this.otherName("TypeNames", effect.name, lang);
      default:
        throw new Error(`Unsupported effect type`);
    }
    return (this.loadRawTextData(lang)[table][effect.id]?.name ?? this.loadRawTextData()[table][effect.id]?.name) || effect.name;
  }
  languages() {
    return TEXT_LANGUAGES;
  }
  findLanguage(lang) {
    return TEXT_LANGUAGE_TABLE[lang.toLowerCase()] || TEXT_LANGUAGE_TABLE[(0, import_dex_data.toID)(lang)] || null;
  }
  get(effect, lang = "en") {
    if (!("effectType" in effect)) {
      return { name: DexText.tagName(effect.name, lang) };
    }
    let table;
    switch (effect.effectType) {
      case "Pokemon": {
        const species = effect;
        return this.dex.loadTextData(lang).Pokedex[effect.id] || {
          name: species.name,
          baseSpecies: species.baseSpecies,
          ...species.forme ? { forme: species.forme } : {}
        };
      }
      case "Nature":
        return { name: DexText.otherName("NatureNames", effect.name, lang) };
      case "Type":
      case "EffectType":
        return { name: DexText.otherName("TypeNames", effect.name, lang) };
      case "Item":
        table = "Items";
        break;
      case "Ability":
        table = "Abilities";
        break;
      case "Move":
        table = "Moves";
        break;
      default:
        throw new Error(`Unsupported effect type`);
    }
    const entry = this.dex.loadTextData(lang)[table][effect.id];
    const customText = effect;
    if (customText.desc !== void 0 || customText.shortDesc !== void 0) {
      const desc = customText.desc || customText.shortDesc || "";
      const shortDesc = customText.shortDesc || customText.desc || "";
      return { ...entry, name: effect.name, desc, shortDesc };
    }
    return entry || {
      name: effect.name,
      desc: "",
      shortDesc: ""
    };
  }
  static tagName(name, lang) {
    const id = (0, import_dex_data.toID)(name);
    return (this.loadRawTextData(lang).Tags[id]?.name ?? this.loadRawTextData().Tags[id]?.name) || name;
  }
  static otherName(table, name, lang) {
    return (this.loadRawTextData(lang)[table][name] ?? this.loadRawTextData()[table][name]) || name;
  }
}
const catalogs = /* @__PURE__ */ new Map();
const TLs = /* @__PURE__ */ new Map();
function inLanguage(source, language, context = "") {
  const translation = catalogs.get(language)?.[source];
  return (typeof translation === "string" ? translation : translation?.[context]) ?? source;
}
function createTL(language) {
  function translate(strings, ...values) {
    if (typeof strings !== "string" && !Array.isArray(strings)) {
      return DexText.getName(strings, language);
    }
    let source;
    let context = "";
    if (typeof strings === "string") {
      source = strings;
      if (values.length) context = values[0];
      values = [];
    } else {
      const parts = strings;
      source = parts[0];
      for (let i = 1; i < parts.length; i++) {
        source += `{${i - 1}}${parts[i]}`;
      }
    }
    const translated = inLanguage(source, language, context);
    return translated.replace(/\{(\d+)\}/g, (placeholder, indexText) => {
      const index = Number(indexText);
      return index < values.length ? String(values[index]) : placeholder;
    });
  }
  const english = DexText.loadRawTextData();
  const localized = DexText.loadRawTextData(language);
  const text = DexText.resolveOtherNameTables(english, localized);
  const tags = DexText.resolveTagsTable(english.Tags, localized.Tags);
  const TL = Object.assign(translate, {
    /** `TL.label("Ability", "Intimidate")` === `"Ability: Intimidate"` */
    label(label, value) {
      const labelText = TL`${label}: `;
      return value === void 0 ? labelText : labelText + String(value);
    },
    orList(items) {
      if (items.length <= 1) return items.join();
      if (items.length === 2) {
        return TL`${items[0]} or ${items[1]}`;
      }
      let list = items[0];
      for (const item of items.slice(1, -1)) list += TL`, ${item}`;
      const last = items[items.length - 1];
      return list + TL`, or ${last}`;
    },
    andList(items) {
      if (items.length <= 1) return items.join();
      if (items.length === 2) {
        return TL`${items[0]} and ${items[1]}`;
      }
      let list = items[0];
      for (const item of items.slice(1, -1)) list += TL`, ${item}`;
      const last = items[items.length - 1];
      return list + TL`, and ${last}`;
    },
    commaList(items) {
      return items.join(TL`, ${""}`);
    },
    /** Asian translations use "person" counters, so don't use this for non-people */
    cappedUserList(items, cap) {
      if (items.length > cap + 1) {
        let list = items[0];
        for (const item of items.slice(1, cap)) list += TL`, ${item}`;
        const others = items.length - cap;
        return list + TL`, and ${others} others`;
      }
      return TL.andList(items);
    },
    type: text.TypeNames,
    nature: text.NatureNames,
    gender: text.GenderNames,
    egggroup: text.EggGroupNames,
    tag: tagField(tags, "name"),
    tagHint: tagField(tags, "hint"),
    color: text.ColorNames,
    status: text.StatusNames,
    target: text.TargetNames,
    stat: text.StatNames,
    statShort: text.StatShortNames,
    statMedium: text.StatMediumNames,
    ui: {
      ...english.Default.ui,
      ...localized.Default.ui
    }
  });
  return TL;
}
function tagField(tags, field) {
  const table = {};
  for (const id in tags) {
    const value = tags[id][field];
    if (value) table[id] = value;
  }
  return table;
}
function TLfor(language) {
  let translator = TLs.get(language);
  if (!translator) {
    translator = createTL(language);
    TLs.set(language, translator);
  }
  return translator;
}
function TLkey(strings) {
  return strings[0];
}
function TLadd(language, additions) {
  const merged = catalogs.get(language) || /* @__PURE__ */ Object.create(null);
  for (const catalog of additions) {
    for (const [key, value] of Object.entries(catalog)) {
      const placeholders = [];
      const source = key.replace(/\{([^{}]+)\}/g, (placeholder, name) => {
        placeholders.push(name);
        return `{${placeholders.length - 1}}`;
      });
      const resolvePlaceholders = (text) => text.replace(/\{([^{}]+)\}/g, (placeholder, name) => {
        const index = placeholders.indexOf(name);
        return index < 0 ? placeholder : `{${index}}`;
      });
      if (value === null) {
        merged[source] = null;
      } else if (typeof value === "string") {
        merged[source] = resolvePlaceholders(value);
      } else {
        const previous = merged[source];
        merged[source] = {
          ...typeof previous === "object" && previous ? previous : {},
          ...Object.fromEntries(Object.entries(value).map(([context, text]) => [context, text === null ? null : resolvePlaceholders(text)]))
        };
      }
    }
  }
  catalogs.set(language, merged);
}
//# sourceMappingURL=dex-text.js.map
