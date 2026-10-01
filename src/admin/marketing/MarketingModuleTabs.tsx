import React from 'react';

export function MarketingModuleTabs({
  active,
  onNavigate,
}: {
  active: 'settings' | 'statistics' | 'configuration';
  onNavigate: (path: string) => void;
}) {
  const tabs = [
    { key: 'settings' as const, label: '营销设置', path: '/admin/marketing-settings' },
    { key: 'configuration' as const, label: '管理员配置', path: '/admin/marketing-configuration' },
    { key: 'statistics' as const, label: '营销统计', path: '/admin/marketing-statistics' },
  ];
  return (
    <div className="flex gap-5 overflow-x-auto border-b border-neutral-200" aria-label="营销模块页面">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`min-h-10 whitespace-nowrap border-b-2 px-1 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 text-sm font-semibold transition ${
            active === tab.key
              ? 'border-neutral-950 text-neutral-950'
              : 'border-transparent text-neutral-500 hover:text-neutral-900'
          }`}
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => onNavigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
