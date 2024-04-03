const TailwindConfig = require('tailwindcss/defaultConfig')
const TailwindColors = require('tailwindcss/colors')
const TypographyConfig = require('@tailwindcss/typography/src/styles');
const { merge, pickBy, chain, mapValues, findKey, pick, omit } = require('lodash');

const breakpoints = require('./typographyBreakpoints.cjs');

async function main() {
  // TypographyConfig.gray.css contains all the colors
  // use all these keys start with "--tw-prose" for colors, but ignore "--tw-prose-invert" prefix
  const typographyConfig = merge({}, ...TypographyConfig.DEFAULT.css);
  const convertedConfig = convertBreakpoint('DEFAULT', typographyConfig);

  console.log(JSON.stringify(convertedConfig, null, 2));
  // console.log(TypographyConfig.sm);
  // console.log(TypographyConfig.base);
  // console.log(TypographyConfig.lg);
  // console.log(TypographyConfig.xl);
  // console.log(TypographyConfig.2xl);

  // console.log(convertToDefaultConfigRules('sm', breakpoints.sm));


  // for (const breakpoint of breakpoints) {
  //   if (breakpoint.key === 'base') {
  //     continue;
  //   }

  //   console.log(convertToDefaultConfigRules(breakpoint))
  // }
};

function convertBreakpoint(breakPointKey, breakpointConfig) {
  const bodyApply = [];
  const bodyConfig = {};
  const config = {};
  const colorShades = determineColorShades(breakpointConfig);

  Object.entries(breakpointConfig).forEach(([key, value]) => {
    // ignore the color config
    if (key.startsWith('--tw-prose')) {
      return;
    }

    if (key === 'code::after' || key === 'code::before') {
      return;
    }

    if (key === '> :first-child' || key === '> :last-child') {
      bodyConfig[key] = findTailwindConfigValuesForObject(value, colorShades, breakPointKey);
      return;
    }

    if (typeof value === 'string') {
      // ignore since we don't wanna set maxWidth
      if (key === 'maxWidth') {
        return;
      }

      bodyApply.push(findTailwindConfigValue(key, value, colorShades))
    } else if (typeof value === 'object') {
      let configKey = key;

      if (key === 'a') {
        configKey = 'p a';
      }

      config[configKey] = findTailwindConfigValuesForObject(value, colorShades, breakPointKey);
    } else {
      throw new Error(`value type not supported key: ${key} typeof value: ${typeof value}`)
    }
  });

  return {
    body: {
      ...createApplyConfig(bodyApply, breakPointKey),
      ...bodyConfig,
    },
    ...config,
    // colorShades,
  }
}

function determineColorShades(breakpointConfig) {
  const lightColorConfig = pickBy(breakpointConfig, (value, key) => key.startsWith('--tw-prose') && !key.startsWith('--tw-prose-invert'))
  const darkColorConfig = pickBy(breakpointConfig, (value, key) => key.startsWith('--tw-prose-invert'));

  function findGrayColorShade(hex) {
    /* color object looks like this
    {
      50: '#...',
      100: '#...',
      200: '#...',
      ...
    }
     */
    return findKey(TailwindColors.gray, (color) => color === hex);
  }

  return {
    light: mapValues(lightColorConfig, (hex) => findGrayColorShade(hex)),
    dark: mapValues(darkColorConfig, hex => findGrayColorShade(hex)),
  }
}

function createApplyConfig(values, breakpoint) {
  if (!values.length) {
    return {};
  }

  function addPrefix(val) {
    if (breakpoint === 'DEFAULT') {
      return val;
    }
    return `${breakpoint}:${val}`;
  }

  return {
    [`@apply ${values.map(val => addPrefix(val)).join(' ')}`]: {}
  }
}

function findTailwindConfigValuesForObject(object, colorShades, breakPointKey) {
  // todo: margin, padding optimizations, for 'all', x, y
  const twConfigValues = [];
  const passThroughConfigValues = {}

  Object.entries(object)
    .forEach(([cssKey, cssValue]) => {
      if (cssKey === 'quotes'
        || cssKey === 'content'
        || cssKey === 'boxShadow'
        || (cssKey === 'fontWeight' && cssValue === 'inherit')
        || (cssKey === 'fontSize' && cssValue === 'inherit')
        || (cssKey === 'lineHeight' && cssValue === 'inherit'
          || (cssKey === 'fontFamily' && cssValue === 'inherit'))
      ) {
        // ignore items with vars
        if (cssValue.includes('--tw-prose')) {
          return;
        }

        passThroughConfigValues[cssKey] = cssValue;
      } else {
        const found = findTailwindConfigValue(cssKey, cssValue, colorShades);
        if (!found) {
          throw new Error(`"${cssKey}" not found found in tw config with value "${cssValue}"`);
        }

        twConfigValues.push(found);
      }
    })

  return {
    ...createApplyConfig(twConfigValues, breakPointKey),
    ...passThroughConfigValues,
  };
}

function findTailwindConfigValue(key, value, colorShades) {
  switch (key) {
    case 'display':
      return value; // 1-1 mapping with display and classname
    case 'fontFamily':
      if (value !== 'inherit') {
        throw new Error(`fontFamily "${value}" not implemented`);
      }
      return value;
    case 'width':
      return findWidth(value);
    case 'fontSize':
      return findFontSize(value);
    case 'lineHeight':
      return findLineHeight(value);
    case 'marginTop':
      return findSpacingAddPrefix(value, 'mt')
    case 'marginBottom':
      return findSpacingAddPrefix(value, 'mb')
    case 'padding':
      return findSpacingAddPrefix(value, 'p')
    case 'paddingLeft':
      return findSpacingAddPrefix(value, 'pl');
    case 'paddingRight':
      return findSpacingAddPrefix(value, 'pr');
    case 'paddingTop':
      return findSpacingAddPrefix(value, 'pt');
    case 'paddingBottom':
      return findSpacingAddPrefix(value, 'pb');
    case 'borderRadius':
      return findBorderRadius(value);
    case 'color':
      if (value === 'inherit') {
        return 'text-inherit';
      }
      return findShadeAddPrefix(value, colorShades, 'text', 'foreground');
    case 'backgroundColor':
      return findShadeAddPrefix(value, colorShades, 'bg', 'surface');
    case 'textDecoration':
      if (value !== 'underline') {
        throw new Error(`textDecoration "${value}" not supported`);
      }
      return value;
    case 'fontWeight':
      return findFontWeight(value);
    case 'listStyleType':
      return findListStyleType(value);
    case 'borderWidth':
      return findBorderWidthAddPrefix(value, 'border');
    case 'borderTopWidth':
      return findBorderWidthAddPrefix(value, 'border-t');
    case 'borderLeftWidth':
      return findBorderWidthAddPrefix(value, 'border-l');
    case 'borderBottomWidth':
      return findBorderWidthAddPrefix(value, 'border-b');
    case 'borderColor':
      return findShadeAddPrefix(value, colorShades, 'border', 'foreground');
    case 'borderLeftColor':
      return findShadeAddPrefix(value, colorShades, 'border-l', 'foreground');
    case 'borderBottomColor':
      return findShadeAddPrefix(value, colorShades, 'border-b', 'foreground');
    case 'borderTopColor':
      return findShadeAddPrefix(value, colorShades, 'border-t', 'foreground')
    case 'fontStyle':
      return value; // nothing to find since names are 1-1 mapping with class names
    case 'overflowX':
      if (value !== 'auto') {
        throw new Error(`overflowX "${value}" not supported`);
      }
      return `overflow-x-auto`;
    case 'tableLayout':
      return findTableLayout(value);
    case 'textAlign':
      return findTextAlign(value);
    case 'verticalAlign':
      return `align-${value}`;
    default:
      throw new Error(`"${key}" not implemented. value is "${value}"`);
  }
}

function findTextAlign(rawValue) {
  switch (rawValue) {
    case 'left':
    case 'center':
    case 'right':
    case 'justify':
    case 'start':
    case 'end':
      return `text-${rawValue}`;
    default:
      throw new Error(`textAlign "${rawValue}" not supported`);
  }
}

function findTableLayout(rawValue) {
  if (rawValue === 'auto') {
    return 'table-auto';
  }

  throw new Error(`tableLayout "${rawValue}" not implemented`);
}

function findWidth(rawWidth) {
  if (rawWidth === '100%') {
    return 'w-full';
  }

  throw new Error(`width "${rawWidth}" not implemented`)
}

const borderWidths = chain(TailwindConfig.theme.borderWidth)
  .mapValues((width, key) => ({ key, width, px: Number(width.replace('px', '')) }))
  .sortBy('px')
  .value();

function findBorderWidthAddPrefix(rawBorderValue, prefix) {
  const found = borderWidths.find(width => width.px === toPx(rawBorderValue));

  if (!found) {
    throw new Error(`borderWidth "${rawBorderValue}" not found!`);
  }

  // default values don't need a key
  if (found.key === 'DEFAULT') {
    return prefix;
  }

  return `${prefix}-${found.key}`;
}

function findListStyleType(rawListStyle) {
  const found = findKey(TailwindConfig.theme.listStyleType, (value) => value === rawListStyle);

  if (!found) {
    return `list-[${rawListStyle}]`;
  }

  return `list-${found}`;
}


const fontWeights = chain(TailwindConfig.theme.fontWeight)
  .mapValues((fontWeight, key) => ({ fontWeight, key }))
  .sortBy('fontWeight')
  .value();

function findFontWeight(rawFontWeight) {
  const found = fontWeights.find(({ fontWeight }) => String(fontWeight) === String(rawFontWeight));

  if (!found) {
    throw new Error(`font weight with value "${rawFontWeight}" not found`);
  }

  return `font-${found.key}`;
}

function findShadeAddPrefix(rawColor, colorShades, selector, colorName) {
  if (rawColor === 'transparent') {
    return `${selector}-${rawColor}`;
  }

  if (!rawColor.startsWith('var(')) {
    throw new Error(`color not supported "${rawColor}"`);
  }

  const varName = rawColor.replace('var(', '').replace(')', '');

  if (!colorShades.light[varName]) {
    throw new Error(`color shad with name "${varName}" not found`)
  }


  return `${selector}-${colorName}-${colorShades.light[varName]}`;
}


const fontSizes = Object.entries(TailwindConfig.theme.fontSize).sort((a, b) => {
  const [, [aRawFontSize]] = a;
  const [, [bRawFontSize]] = b;

  return toNumber(aRawFontSize) - toNumber(bRawFontSize);
});
function findFontSize(rawFontSize) {
  const targetFontSize = toNumber(rawFontSize);
  let found;

  for (const [key, fontSizeConfig] of fontSizes) {
    const [fontSizeString] = fontSizeConfig;
    const fontSize = toNumber(fontSizeString);

    if (fontSize <= targetFontSize) {
      found = `text-${key}`;
    }
  }

  return found;
}

const lineHeights = [
  'none',
  'tight',
  'snug',
  'normal',
  'relaxed',
  'loose',
].map(key => ({ key, lineHeight: Number(TailwindConfig.theme.lineHeight[key]) }));

function findLineHeight(rawLineHeight) {
  if (rawLineHeight.includes('em') || rawLineHeight.includes('rem')) {
    throw new Error(`lineHeight not supported with this suffix ${rawLineHeight} `);
  }

  const targetLineHeight = toNumber(rawLineHeight);


  // const found = chain(lineHeights)
  //   .map(lh => ({
  //     ...lh,
  //     delta: Math.abs(lh.lineHeight - targetLineHeight)
  //   }))
  //   .sortBy('delta')
  //   .first()
  //   .value();

  const found = lineHeights.find(lh => lh.lineHeight === targetLineHeight || lh.lineHeight > targetLineHeight);

  if (!found) {
    throw new Error(`line height "${rawLineHeight}" not found`);
  }


  return `leading-${found.key}`
}

const spacings = Object.entries(TailwindConfig.theme.spacing).sort((a, b) => {
  const [, aRawValue] = a;
  const [, bRawValue] = b;

  if (aRawValue === '1px') {
    return -1;
  }

  return toNumber(aRawValue) - toNumber(bRawValue);
});

function findSpacing(rawValue) {
  if (rawValue.includes('px')) {
    throw new Error(`spacing not supported with px "${rawValue}"`);
  }

  const targetValue = toNumber(rawValue);
  const filtered = spacings
    .filter(([key]) => key !== 'px')
    .filter(([key, rawSpacingValue]) => toNumber(rawSpacingValue) <= targetValue);

  return filtered[filtered.length - 1][0];
}

function findSpacingAddPrefix(rawSpacingValue, prefix) {
  const spacing = findSpacing(rawSpacingValue);
  if (!spacing) {
    throw new Error(`spacing not found for value: ${value}`);
  }

  return `${prefix}-${spacing}`;
}

// TODO there is an issue with kbd. find it!!
// chain(TailwindConfig.theme.borderRadius)

const borderRadiusConfigs = chain(TailwindConfig.theme.borderRadius)
  .entries()
  .map(([key, borderRadius]) => ({ key, borderRadius, px: toPx(borderRadius) }))
  .sortBy('px')
  .value();

function findBorderRadius(rawValue) {
  const targetBorderRadius = toPx(rawValue);

  const found = borderRadiusConfigs.find((br) =>
    targetBorderRadius === br.px || targetBorderRadius < br.px
  );

  if (!found) {
    throw new Error(`borerRadius "${rawValue}" not found!`);
  }

  if (found.key === 'DEFAULT') {
    return 'rounded';
  }

  return `rounded-${found.key}`;
}

function toNumber(str) {
  const number = Number(str.replace('rem', '').replace('em', '').replace('px', ''));
  if (Number.isNaN(number)) {
    throw new Error(`"${str}" is not a number!`);
  }
  return number;
}

function toPx(rawValue) {
  if (rawValue === '0') {
    return 0;
  }

  // treat numbers as px values, since we are parsing values from JSS
  if (Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (rawValue.endsWith('px')) {
    return Number(rawValue.replace('px', ''));
  }

  if (rawValue.endsWith('rem')) {
    const rem = Number(rawValue.replace('rem', ''));

    if (Number.isNaN(rem)) {
      throw new Error(`"${rawValue}" not converted to a number properly.`)
    }

    return rem * 16;
  }

  throw new Error(`toPx does not support "${rawValue}"`)
}


main().catch((error) => {
  console.error(error);
  process.exit(1);
});

