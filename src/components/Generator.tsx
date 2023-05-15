import type { ChatMessage } from '@/types'
import { createSignal, Index, Show, createEffect, onMount, For } from 'solid-js'
import IconClear from './icons/Clear'
import MessageItem from './MessageItem'
import Setting from "./Setting"
import _ from 'lodash'
import { generateSignature } from '@/utils/auth'
import Swiper, { Navigation } from 'swiper';
// import Swiper styles
import 'swiper/css';

import { register } from 'swiper/element/bundle';
// register Swiper custom elements
register();

Swiper.use([Navigation])

export interface Role {
  role: string,
  avatar: string,
  fc: string,
}

export default () => {
  let inputRef: HTMLTextAreaElement
  const [messageList, setMessageList] = createSignal<ChatMessage[]>([])
  const [currentAssistantMessage, setCurrentAssistantMessage] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [controller, setController] = createSignal<AbortController>(null)
  const [currentRole, setCurrentRole] = createSignal<Role>({ role: '', avatar: '', fc: '' })
  const [roles, setRoles] = createSignal<Role[]>([])

  const defaultSetting = {
    openaiAPIKey: "",
    customRule: "",
    openaiAPITemperature: 70,
  }
  const [setting, setSetting] = createSignal({
    ...defaultSetting
  })

  // 获取历史配置
  onMount(async () => {
    const storage = localStorage.getItem("setting")
    try {
      if (storage) {
        const parsed = JSON.parse(storage)
        setSetting({
          ...defaultSetting,
          ...parsed
        })
      }
    } catch {
      console.log("Setting parse error")
    }
    const response = await fetch('/api/generate');
    let roles = await response.json();
    setRoles([...roles]);
  })

  // 保存历史配置
  createEffect(() => {
    localStorage.setItem("setting", JSON.stringify(setting()))
    // 查询当前用户的聊天消息
    //clear()
  })

  // 保存角色消息
  createEffect(() => {
    localStorage.setItem(currentRole().role, JSON.stringify([...messageList()]))
  })

  createEffect(() => {
    const swiper = new Swiper('.swiper', {
      slidesPerView: "auto", //设置slider容器能够同时显示的slides数量(carousel模式)。
      autoplay: false, //设置为true启动自动切换，并使用默认的切换设置。
      direction: 'horizontal', //设置滑动方向
      grabCursor: true,  //置为true时，鼠标覆盖Swiper时指针会变成手掌形状，拖动时指针会变成抓手形状。（根据浏览器形状有所不同）
      observer: true,
      observeParents: true,
      parallax: true,
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    });
  })

  const handleButtonClick = async () => {
    const inputValue = inputRef.value
    if (!inputValue) {
      return
    }
    // @ts-ignore
    if (window?.umami) umami.trackEvent('chat_generate');
    // @ts-ignore
    if (window?.umami) umami.trackEvent('chat_role_' + currentRole().role);
    inputRef.value = '';
    setMessageList([
      ...messageList(),
      {
        role: 'user',
        content: inputValue,
      },
    ])
    requestWithLatestMessage()
  }
  const throttle = _.throttle(function () {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, 300, {
    leading: true,
    trailing: false
  })
  const requestWithLatestMessage = async () => {
    setLoading(true)
    setCurrentAssistantMessage('')
    try {
      const controller = new AbortController()
      setController(controller)
      // 不要第一条欢迎语,需要更好的方式
      let requestMessageList = [...messageList()]
      if (requestMessageList[0].role == 'assistant') {
        requestMessageList = requestMessageList.slice(1)
      }
      requestMessageList = requestMessageList.filter((item) => {
        return !item.content.includes('⚠️')
      })
      if (requestMessageList.length > 15) {
        requestMessageList = [...requestMessageList.slice(0, 3), ...requestMessageList.slice(-12)];
      }
      const timestamp = Date.now()
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          setting: {
            ...setting(),
            role: currentRole().role,
          },
          messages: requestMessageList,
          time: timestamp,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(response.statusText)
      }
      const data = response.body
      if (!data) {
        throw new Error('No data')
      }
      const reader = data.getReader()
      const decoder = new TextDecoder('utf-8')
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        if (value) {
          let char = decoder.decode(value)
          if (char === '\n' && currentAssistantMessage().endsWith('\n')) {
            continue
          }
          if (char) {
            setCurrentAssistantMessage(currentAssistantMessage() + char)
          }
          throttle()
        }
        done = readerDone
      }
    } catch (e) {
      setLoading(false)
      setController(null)
      return
    }
    archiveCurrentMessage()
  }

  const archiveCurrentMessage = () => {
    if (currentAssistantMessage()) {
      setMessageList([
        ...messageList(),
        {
          role: 'assistant',
          content: currentAssistantMessage(),
        },
      ])
      setCurrentAssistantMessage('')
      setLoading(false)
      setController(null)
      inputRef.focus()
    }
  }

  const clear = () => {
    inputRef.value = ''
    inputRef.style.height = 'auto';
    setMessageList([])
    setCurrentAssistantMessage('')
  }

  const stopStreamFetch = () => {
    if (controller()) {
      controller().abort()
      archiveCurrentMessage()
    }
  }

  const choiceRole = (e: any) => {
    setCurrentRole(e)
    clear()
    setCurrentAssistantMessage(e.fc)
    archiveCurrentMessage()
  }

  const retryLastFetch = () => {
    if (messageList().length > 0) {
      const lastMessage = messageList()[messageList().length - 1]
      if (lastMessage.role === 'assistant') {
        setMessageList(messageList().slice(0, -1))
        requestWithLatestMessage()
      }
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.isComposing || e.shiftKey) {
      return
    }
    if (e.key === 'Enter') {
      handleButtonClick()
    }
  }

  return (
    <div my-6>
      <div>
        <div class="swiper">
          <div class="swiper-wrapper">
            <For each={roles()} fallback={<div>请深呼吸等待...</div>}>
              {(item) => <div
                classList={{ selected: currentRole().role === item.role }}
                onClick={() => {
                  choiceRole(item)
                }}
                class="swiper-slide" data-role={item.role}> <div class="avatar-wrapper">
                  <img src={item.avatar} alt={item.role} class="avatar" />
                </div>
                <div class="info-wrapper">
                  <h3 class="title">
                    <span class="scope">{item.role}</span>
                  </h3>
                </div></div>}
            </For>
          </div>
          <div class="swiper-button-prev"></div>
          <div class="swiper-button-next"></div>
        </div>
      </div>

      <Index each={messageList()}>
        {(message, index) => (
          <MessageItem
            role={message().role}
            message={message().content}
            assistantAvatar={currentRole().avatar}
            showRetry={() => (message().role === 'assistant' && index === messageList().length - 1)}
            onRetry={retryLastFetch}
          />
        )}
      </Index>
      {currentAssistantMessage() && (
        <MessageItem
          role="assistant"
          assistantAvatar={currentRole().avatar}
          message={currentAssistantMessage}
        />
      )}
      <Show
        when={!loading()}
        fallback={() => (
          <div class="h-12 my-4 flex gap-4 items-center justify-center bg-slate bg-op-15 rounded-sm">
            <span>请保持平和与欢喜...</span>
            <div class="px-2 py-0.5 border border-slate rounded-md text-sm op-70 cursor-pointer hover:bg-slate/10" onClick={stopStreamFetch}>唵</div>
          </div>
        )}
      >
        <div class="my-4 flex items-center gap-2 transition-opacity">
          <textarea
            ref={inputRef!}
            onKeyDown={handleKeydown}
            placeholder="点击头像，开启对话..."
            autocomplete="off"
            
            onInput={() => {
              inputRef.style.height = 'auto';
              inputRef.style.height = inputRef.scrollHeight + 'px';
            }}
            rows="1"
            w-full
            px-3 py-3
            min-h-12
            max-h-36
            rounded-sm
            bg-slate
            bg-op-15
            resize-none
            focus:bg-op-20
            focus:ring-0
            focus:outline-none
            placeholder:op-50
            dark="placeholder:op-30"
            scroll-pa-8px
          />
          <button onClick={handleButtonClick} h-12 px-4 py-2 bg-slate bg-op-15 hover:bg-op-20 rounded-sm>
            卍
          </button>
          <button title="清除对话" onClick={clear} h-12 px-4 py-2 bg-slate bg-op-15 hover:bg-op-20 rounded-sm>
            <IconClear />
          </button>
        </div>
      </Show>
      <Setting
        setting={setting}
        setSetting={setSetting}
      />
    </div>
  )
}
