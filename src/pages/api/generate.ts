import type { APIRoute } from 'astro'
import { generatePayload, parseOpenAIStream } from '@/utils/openAI'
import { verifySignature } from '@/utils/auth'
const demoKey = import.meta.env.DEMOKEY;
import prompts from "@/prompts"

const baseUrl = 'https://api.openai.com';



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

  let sk = setting.openaiAPIKey || demoKey;

  // 限制免费key的请求字数
  if (sk == demoKey) {
    return new Response("⚠️测试额度已用尽,请在设置中配置自己的账号")
  }

  const prompt = prompts.find((item) => item.role == setting.role)?.prompt || setting.customRule;
  let reqMessages = [];
  // 保留message的最近8条,第一套的权重最终

  const maxToken = 4000 - countTokens(prompt) - countTokens(messages[messages.length - 1].content)

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
    if (i > messages.length - 6) {
      reqMessages.unshift(msg)
      continue;
    }
    j++;
    if (j > 10 || len > maxToken) {
      break;
    }
    reqMessages.unshift(msg)
  }
  // 确保第一条指令是玩家的复杂指令
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

  const initOptions = generatePayload(sk, 0.8, reqMessages);
  // @ts-ignore
  let response = new Response();

  try {
    response = await fetch(`${baseUrl}/v1/chat/completions`, initOptions) as Response;
    if (response.status > 400) {
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