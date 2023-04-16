import { defineConfig } from 'astro/config';
import unocss from 'unocss/astro';
import { presetUno } from 'unocss';
import presetAttributify from '@unocss/preset-attributify';
import presetTypography from '@unocss/preset-typography';
import solidJs from '@astrojs/solid-js';
import node from '@astrojs/node';
import cloudflare from "@astrojs/cloudflare";
import vercel from '@astrojs/vercel/edge'


const envAdapter = () => {
  if (process.env.OUTPUT === 'vercel') {
    return vercel()
  } else if (process.env.OUTPUT === 'cloudflare') {
    return cloudflare()
  } else {
    return node({
      mode: 'standalone',
    })
  }
}

// https://astro.build/config
export default defineConfig({
  integrations: [unocss({
    presets: [presetAttributify(), presetUno(), presetTypography({
      cssExtend: {
        "ul,ol": {
          "padding-left": "2em"
        }
      }
    })]
  }), solidJs()],
  output: 'server',
  adapter: envAdapter(),
  build: {
    cacheControl: {
      "/public/**/*.{jpg,png,jpeg}": "max-age=86400"
    }
  }
});