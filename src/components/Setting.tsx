import {
  Accessor,
  createSignal,
  JSXElement,
  Setter,
  Show
} from "solid-js"


import IconEnv from './icons/Env'

interface Setting {
  openaiAPIKey: string;
  customRule: string;
  openaiAPITemperature: number;
  roleAvatar?: string;
}

export default function Setting(props: {
  setting: Accessor<Setting>
  setSetting: Setter<Setting>
}) {
  const [shown, setShown] = createSignal(false)
  return (
    <div class="text-sm text-slate mb-2">

      <div class="mt-2 flex items-center justify-between">
        <div
          class="flex items-center cursor-pointer hover:text-slate-3 "
          onClick={() => {
            setShown(!shown())
          }}
        >
          <IconEnv />
          <span ml-1>拈花</span>
        </div>
      </div>
      <hr class="mt-2 bg-slate-5 bg-op-15 border-none h-1px"></hr>
      <Show when={shown()}>
        <SettingItem icon="i-carbon:api" label="API Key">
          <input
            type="password"
            placeholder="请看下方【告示】说明"
            value={props.setting().openaiAPIKey}
            class="max-w-200px ml-1em px-1 text-slate rounded-sm bg-slate bg-op-15 focus:bg-op-20 focus:ring-0 focus:outline-none placeholder:text-slate-400 placeholder:op-30"
            onInput={e => {
              props.setSetting({
                ...props.setting(),
                openaiAPIKey: (e.target as HTMLInputElement).value
              })
            }}
          />
        </SettingItem>
        <SettingItem icon="i-carbon:user-online" label="自定义角色">
          <input
            type="text"
            value={props.setting().customRule}
            class="text-ellipsis  max-w-200px ml-1em px-1 text-slate rounded-sm bg-slate bg-op-15 focus:bg-op-20 focus:ring-0 focus:outline-none placeholder:text-slate-400 placeholder:op-30"
            onInput={e => {
              props.setSetting({
                ...props.setting(),
                customRule: (e.target as HTMLInputElement).value
              })
            }}
          />
        </SettingItem>
      </Show>
    </div>
  )
}

function SettingItem(props: {
  children: JSXElement
  icon: string
  label: string
}) {
  return (
    <div class="flex items-center hover:text-slate-3 mt-2 justify-between">
      <div class="flex items-center">
        <button class={props.icon} />
        <span ml-1>{props.label}</span>
      </div>
      {props.children}
    </div>
  )
}
