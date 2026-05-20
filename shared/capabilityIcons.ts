interface SimpleIconSource {
  path: string;
  hex: string;
}

export type CapabilityIconCategory = 'streaming' | 'payment' | 'support' | 'client' | 'import' | 'region';

export type CapabilityIconData =
  | {
      kind: 'svg';
      path: string;
      color: string;
      bg: string;
      border: string;
    }
  | {
      kind: 'flag' | 'text';
      mark: string;
      color: string;
      bg: string;
      border: string;
    };

function brandIcon(icon: SimpleIconSource, bg = '#ffffff'): CapabilityIconData {
  return {
    kind: 'svg',
    path: icon.path,
    color: `#${icon.hex}`,
    bg,
    border: '#e2e8f0',
  };
}

const simpleIcons = {
  netflix: { path: 'm5.398 0 8.348 23.602c2.346.059 4.856.398 4.856.398L10.113 0H5.398zm8.489 0v9.172l4.715 13.33V0h-4.715zM5.398 1.5V24c1.873-.225 2.81-.312 4.715-.398V14.83L5.398 1.5z', hex: 'E50914' },
  hboMax: { path: 'M3.784 8.716c-.655 0-1.32.29-2.173.946v-.78H0v6.236h1.715V11.24c.749-.592 1.091-.78 1.372-.78.333 0 .551.209.551.729v3.928h1.715V11.23c.748-.582 1.081-.769 1.372-.769.333 0 .55.208.55.728v3.928H8.99v-4.53c0-1.403-.8-1.871-1.57-1.871-.654 0-1.32.27-2.192.936-.28-.697-.894-.936-1.444-.936zm8.689 0c-1.705 0-3.118 1.466-3.118 3.284 0 1.82 1.413 3.285 3.118 3.285.842 0 1.57-.312 2.131-.988v.82h1.632V8.883h-1.632v.822c-.561-.676-1.29-.988-2.131-.988zm4.064.166c.707 1.102 1.507 2.09 2.443 3.077a26.593 26.593 0 0 0-2.443 3.16h2.069a13.603 13.603 0 0 1 1.673-2.183 14.067 14.067 0 0 1 1.632 2.182H24a25.142 25.142 0 0 0-2.432-3.16A23.918 23.918 0 0 0 24 8.883h-2.047a14.65 14.65 0 0 1-1.674 2.11 13.357 13.357 0 0 1-1.674-2.11zm-3.804 1.279c1.018 0 1.84.82 1.84 1.84a1.837 1.837 0 0 1-1.84 1.839c-1.019 0-1.84-.82-1.84-1.84 0-1.018.821-1.84 1.84-1.84zm0 .415c-.78 0-1.414.633-1.414 1.423s.634 1.424 1.413 1.424c.78 0 1.414-.634 1.414-1.424s-.634-1.424-1.414-1.424z', hex: '000000' },
  youtube: { path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', hex: 'FF0000' },
  tiktok: { path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z', hex: '000000' },
  spotify: { path: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z', hex: '1ED760' },
  alipay: { path: 'M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809', hex: '1677FF' },
  wechat: { path: 'M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z', hex: '07C160' },
  tether: { path: 'M18.7538 10.5176c0 .6251-2.2379 1.1483-5.2381 1.2812l.0028.0007c-.0848.0064-.5233.0325-1.5012.0325-.7778 0-1.33-.0233-1.5237-.0325-3.0059-.1322-5.2495-.6555-5.2495-1.2819s2.2436-1.149 5.2495-1.2834v2.0442c.1965.0142.7594.0474 1.5372.0474.9334 0 1.4008-.0389 1.4849-.0466V9.2356c2.9994.1337 5.2381.657 5.2381 1.282zm5.19.5466L12.1248 22.389a.1803.1803 0 0 1-.2496 0L.0562 11.0635a.1781.1781 0 0 1-.0382-.2079l4.3762-9.1921a.1767.1767 0 0 1 .1626-.1026h14.8878a.1768.1768 0 0 1 .1612.1032l4.3762 9.1922a.1782.1782 0 0 1-.0382.2079zm-4.478-.4038c0-.8068-2.5515-1.4799-5.9473-1.6369V7.195h4.186V4.4055H6.3076V7.195h4.1852v1.8286c-3.4018.1562-5.9601.83-5.9601 1.6376 0 .8075 2.5583 1.4806 5.9601 1.6376v5.8618h3.025v-5.8639c3.394-.1563 5.948-.8295 5.948-1.6363z', hex: '50AF95' },
  stripe: { path: 'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z', hex: '635BFF' },
  paypal: { path: 'M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z', hex: '002991' },
  telegram: { path: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z', hex: '26A5E4' },
};

const capabilityIconMap: Record<string, CapabilityIconData> = {
  netflix: brandIcon(simpleIcons.netflix, '#050505'),
  chatgpt: { kind: 'text', mark: '◎', color: '#ffffff', bg: '#050505', border: '#111827' },
  disney_plus: { kind: 'text', mark: 'D+', color: '#113ccf', bg: '#eef6ff', border: '#dbeafe' },
  hbo_max: brandIcon(simpleIcons.hboMax, '#ffffff'),
  youtube_premium: brandIcon(simpleIcons.youtube, '#ffffff'),
  tiktok: brandIcon(simpleIcons.tiktok, '#ffffff'),
  spotify: brandIcon(simpleIcons.spotify, '#ffffff'),
  alipay: brandIcon(simpleIcons.alipay, '#ffffff'),
  wechat: brandIcon(simpleIcons.wechat, '#ffffff'),
  usdt_trc20: brandIcon(simpleIcons.tether, '#ffffff'),
  usdt_erc20: brandIcon(simpleIcons.tether, '#ffffff'),
  usdt_bep20: brandIcon(simpleIcons.tether, '#ffffff'),
  stripe_card: brandIcon(simpleIcons.stripe, '#ffffff'),
  paypal: brandIcon(simpleIcons.paypal, '#ffffff'),
  crypto_other: { kind: 'text', mark: '₿', color: '#b45309', bg: '#fffbeb', border: '#fef3c7' },
  unionpay: { kind: 'text', mark: '银', color: '#e11d48', bg: '#fff1f2', border: '#ffe4e6' },
  group: brandIcon(simpleIcons.telegram, '#ffffff'),
  channel: brandIcon(simpleIcons.telegram, '#ffffff'),
  customer_service_bot: { kind: 'text', mark: '🤖', color: '#0e7490', bg: '#ecfeff', border: '#cffafe' },
  ticket_system: { kind: 'text', mark: '🎫', color: '#2563eb', bg: '#eff6ff', border: '#dbeafe' },
  group_allows_speaking: { kind: 'text', mark: '💬', color: '#0f766e', bg: '#f0fdfa', border: '#ccfbf1' },
  self_built_client: { kind: 'text', mark: 'App', color: '#334155', bg: '#f8fafc', border: '#e2e8f0' },
  clash: { kind: 'text', mark: '⚔', color: '#2563eb', bg: '#eff6ff', border: '#dbeafe' },
  clash_verge: { kind: 'text', mark: '⚔', color: '#2563eb', bg: '#eff6ff', border: '#dbeafe' },
  shadowrocket: { kind: 'text', mark: '🚀', color: '#4f46e5', bg: '#eef2ff', border: '#e0e7ff' },
  quantumult_x: { kind: 'text', mark: 'QX', color: '#7c3aed', bg: '#f5f3ff', border: '#ede9fe' },
  stash: { kind: 'text', mark: 'S', color: '#e11d48', bg: '#fff1f2', border: '#ffe4e6' },
  surge: { kind: 'text', mark: '↟', color: '#0284c7', bg: '#f0f9ff', border: '#e0f2fe' },
  sing_box: { kind: 'text', mark: '□', color: '#334155', bg: '#f8fafc', border: '#e2e8f0' },
  v2rayn: { kind: 'text', mark: 'V2', color: '#0e7490', bg: '#ecfeff', border: '#cffafe' },
  v2rayng: { kind: 'text', mark: 'V2', color: '#0e7490', bg: '#ecfeff', border: '#cffafe' },
  nekobox: { kind: 'text', mark: 'N', color: '#2563eb', bg: '#eff6ff', border: '#dbeafe' },
  surfboard: { kind: 'text', mark: 'SF', color: '#0f766e', bg: '#f0fdfa', border: '#ccfbf1' },
  xiaohuojian: { kind: 'text', mark: '🚀', color: '#4f46e5', bg: '#eef2ff', border: '#e0e7ff' },
  openclash: { kind: 'text', mark: 'OC', color: '#2563eb', bg: '#eff6ff', border: '#dbeafe' },
  one_click_import: { kind: 'text', mark: '↯', color: '#15803d', bg: '#f0fdf4', border: '#dcfce7' },
  subscription_link: { kind: 'text', mark: '🔗', color: '#2563eb', bg: '#eff6ff', border: '#dbeafe' },
  universal_subscription: { kind: 'text', mark: 'SUB', color: '#4f46e5', bg: '#eef2ff', border: '#e0e7ff' },
  qr_code_import: { kind: 'text', mark: '▣', color: '#334155', bg: '#f8fafc', border: '#e2e8f0' },
  tutorials: { kind: 'text', mark: '📘', color: '#b45309', bg: '#fffbeb', border: '#fef3c7' },
  hong_kong: { kind: 'flag', mark: '🇭🇰', color: '#dc2626', bg: '#fff1f2', border: '#fecdd3' },
  taiwan: { kind: 'flag', mark: '🇹🇼', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  japan: { kind: 'flag', mark: '🇯🇵', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
  singapore: { kind: 'flag', mark: '🇸🇬', color: '#dc2626', bg: '#fff1f2', border: '#fecdd3' },
  united_states: { kind: 'flag', mark: '🇺🇸', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  south_korea: { kind: 'flag', mark: '🇰🇷', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
  united_kingdom: { kind: 'flag', mark: '🇬🇧', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  germany: { kind: 'flag', mark: '🇩🇪', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  turkey: { kind: 'flag', mark: '🇹🇷', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
  argentina: { kind: 'flag', mark: '🇦🇷', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  india: { kind: 'flag', mark: '🇮🇳', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
};

const capabilityIconFallbacks: Record<CapabilityIconCategory, CapabilityIconData> = {
  streaming: { kind: 'text', mark: 'TV', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  payment: { kind: 'text', mark: 'Pay', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  support: { kind: 'text', mark: '?', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  client: { kind: 'text', mark: 'App', color: '#334155', bg: '#f8fafc', border: '#e2e8f0' },
  import: { kind: 'text', mark: 'Go', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  region: { kind: 'text', mark: '◎', color: '#334155', bg: '#ffffff', border: '#e2e8f0' },
};

export function getCapabilityIcon(capabilityKey: string, category: CapabilityIconCategory): CapabilityIconData {
  return capabilityIconMap[capabilityKey] || capabilityIconFallbacks[category];
}
