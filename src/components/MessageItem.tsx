import { Accessor, createSignal, Show, createEffect } from 'solid-js'
import { useClipboard, useEventListener } from 'solidjs-use'
import type { ChatMessage } from '@/types'
import MarkdownIt from 'markdown-it'
// @ts-ignore
import mdKatex from 'markdown-it-katex'
import mdHighlight from 'markdown-it-highlightjs'
import IconRefresh from './icons/Refresh'

interface Props {
  role: ChatMessage['role']
  message: Accessor<string> | string
  assistantAvatar?: string
  showRetry?: Accessor<boolean>
  onRetry?: () => void
}

export default ({ role, message, assistantAvatar, showRetry, onRetry }: Props) => {

  const roleClass = {
    system: 'bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300',
    user: 'bg-gradient-to-r from-purple-400 to-yellow-400',
    assistant: 'bg-gradient-to-r from-gray-300 via-gray-200 to-gray-50',
  }

  // useClipboard 只用copy，不用copied信号防止冲突
  const { copy } = useClipboard()

  // 自己维护底部复制按钮的copied状态
  const [copied, setCopied] = createSignal(false)

  // 监听 markdown 区复制按钮点击，在这里执行 copy 功能，但不维护文字变化状态
  useEventListener('click', (e) => {
    const el = e.target as HTMLElement

    // 点击 code 区复制按钮或其 svg 图标，都取data-code复制内容
    if (el.matches('div > div.copy-btn')) {
      const code = decodeURIComponent(el.dataset.code!)
      copy(code)
    }
    if (el.matches('div > div.copy-btn > svg')) {
      const code = decodeURIComponent(el.parentElement?.dataset.code!)
      copy(code)
    }
  })

  // 生成 markdown HTML 内容，复制按钮文字恒定为 Copy
  const htmlString = () => {
    const md = MarkdownIt({ html: true }).use(mdKatex).use(mdHighlight)
    const fence = md.renderer.rules.fence!
    md.renderer.rules.fence = (...args) => {
      const [tokens, idx] = args
      const token = tokens[idx]
      const rawCode = fence(...args)

      return `<div relative>
      <div data-code=${encodeURIComponent(token.content)} class="copy-btn absolute top-12px right-12px z-3 flex justify-center items-center border b-transparent w-8 h-8 p-2 bg-dark-300 op-90 transition-all group cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 32 32"><path fill="currentColor" d="M28 10v18H10V10h18m0-2H10a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Z" /><path fill="currentColor" d="M4 18H2V4a2 2 0 0 1 2-2h14v2H4Z" /></svg>
            <div class="opacity-0 h-7 bg-black px-2.5 py-1 box-border text-xs c-white inline-flex justify-center items-center  rounded absolute z-1 transition duration-600 whitespace-nowrap -top-8" group-hover:opacity-100>
              Copy
            </div>
      </div>
      ${rawCode}
      </div>`
    }

    if (typeof message === 'function') {
      return md.render(message())
    } else if (typeof message === 'string') {
      return md.render(message)
    }
    return ''
  }

  // 页面上用于显示 markdown 的元素
  const [messageEl, setMessageEl] = createSignal<HTMLElement | null>(null)

  // 只负责首次和内容变化时刷新html，不主动响应copied变化，避免闪烁
  createEffect(() => {
    if (messageEl()) {
      messageEl()!.innerHTML = htmlString()
    }
  })

  // 底部复制按钮点击处理：复制，显示复制文本2秒后复原
  function handleBottomCopy() {
    const msgText = typeof message === 'function' ? message() : message
    copy(msgText).then(() => {
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    })
  }

  return (
    <div class="py-2 -mx-4 px-4 transition-colors md:hover:bg-slate/3">
      <div class="flex gap-3 rounded-lg" class:op-75={role === 'user'}>
        <div class={`shrink-0 w-7 h-7 mt-4 rounded-full op-80 overflow-hidden ${roleClass[role]}`}>
          <Show when={role == "assistant"}>
            <img
              src={assistantAvatar || "/images/role.png"}
              alt="Avatar"
              class="w-full h-full object-cover"
            />
          </Show>
        </div>
        <div class="message prose break-words overflow-hidden" ref={setMessageEl} />
      </div>

      <div class="flex items-center justify-end px-3 mb-2 gap-2">
        <div
          onClick={handleBottomCopy}
          class="flex items-center gap-1 px-1.5 py-0.25 op-70 border border-slate rounded-md text-xs cursor-pointer hover:bg-slate/10 relative group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="0.8em" height="0.8em" viewBox="0 0 32 32">
            <path fill="currentColor" d="M28 10v18H10V10h18m0-2H10a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Z" />
            <path fill="currentColor" d="M4 18H2V4a2 2 0 0 1 2-2h14v2H4Z" />
          </svg>
          <span>{copied() ? '入藏' : '录经'}</span>

          <div
            class="opacity-0 h-7 bg-black px-2.5 py-1 box-border text-xs text-white inline-flex justify-center items-center rounded absolute z-50 transition-opacity duration-500 whitespace-nowrap -top-8 pointer-events-none"
            classList={{
              'opacity-100 pointer-events-auto': copied(),
              'opacity-0 pointer-events-none': !copied(),
            }}
          >
            {copied() ? '已复制' : ''}
          </div>
        </div>

        {showRetry?.() && onRetry && (
          <div
            onClick={onRetry}
            class="flex items-center gap-1 px-1.5 py-0.25 op-70 border border-slate rounded-md text-xs cursor-pointer hover:bg-slate/10"
          >
            <IconRefresh />
            <span>轮转</span>
          </div>
        )}
      </div>
    </div>
  )
}
