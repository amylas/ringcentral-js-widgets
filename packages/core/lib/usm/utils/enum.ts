import freeze from './freeze';

const {
  prototype: { hasOwnProperty },
  entries,
  keys,
  defineProperties,
  defineProperty,
} = Object;

export type Prefix = string;
export type PropertyKey = string;
export type PropertyKeys = PropertyKey[];

type Properties<T> = {
  [P in PropertyKey]?: T;
};

interface Enum {
  prefix: Prefix;
  [key: string]: any;
}

class Enum {
  constructor(keys: PropertyKeys = [], prefix: Prefix) {
    const properties: PropertyDescriptorMap = {
      prefix: {
        value: prefix,
        configurable: false,
        enumerable: false,
        writable: false,
      },
    };
    keys.forEach((item) => {
      properties[item] = Enum.setPrefix(item, prefix);
    });
    defineProperties(this, properties);
    if (typeof window !== 'undefined' && window.Proxy && window.Reflect) {
      return freeze(this);
    }
    Object.freeze(this);
  }

  static setPrefix(item: PropertyKey, prefix: Prefix) {
    const value = prefix ? `${prefix}-${item}` : item;
    return {
      value,
      configurable: true,
      enumerable: true,
      writable: true,
    };
  }

  get size() {
    return entries(this).length;
  }

  add(item: PropertyKey) {
    if (this[item]) {
      throw new Error(
        `'${item}' enumeration property already exists for this instance`,
      );
    }
    const property = Enum.setPrefix(item, this.prefix);
    defineProperty(this, item, property);
  }

  remove(item: PropertyKey) {
    if (!hasOwnProperty.call(this, item)) {
      throw new Error(
        `'${item}' enumeration property does not exist for this instance`,
      );
    }
    delete this[item];
  }
}

interface PrefixEnum {
  enumMap: Enum;
  prefix: Prefix;
  base?: Enum;
}

const prefixCache: Properties<Properties<Properties<string>>> = {};

function prefixEnum({ enumMap, prefix, base = enumMap }: PrefixEnum) {
  if (!prefix || prefix === '') return base;
  if (
    prefixCache[prefix] === null ||
    typeof prefixCache[prefix] === 'undefined'
  ) {
    prefixCache[prefix] = {};
  }
  const cache = prefixCache[prefix];
  if (cache && !cache[base.prefix]) {
    Object.assign(cache, {
      [base.prefix]: new Enum(keys(enumMap), `${prefix}-${enumMap.prefix}`),
    });
  }
  return cache && cache[base.prefix];
}

function createEnum<V extends string>(
  values: V[],
  prefix: string,
): { [K in V]: string };

function createEnum(values: string[], prefix: string): Enum {
  return new Enum(values, prefix);
}

export { Enum as default, prefixCache, prefixEnum, createEnum };
