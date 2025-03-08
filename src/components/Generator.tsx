import type { ChatMessage } from '@/types';
import { createSignal, Index, Show, createEffect, onMount, For } from 'solid-js';
import IconClear from './icons/Clear';
import MessageItem from './MessageItem';
import Setting from "./Setting";
import _ from 'lodash';
import Swiper, { Navigation } from 'swiper';
import 'swiper/css';
import { register } from 'swiper/element/bundle';

register();
Swiper.use([Navigation]);

export interface Role {
  role: string;
  avatar: string;
  fc: string;
}

export default () => {
  let inputRef: HTMLTextAreaElement;
  const [messageList, setMessageList] = createSignal<ChatMessage[]>([]);
  const [currentAssistantMessage, setCurrentAssistantMessage] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [controller, setController] = createSignal<AbortController>(null);
  const [currentRole, setCurrentRole] = createSignal<Role>({ role: '', avatar: '', fc: '' });
  const [roles, setRoles] = createSignal<Role[]>([]);

  const defaultSetting = {
    openaiAPIKey: "",
    customRule: "",
    openaiAPITemperature: 70,
  };

  const [setting, setSetting] = createSignal({
    ...defaultSetting
  });

  // 获取历史配置
  onMount(async () => {
    const storage = localStorage.getItem("setting");
    try {
      if (storage) {
        const parsed = JSON.parse(storage);
        setSetting({
          ...defaultSetting,
          ...parsed
        });
      }
    } catch {
      console.log("Setting parse error");
    }
    const response = await fetch('/api/generate');
    let roles = await response.json();
    setRoles([...roles]);
  });

  // 保存历史配置
  createEffect(() => {
    localStorage.setItem("setting", JSON.stringify(setting()));
  });

  // 保存角色消息
  createEffect(() => {
    localStorage.setItem(currentRole().role, JSON.stringify([...messageList()]));
  });

  createEffect(() => {
    const swiper = new Swiper('.swiper', {
      slidesPerView: "auto",
      autoplay: false,
      direction: 'horizontal',
      grabCursor: true,
      observer: true,
      observeParents: true,
      parallax: true,
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    });
  });

  const handleButtonClick = async () => {
    const inputValue = inputRef.value;
    if (!inputValue) {
      return;
    }
    inputRef.value = '';
    setMessageList([
      ...messageList(),
      {
        role: 'user',
        content: inputValue,
      },
    ]);
    requestWithLatestMessage();
  };

  const throttle = _.throttle(function () {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, 300, {
    leading: true,
    trailing: false
  });

  const requestWithLatestMessage = async () => {
    setLoading(true);
    setCurrentAssistantMessage('');
    try {
      const controller = new AbortController();
      setController(controller);
      let requestMessageList = [...messageList()];
      if (requestMessageList[0].role == 'assistant') {
        requestMessageList = requestMessageList.slice(1);
      }
      requestMessageList = requestMessageList.filter((item) => {
        return !item.content.includes('⚠️');
      });
      if (requestMessageList.length > 15) {
        requestMessageList = [...requestMessageList.slice(0, 3), ...requestMessageList.slice(-12)];
      }
      const timestamp = Date.now();
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
      });
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      const data = response.body;
      if (!data) {
        throw new Error('No data');
      }
      const reader = data.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (value) {
          let char = decoder.decode(value);
          if (char === '\n' && currentAssistantMessage().endsWith('\n')) {
            continue;
          }
          if (char) {
            setCurrentAssistantMessage(currentAssistantMessage() + char);
          }
          throttle();
        }
        done = readerDone;
      }
    } catch (e) {
      setLoading(false);
      setController(null);
      return;
    }
    archiveCurrentMessage();
  };

  const archiveCurrentMessage = () => {
    if (currentAssistantMessage()) {
      setMessageList([
        ...messageList(),
        {
          role: 'assistant',
          content: currentAssistantMessage(),
        },
      ]);
      setCurrentAssistantMessage('');
      setLoading(false);
      setController(null);
      inputRef.focus();
    }
  };

  const clear = () => {
    inputRef.value = '';
    inputRef.style.height = 'auto';
    setMessageList([]);
    setCurrentAssistantMessage('');
  };

  const stopStreamFetch = () => {
    if (controller()) {
      controller().abort();
      archiveCurrentMessage();
    }
  };

  const choiceRole = (e: any) => {
    setCurrentRole(e);
    clear();
    setCurrentAssistantMessage(e.fc);
    archiveCurrentMessage();
  };

  const retryLastFetch = () => {
    if (messageList().length > 0) {
      const lastMessage = messageList()[messageList().length - 1];
      if (lastMessage.role === 'assistant') {
        setMessageList(messageList().slice(0, -1));
        requestWithLatestMessage();
      }
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.isComposing || e.shiftKey) {
      return;
    }
    if (e.key === 'Enter') {
      handleButtonClick();
    }
  };

  // 导出为Markdown的功能
  const exportToMarkdown = () => {
    const markdownLines = messageList().map(message => {
      return `**${message.role}:** ${message.content}`;
    });

    const markdown = markdownLines.join('\n\n');
    const blob = new Blob([markdown], { type: 'text/markdown' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'chat_export.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div my-6>
      <div>
        <div class="swiper">
          <div class="swiper-wrapper">
            <For each={roles()} fallback={<div>请深呼吸等待...</div>}>
              {(item) => (
                <div
                  classList={{ selected: currentRole().role === item.role }}
                  onClick={() => choiceRole(item)}
                  class="swiper-slide"
                  data-role={item.role}>
                  <div class="avatar-wrapper">
                    <img src={item.avatar} alt={item.role} class="avatar" />
                  </div>
                  <div class="info-wrapper">
                    <h3 class="title">
                      <span class="scope">{item.role}</span>
                    </h3>
                  </div>
                </div>
              )}
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
            class="w-full px-3 py-3 min-h-12 max-h-36 rounded-sm bg-slate bg-op-15 resize-none focus:bg-op-20 focus:ring-0 focus:outline-none placeholder:op-50 dark:placeholder:op-30"
          />
          <button onClick={handleButtonClick} class="h-12 px-4 py-2 bg-slate bg-op-15 hover:bg-op-20 rounded-sm">
            卍
          </button>
          <button title="清除对话" onClick={clear} class="h-12 px-4 py-2 bg-slate bg-op-15 hover:bg-op-20 rounded-sm">
            <IconClear />
          </button>
          <button title="导出Markdown" onClick={exportToMarkdown} class="h-12 px-4 py-2 bg-slate bg-op-15 hover:bg-op-20 rounded-sm">
            <svg t="1741397591578" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3037" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200"><path d="M752.3 245.1h-0.3c-14.6 0-26.5 11.9-26.5 26.5v267.2c0 0.8 0 1.6 0.1 2.4v150.3c0 0.8 0 1.6-0.1 2.4V752c0 14.7-12 26.8-26.8 26.8H325.3c-14.7 0-26.8-12-26.8-26.8V645.4c0-14.7 12-26.8 26.8-26.8h319.8v-0.1c14.7 0 26.7-11.9 26.7-26.7h0.3l0.1-213.3V245.2c0-29.4-24-53.4-53.4-53.4H298.5c-29.4 0-53.4 24-53.4 53.4v533.7c0 29.4 24 53.4 53.4 53.4h426.9c29.4 0 53.4-24 53.4-53.4V271.6c0-14.6-11.9-26.5-26.5-26.5zM397.8 298c3.2-3.4 7.1-5.1 11.8-5.1h36.6v-26.1c0-4.5 1.7-8.5 5.1-11.8 3.2-3.4 7.1-5.1 11.8-5.1 4.5 0 8.5 1.7 11.8 5.1 3.4 3.4 5.1 7.3 5.1 11.8v26.1h28.1v-25.7c0-4.7 1.7-8.8 5.1-12.2 3.2-3.2 7.1-4.7 11.8-4.7 4.5 0 8.5 1.6 11.8 4.7 3.4 3.4 5.1 7.4 5.1 12.2v25.7h12.9c11.1 0 20.5 4 28.4 11.8 7.7 7.7 11.5 17 11.5 28.1v19.3c0 11.3-3.8 20.9-11.5 28.8-7.9 7.7-17.4 11.5-28.4 11.5H542V426h22.7c11.1 0 20.7 4.1 28.8 12.2 7.9 7.9 11.8 17.5 11.8 28.8v44c0 4.7-1.6 8.7-4.7 11.8-3.4 3.4-7.4 5.1-12.2 5.1-4.5 0-8.5-1.7-11.8-5.1-3.4-3.2-5.1-7.1-5.1-11.8v-44c0-4.7-2.3-7.1-6.8-7.1H542v79.9c0 4.7-1.7 8.7-5.1 11.8-3.4 3.4-7.3 5.1-11.8 5.1-4.7 0-8.7-1.7-11.8-5.1-3.4-3.2-5.1-7.1-5.1-11.8v-79.9h-31.8c-3.2 19.9-10.7 39.2-22.7 57.9-2.3 3.4-7.3 9.9-15.2 19.6l-12.2 14.9c-7.9 7.9-15.9 8.5-24 1.7-3.6-3.2-5.5-7-5.8-11.5-0.5-4.5 0.9-8.6 4.1-12.2 10.6-12 19-22.3 25.1-31.1 8.3-13.1 13.8-26.2 16.3-39.3h-13.5c-11.1 0-20.4-3.8-28.1-11.5-7.9-7.9-11.8-17.4-11.8-28.4v-21.7c0-10.8 3.8-20.1 11.5-27.8 7.9-7.9 17.3-11.8 28.1-11.8h18.3v-31.8h-36.6c-4.7 0-8.7-1.7-11.8-5.1-3.4-3.2-5.1-7.1-5.1-11.8-0.3-4.7 1.4-8.6 4.8-12z m-91.1 96.5l53.2-134.1c4.3-10.6 11.6-13.8 22-9.5 4.3 1.8 7.4 4.7 9.5 8.8 1.8 4.3 1.8 8.7 0 13.2l-19.6 49.4c0.2 0.5 0.3 1.6 0.3 3.4v215c0 4.7-1.6 8.7-4.7 11.8-3.4 3.4-7.4 5.1-12.2 5.1-4.7 0-8.7-1.7-11.8-5.1-3.4-3.2-5.1-7.1-5.1-11.8V407c-4.5 9.7-11.8 12.9-22 9.5-4.3-1.8-7.3-4.9-9.1-9.1-2.2-4.6-2.3-8.9-0.5-12.9z" fill="#BE9567" p-id="3038"></path><path d="M645.3 672.1H378.2c-14.6 0-26.5 11.9-26.5 26.5v0.4c0 14.6 11.9 26.5 26.5 26.5h267.2c14.6 0 26.5-11.9 26.5-26.5v-0.4c0-14.6-12-26.5-26.6-26.5zM561 352.6v-19.3c0-4.1-2-6.1-6.1-6.1H542V359h12.9c4 0 6.1-2.1 6.1-6.4zM422.2 398.6v21.7c0 4.1 2 6.1 6.1 6.1h17.3c0.4-10.8 0.7-22 0.7-33.5H428c-3.9 0-5.8 1.9-5.8 5.7zM508.1 392.9H480c0 11.1-0.2 22.2-0.7 33.5h28.8v-33.5zM480 327.2h28.1V359H480z" fill="#BE9567" p-id="3039"></path></svg>
          </button>
        </div>
      </Show>

      <Setting
        setting={setting}
        setSetting={setSetting}
      />
    </div>
  );
};
