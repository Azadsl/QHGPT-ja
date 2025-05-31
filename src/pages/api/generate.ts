import type { APIRoute } from 'astro'
import { generatePayload, parseOpenAIStream } from '@/utils/openAI'
import { verifySignature } from '@/utils/auth'
const defaultAPIKey = import.meta.env.DEFAULT_API_KEY || '';
import prompts from "@/prompts"

const baseUrl = 'https://api.siliconflow.cn';

// cloudflare pages 不支持node方法，简单的粗算
function countTokens(str: string) {
  var len = 0;
  for (var i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127 || str.charCodeAt(i) == 94) {
      len += 1.5;
    } else {
      len += 0.25;
    }
  }
  return Math.floor(len)
}

export const post: APIRoute = async (context) => {
  const body = await context.request.json()
  const { sign, time, messages, setting } = body
  if (!messages) {
    return new Response('No input text')
  }

  // 优先使用用户提供的 API Key，如果没有则使用默认 API Key
  let apiKey = setting.openaiAPIKey || defaultAPIKey;

  // 如果既没有用户提供的 API Key 也没有默认 API Key，返回错误提示
  if (!apiKey) {
    return new Response("🙏 请看下方【告示】或联系管理员配置默认 API Key")
  }

  const prompt = prompts.find((item) => item.role == setting.role)?.prompt || setting.customRule;
  let reqMessages = [];

  const maxToken = 5000 - countTokens(prompt) - countTokens(messages[messages.length - 1].content)

  let j = 0;
  let len = 0;
  // 遍历历史消息，如果消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const lastContent = messages[i + 1] ? messages[i + 1].content : ''
    if (msg.content == lastContent) {
      continue;
    }
    len += countTokens(msg.content);
    if (i > messages.length - 15) {
      reqMessages.unshift(msg)
      continue;
    }
    j++;
    if (j > 10 || len > maxToken) {
      break;
    }
    reqMessages.unshift(msg)
  }

  const fm = messages[0]
  if (fm.role == "user" && reqMessages[0].content != fm.content && fm.content.length > 20) {
    reqMessages.unshift(fm)
  }
  if (prompt) {
    reqMessages.unshift({
      role: "system",
      content: prompt,
    })
  }

  const initOptions = generatePayload(apiKey, 0.8, reqMessages);
  // @ts-ignore
  let response = new Response();

  try {
    response = await fetch(`${baseUrl}/v1/chat/completions`, initOptions) as Response;
    if (response.status > 400) {
      // 专门处理余额不足或限额超出的错误
      if (response.status === 402 || response.statusText.includes('insufficient')) {
        return new Response("🙏 默认 API Key 余额不足或被限制，请看下方【告示】")
      } else if (response.status === 429) {
        return new Response("🙏 当前系统负载过高或 API Key 限额已达上限，请在看下方【告示】")
      }
      throw new Error(`${response.status}:${response.statusText}`);
    }
  } catch (error) {
    return new Response(`⚠️OpenAi server response error ${error}`)
  }

  return new Response(parseOpenAIStream(response))
}

export const get: APIRoute = async (context) => {
  const roles = prompts.filter((item) => {
    return !!item.enabled
  }).map((item) => {
    return {
      ...item,
      "prompt": ''
    }
  })
  return new Response(JSON.stringify(roles), {
    headers: {
      'Content-Type': 'application/json',
    }
  })
}
